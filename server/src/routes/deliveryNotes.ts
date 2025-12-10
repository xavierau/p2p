import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { Permission } from '../constants/permissions';
import { AuthRequest } from '../types/auth';
import * as deliveryNoteService from '../services/deliveryNoteService';
import logger from '../utils/logger';
import {
  CreateDeliveryNoteSchema,
  UpdateDeliveryNoteItemSchema,
  ConfirmDeliveryNoteSchema,
  LinkDeliveryNotesToInvoiceSchema,
  DeliveryNoteFiltersSchema,
} from '../schemas/deliveryNote.schema';
import { PaginationSchema } from '../schemas';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * POST /api/delivery-notes
 * Create a new delivery note
 */
router.post(
  '/',
  authorize(Permission.DELIVERY_NOTE_CREATE),
  async (req: AuthRequest, res) => {
    try {
      const validatedInput = CreateDeliveryNoteSchema.parse(req.body);
      const receivedBy = req.user?.userId.toString();

      if (!receivedBy) {
        return res.status(401).json({ error: 'User authentication required' });
      }

      const deliveryNote = await deliveryNoteService.createDeliveryNote(
        validatedInput,
        receivedBy
      );

      res.status(201).json({
        id: deliveryNote.id,
        deliveryNoteNumber: deliveryNote.deliveryNoteNumber,
        status: deliveryNote.status.value,
        purchaseOrderId: deliveryNote.purchaseOrderId,
        vendorId: deliveryNote.vendorId,
        receivedBy: deliveryNote.receivedBy,
        deliveryDate: deliveryNote.deliveryDate.toISOString(),
        notes: deliveryNote.notes,
        items: deliveryNote.getItems().map(item => ({
          id: item.id,
          purchaseOrderItemId: item.purchaseOrderItemId,
          quantityDelivered: item.quantityDelivered,
          orderedQuantity: item.orderedQuantity,
          condition: item.condition.value,
          notes: item.notes,
        })),
        createdAt: deliveryNote.createdAt.toISOString(),
        updatedAt: deliveryNote.updatedAt.toISOString(),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        return res.status(400).json({ error: error.message });
      }
      logger.error({ err: error }, 'Failed to create delivery note');
      res.status(500).json({ error: 'Failed to create delivery note' });
    }
  }
);

/**
 * GET /api/delivery-notes/:id
 * Get a specific delivery note by ID
 */
router.get(
  '/:id',
  authorize(Permission.DELIVERY_NOTE_READ),
  async (req, res) => {
    const { id } = req.params;

    try {
      const deliveryNote = await deliveryNoteService.getDeliveryNoteById(id);

      if (!deliveryNote) {
        return res.status(404).json({ error: 'Delivery note not found' });
      }

      res.json({
        id: deliveryNote.id,
        deliveryNoteNumber: deliveryNote.deliveryNoteNumber,
        status: deliveryNote.status.value,
        purchaseOrderId: deliveryNote.purchaseOrderId,
        vendorId: deliveryNote.vendorId,
        receivedBy: deliveryNote.receivedBy,
        deliveryDate: deliveryNote.deliveryDate.toISOString(),
        notes: deliveryNote.notes,
        items: deliveryNote.getItems().map(item => ({
          id: item.id,
          purchaseOrderItemId: item.purchaseOrderItemId,
          quantityDelivered: item.quantityDelivered,
          orderedQuantity: item.orderedQuantity,
          condition: item.condition.value,
          notes: item.notes,
        })),
        createdAt: deliveryNote.createdAt.toISOString(),
        updatedAt: deliveryNote.updatedAt.toISOString(),
      });
    } catch (error) {
      logger.error({ err: error, deliveryNoteId: id }, 'Failed to get delivery note');
      res.status(500).json({ error: 'Failed to retrieve delivery note' });
    }
  }
);

/**
 * GET /api/delivery-notes
 * List delivery notes with filters and pagination
 */
router.get(
  '/',
  authorize(Permission.DELIVERY_NOTE_READ),
  async (req, res) => {
    try {
      const filters = DeliveryNoteFiltersSchema.parse({
        purchaseOrderId: req.query.purchaseOrderId,
        vendorId: req.query.vendorId,
        status: req.query.status,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
      });

      const pagination = PaginationSchema.parse({
        page: req.query.page || '1',
        limit: req.query.limit || '10',
      });

      const result = await deliveryNoteService.listDeliveryNotes(filters, pagination);

      res.json({
        data: result.data.map(dn => ({
          id: dn.id,
          deliveryNoteNumber: dn.deliveryNoteNumber,
          status: dn.status.value,
          purchaseOrderId: dn.purchaseOrderId,
          vendorId: dn.vendorId,
          receivedBy: dn.receivedBy,
          deliveryDate: dn.deliveryDate.toISOString(),
          notes: dn.notes,
          itemCount: dn.itemCount,
          hasIssues: dn.hasAnyIssues(),
          createdAt: dn.createdAt.toISOString(),
          updatedAt: dn.updatedAt.toISOString(),
        })),
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ err: error }, 'Failed to list delivery notes');
      res.status(500).json({ error: 'Failed to retrieve delivery notes' });
    }
  }
);

/**
 * PATCH /api/delivery-notes/:id/items/:itemId
 * Update a delivery note item
 */
router.patch(
  '/:id/items/:itemId',
  authorize(Permission.DELIVERY_NOTE_UPDATE),
  async (req, res) => {
    const { id, itemId } = req.params;

    try {
      const validatedInput = UpdateDeliveryNoteItemSchema.parse(req.body);

      const deliveryNote = await deliveryNoteService.updateDeliveryNoteItem(
        id,
        itemId,
        validatedInput
      );

      res.json({
        id: deliveryNote.id,
        deliveryNoteNumber: deliveryNote.deliveryNoteNumber,
        status: deliveryNote.status.value,
        items: deliveryNote.getItems().map(item => ({
          id: item.id,
          purchaseOrderItemId: item.purchaseOrderItemId,
          quantityDelivered: item.quantityDelivered,
          orderedQuantity: item.orderedQuantity,
          condition: item.condition.value,
          notes: item.notes,
        })),
        updatedAt: deliveryNote.updatedAt.toISOString(),
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({ error: error.message });
        }
        if (error.message.includes('DRAFT')) {
          return res.status(400).json({ error: error.message });
        }
      }
      logger.error({ err: error, deliveryNoteId: id, itemId }, 'Failed to update item');
      res.status(500).json({ error: 'Failed to update delivery note item' });
    }
  }
);

/**
 * POST /api/delivery-notes/:id/confirm
 * Confirm a delivery note (DRAFT -> CONFIRMED)
 */
router.post(
  '/:id/confirm',
  authorize(Permission.DELIVERY_NOTE_CONFIRM),
  async (req, res) => {
    const { id } = req.params;

    try {
      const deliveryNote = await deliveryNoteService.confirmDeliveryNote(id);

      res.json({
        id: deliveryNote.id,
        deliveryNoteNumber: deliveryNote.deliveryNoteNumber,
        status: deliveryNote.status.value,
        updatedAt: deliveryNote.updatedAt.toISOString(),
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({ error: error.message });
        }
        if (error.message.includes('already confirmed')) {
          return res.status(400).json({ error: error.message });
        }
      }
      logger.error({ err: error, deliveryNoteId: id }, 'Failed to confirm delivery note');
      res.status(500).json({ error: 'Failed to confirm delivery note' });
    }
  }
);

/**
 * POST /api/invoices/:invoiceId/delivery-notes
 * Link delivery notes to an invoice
 */
router.post(
  '/invoices/:invoiceId/delivery-notes',
  authorize(Permission.INVOICE_UPDATE),
  async (req, res) => {
    const { invoiceId } = req.params;

    try {
      const validatedInput = LinkDeliveryNotesToInvoiceSchema.parse(req.body);

      await deliveryNoteService.linkDeliveryNotesToInvoice(
        invoiceId,
        validatedInput.deliveryNoteIds
      );

      res.status(200).json({
        message: 'Delivery notes linked to invoice successfully',
        invoiceId,
        deliveryNoteIds: validatedInput.deliveryNoteIds,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({ error: error.message });
        }
        if (error.message.includes('must be CONFIRMED')) {
          return res.status(400).json({ error: error.message });
        }
      }
      logger.error({ err: error, invoiceId }, 'Failed to link delivery notes');
      res.status(500).json({ error: 'Failed to link delivery notes to invoice' });
    }
  }
);

/**
 * GET /api/invoices/:invoiceId/delivery-notes
 * Get all delivery notes linked to an invoice
 */
router.get(
  '/invoices/:invoiceId/delivery-notes',
  authorize(Permission.INVOICE_READ),
  async (req, res) => {
    const { invoiceId } = req.params;

    try {
      const deliveryNotes = await deliveryNoteService.getDeliveryNotesByInvoiceId(invoiceId);

      res.json({
        invoiceId,
        deliveryNotes: deliveryNotes.map(dn => ({
          id: dn.id,
          deliveryNoteNumber: dn.deliveryNoteNumber,
          status: dn.status.value,
          purchaseOrderId: dn.purchaseOrderId,
          vendorId: dn.vendorId,
          deliveryDate: dn.deliveryDate.toISOString(),
          itemCount: dn.itemCount,
        })),
      });
    } catch (error) {
      logger.error({ err: error, invoiceId }, 'Failed to get linked delivery notes');
      res.status(500).json({ error: 'Failed to retrieve delivery notes' });
    }
  }
);

export default router;
