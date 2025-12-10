import { randomUUID } from 'crypto';
import {
  PrismaDeliveryNoteRepository,
  PrismaInvoiceDeliveryLinkRepository,
} from '../infrastructure';
import { DeliveryNote } from '../domain/delivery/entities/DeliveryNote';
import { DeliveryNoteItem } from '../domain/delivery/entities/DeliveryNoteItem';
import { ItemCondition } from '../domain/delivery/value-objects/ItemCondition';
import { DeliveryNoteStatus } from '../domain/delivery/value-objects/DeliveryNoteStatus';
import pubsub, { PubSubService } from './pubsub';
import {
  CreateDeliveryNoteInput,
  UpdateDeliveryNoteItemInput,
  DeliveryNoteFiltersInput,
} from '../schemas/deliveryNote.schema';
import { PaginationInput, parsePagination } from '../schemas';

/**
 * Service facade for DeliveryNote operations.
 * Orchestrates domain logic, repository interactions, and event publishing.
 */

// Initialize repositories
const deliveryNoteRepository = new PrismaDeliveryNoteRepository();
const invoiceDeliveryLinkRepository = new PrismaInvoiceDeliveryLinkRepository();

/**
 * Creates a new delivery note in DRAFT status.
 * @throws Error if validation fails or delivery note number already exists
 */
export const createDeliveryNote = async (
  input: CreateDeliveryNoteInput,
  receivedBy: string
): Promise<DeliveryNote> => {
  // Check if delivery note number already exists
  const exists = await deliveryNoteRepository.existsByDeliveryNoteNumber(input.deliveryNoteNumber);
  if (exists) {
    throw new Error(`Delivery note number ${input.deliveryNoteNumber} already exists`);
  }

  // Generate delivery note ID first
  const deliveryNoteId = randomUUID();

  // Convert input items to domain entities
  // NOTE: Requires itemId and orderedQuantity from PO items - simplified for MVP
  const items = input.items.map(item =>
    DeliveryNoteItem.create({
      id: randomUUID(),
      deliveryNoteId,
      purchaseOrderItemId: item.purchaseOrderItemId,
      itemId: item.purchaseOrderItemId, // TODO: Fetch actual itemId from PO item
      quantityDelivered: item.quantityReceived,
      orderedQuantity: item.quantityReceived, // TODO: Fetch actual ordered qty from PO item
      condition: ItemCondition.fromString(item.condition),
      notes: item.notes ?? null,
    })
  );

  // Create delivery note aggregate
  const deliveryNote = DeliveryNote.create({
    id: deliveryNoteId,
    deliveryNoteNumber: input.deliveryNoteNumber,
    purchaseOrderId: input.purchaseOrderId,
    vendorId: input.vendorId,
    receivedBy,
    deliveryDate: new Date(input.deliveryDate),
    notes: input.notes ?? null,
    items,
  });

  // Persist to repository
  await deliveryNoteRepository.save(deliveryNote);

  // Publish event
  pubsub.publish(PubSubService.DELIVERY_NOTE_CREATED, {
    id: deliveryNote.id,
    deliveryNoteNumber: deliveryNote.deliveryNoteNumber,
    purchaseOrderId: deliveryNote.purchaseOrderId,
  });

  return deliveryNote;
};

/**
 * Gets a delivery note by ID.
 * @returns DeliveryNote if found, null otherwise
 */
export const getDeliveryNoteById = async (id: string): Promise<DeliveryNote | null> => {
  return deliveryNoteRepository.findById(id);
};

/**
 * Lists delivery notes with filters and pagination.
 */
export const listDeliveryNotes = async (
  filters: DeliveryNoteFiltersInput,
  pagination: PaginationInput
) => {
  const { page: pageNum, limit: limitNum, skip } = parsePagination(pagination);

  let deliveryNotes: DeliveryNote[] = [];

  // Apply filters
  if (filters.purchaseOrderId) {
    deliveryNotes = await deliveryNoteRepository.findByPurchaseOrderId(filters.purchaseOrderId);
  } else if (filters.vendorId) {
    deliveryNotes = await deliveryNoteRepository.findByVendorId(filters.vendorId);
  } else if (filters.status) {
    const status = DeliveryNoteStatus.fromString(filters.status);
    deliveryNotes = await deliveryNoteRepository.findByStatus(status);
  } else if (filters.dateFrom || filters.dateTo) {
    const startDate = filters.dateFrom ? new Date(filters.dateFrom) : new Date(0);
    const endDate = filters.dateTo ? new Date(filters.dateTo) : new Date();
    deliveryNotes = await deliveryNoteRepository.findByDateRange(startDate, endDate);
  } else {
    // No specific filter - this would require a findAll method
    // For now, return empty or implement findAll in repository
    deliveryNotes = [];
  }

  // Apply additional filters in memory (not ideal, but works for MVP)
  if (filters.status && !filters.purchaseOrderId && !filters.vendorId) {
    const statusFilter = filters.status;
    deliveryNotes = deliveryNotes.filter(dn => dn.status.value === statusFilter);
  }

  // Paginate
  const total = deliveryNotes.length;
  const paginatedNotes = deliveryNotes.slice(skip, skip + limitNum);
  const totalPages = Math.ceil(total / limitNum);

  return {
    data: paginatedNotes,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
      hasNext: pageNum < totalPages,
      hasPrevious: pageNum > 1,
    },
  };
};

