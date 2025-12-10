import { DeliveryNote as PrismaDeliveryNote, DeliveryNoteItem as PrismaDeliveryNoteItem } from '@prisma/client';
import { DeliveryNote } from '../../../../domain/delivery/entities/DeliveryNote';
import { DeliveryNoteItem } from '../../../../domain/delivery/entities/DeliveryNoteItem';
import { DeliveryNoteStatus } from '../../../../domain/delivery/value-objects/DeliveryNoteStatus';
import { ItemCondition } from '../../../../domain/delivery/value-objects/ItemCondition';

/**
 * Mapper to convert between Prisma models and DeliveryNote domain entities.
 * Implements the Data Mapper pattern to decouple domain layer from persistence.
 */
export class DeliveryNoteMapper {
  /**
   * Converts a Prisma DeliveryNote (with items) to a domain DeliveryNote entity.
   * @param prismaDeliveryNote - Prisma model with included items
   * @returns Domain DeliveryNote entity
   */
  static toDomain(
    prismaDeliveryNote: PrismaDeliveryNote & { items: PrismaDeliveryNoteItem[] }
  ): DeliveryNote {
    const status = DeliveryNoteStatus.fromString(prismaDeliveryNote.status);

    // Map delivery note items
    const items = prismaDeliveryNote.items.map(item =>
      DeliveryNoteItem.create({
        id: item.id.toString(),
        deliveryNoteId: prismaDeliveryNote.id.toString(),
        purchaseOrderItemId: item.id.toString(), // Using item ID as PO item ID (based on schema)
        itemId: item.itemId.toString(),
        quantityDelivered: item.quantityDelivered,
        orderedQuantity: item.quantityOrdered,
        condition: ItemCondition.fromString(item.condition),
        notes: item.discrepancyReason,
      })
    );

    return DeliveryNote.reconstitute({
      id: prismaDeliveryNote.id.toString(),
      deliveryNoteNumber: prismaDeliveryNote.id.toString(), // Using ID as delivery note number for now
      purchaseOrderId: prismaDeliveryNote.purchaseOrderId.toString(),
      vendorId: prismaDeliveryNote.vendorId.toString(),
      receivedBy: prismaDeliveryNote.receivedBy,
      deliveryDate: prismaDeliveryNote.deliveryDate,
      status,
      notes: prismaDeliveryNote.notes,
      createdAt: prismaDeliveryNote.createdAt,
      updatedAt: prismaDeliveryNote.updatedAt,
      items,
    });
  }

  /**
   * Converts a domain DeliveryNote entity to Prisma create data.
   * @param deliveryNote - Domain entity
   * @returns Prisma create input
   */
  static toPersistenceCreate(deliveryNote: DeliveryNote): {
    deliveryDate: Date;
    receivedBy: string;
    notes: string | null;
    status: string;
    purchaseOrderId: number;
    vendorId: number;
    createdBy: number;
    items: {
      create: Array<{
        itemId: number;
        quantityOrdered: number;
        quantityDelivered: number;
        condition: string;
        discrepancyReason: string | null;
      }>;
    };
  } {
    return {
      deliveryDate: deliveryNote.deliveryDate,
      receivedBy: deliveryNote.receivedBy,
      notes: deliveryNote.notes,
      status: deliveryNote.status.toString(),
      purchaseOrderId: parseInt(deliveryNote.purchaseOrderId),
      vendorId: parseInt(deliveryNote.vendorId),
      createdBy: 1, // TODO: Get from context/session
      items: {
        create: deliveryNote.getItems().map(item => ({
          itemId: parseInt(item.itemId),
          quantityOrdered: item.orderedQuantity,
          quantityDelivered: item.quantityDelivered,
          condition: item.condition.toString(),
          discrepancyReason: item.notes,
        })),
      },
    };
  }

  /**
   * Converts a domain DeliveryNote entity to Prisma update data.
   * @param deliveryNote - Domain entity
   * @returns Prisma update input
   */
  static toPersistenceUpdate(deliveryNote: DeliveryNote): {
    deliveryDate: Date;
    receivedBy: string;
    notes: string | null;
    status: string;
    updatedAt: Date;
  } {
    return {
      deliveryDate: deliveryNote.deliveryDate,
      receivedBy: deliveryNote.receivedBy,
      notes: deliveryNote.notes,
      status: deliveryNote.status.toString(),
      updatedAt: new Date(),
    };
  }

  /**
   * Converts a domain DeliveryNoteItem to Prisma create data.
   * @param item - Domain entity
   * @returns Prisma create input
   */
  static itemToPersistenceCreate(item: DeliveryNoteItem): {
    itemId: number;
    quantityOrdered: number;
    quantityDelivered: number;
    condition: string;
    discrepancyReason: string | null;
  } {
    return {
      itemId: parseInt(item.itemId),
      quantityOrdered: item.orderedQuantity,
      quantityDelivered: item.quantityDelivered,
      condition: item.condition.toString(),
      discrepancyReason: item.notes,
    };
  }
}