/**
 * Updates a delivery note item.
 * Only allowed when delivery note is in DRAFT status.
 * @throws Error if delivery note is not in DRAFT or item not found
 */
export const updateDeliveryNoteItem = async (
  deliveryNoteId: string,
  itemId: string,
  input: UpdateDeliveryNoteItemInput
): Promise<DeliveryNote> => {
  const deliveryNote = await deliveryNoteRepository.findById(deliveryNoteId);
  if (!deliveryNote) {
    throw new Error(`Delivery note ${deliveryNoteId} not found`);
  }

  // Find the item
  const existingItem = deliveryNote.findItemById(itemId);
  if (!existingItem) {
    throw new Error(`Item ${itemId} not found in delivery note`);
  }

  // Create updated item (items are immutable, must replace)
  const updatedItem = DeliveryNoteItem.create({
    id: existingItem.id,
    deliveryNoteId: existingItem.deliveryNoteId,
    purchaseOrderItemId: existingItem.purchaseOrderItemId,
    itemId: existingItem.itemId,
    quantityDelivered: input.quantityReceived ?? existingItem.quantityDelivered,
    orderedQuantity: existingItem.orderedQuantity,
    condition: input.condition ? ItemCondition.fromString(input.condition) : existingItem.condition,
    notes: input.notes !== undefined ? input.notes : existingItem.notes,
  });

  // Update the item using domain method
  deliveryNote.updateItem(updatedItem);

  // Persist changes
  await deliveryNoteRepository.update(deliveryNote);

  return deliveryNote;
};

/**
 * Confirms a delivery note, transitioning from DRAFT to CONFIRMED status.
 * @throws Error if delivery note is already confirmed
 */
export const confirmDeliveryNote = async (id: string): Promise<DeliveryNote> => {
  const deliveryNote = await deliveryNoteRepository.findById(id);
  if (!deliveryNote) {
    throw new Error(`Delivery note ${id} not found`);
  }

  // Confirm using domain method
  deliveryNote.confirm();

  // Persist changes
  await deliveryNoteRepository.update(deliveryNote);

  // Publish event
  pubsub.publish(PubSubService.DELIVERY_NOTE_CONFIRMED, {
    id: deliveryNote.id,
    deliveryNoteNumber: deliveryNote.deliveryNoteNumber,
    purchaseOrderId: deliveryNote.purchaseOrderId,
  });

  return deliveryNote;
};

/**
 * Links delivery notes to an invoice.
 * @throws Error if any delivery note is not CONFIRMED
 */
export const linkDeliveryNotesToInvoice = async (
  invoiceId: string,
  deliveryNoteIds: string[]
): Promise<void> => {
  // Validate all delivery notes are confirmed
  for (const dnId of deliveryNoteIds) {
    const deliveryNote = await deliveryNoteRepository.findById(dnId);
    if (!deliveryNote) {
      throw new Error(`Delivery note ${dnId} not found`);
    }
    if (!deliveryNote.status.isConfirmed()) {
      throw new Error(
        `Delivery note ${dnId} must be CONFIRMED before linking to invoice`
      );
    }
  }

  // Create links
  for (const dnId of deliveryNoteIds) {
    const linkExists = await invoiceDeliveryLinkRepository.exists(invoiceId, dnId);
    if (!linkExists) {
      await invoiceDeliveryLinkRepository.link(invoiceId, dnId);
    }
  }

  // Publish event
  pubsub.publish(PubSubService.DELIVERY_NOTES_LINKED_TO_INVOICE, {
    invoiceId,
    deliveryNoteIds,
  });
};

/**
 * Gets all delivery notes linked to an invoice.
 */
export const getDeliveryNotesByInvoiceId = async (
  invoiceId: string
): Promise<DeliveryNote[]> => {
  const deliveryNoteIds = await invoiceDeliveryLinkRepository.findDeliveryNoteIdsByInvoiceId(
    invoiceId
  );

  const deliveryNotes: DeliveryNote[] = [];
  for (const dnId of deliveryNoteIds) {
    const dn = await deliveryNoteRepository.findById(dnId);
    if (dn) {
      deliveryNotes.push(dn);
    }
  }

  return deliveryNotes;
};

/**
 * Finds delivery notes with issues (damaged, partial, rejected items).
 */
export const getDeliveryNotesWithIssues = async (): Promise<DeliveryNote[]> => {
  return deliveryNoteRepository.findWithIssues();
};
