import { z } from 'zod';
import { sanitizedString, optionalSanitizedString } from '../schemas';

/**
 * Zod schemas for DeliveryNote validation.
 * Validates API inputs for delivery note operations.
 */

// ============================================================================
// Enums
// ============================================================================

export const DeliveryNoteStatusSchema = z.enum(['DRAFT', 'CONFIRMED']);
export type DeliveryNoteStatusType = z.infer<typeof DeliveryNoteStatusSchema>;

export const ItemConditionSchema = z.enum(['GOOD', 'DAMAGED', 'PARTIAL']);
export type ItemConditionType = z.infer<typeof ItemConditionSchema>;

// ============================================================================
// Delivery Note Item Schema
// ============================================================================

export const DeliveryNoteItemSchema = z.object({
  purchaseOrderItemId: z.string().min(1, 'Purchase order item ID is required'),
  quantityReceived: z.number().int().positive('Quantity received must be positive'),
  condition: ItemConditionSchema,
  notes: optionalSanitizedString(500),
});

export type DeliveryNoteItemInput = z.infer<typeof DeliveryNoteItemSchema>;

// ============================================================================
// Create Delivery Note Schema
// ============================================================================

export const CreateDeliveryNoteSchema = z.object({
  deliveryNoteNumber: z.string().min(1, 'Delivery note number is required').max(50).transform(val => val.trim()),
  purchaseOrderId: z.string().min(1, 'Purchase order ID is required'),
  vendorId: z.string().min(1, 'Vendor ID is required'),
  deliveryDate: z.string().datetime('Invalid delivery date format').or(z.date()),
  notes: optionalSanitizedString(1000),
  items: z.array(DeliveryNoteItemSchema).min(1, 'At least one item is required'),
});

export type CreateDeliveryNoteInput = z.infer<typeof CreateDeliveryNoteSchema>;

// ============================================================================
// Update Delivery Note Item Schema
// ============================================================================

export const UpdateDeliveryNoteItemSchema = z.object({
  quantityReceived: z.number().int().positive('Quantity received must be positive').optional(),
  condition: ItemConditionSchema.optional(),
  notes: optionalSanitizedString(500),
});

export type UpdateDeliveryNoteItemInput = z.infer<typeof UpdateDeliveryNoteItemSchema>;

// ============================================================================
// Confirm Delivery Note Schema
// ============================================================================

export const ConfirmDeliveryNoteSchema = z.object({
  confirmedBy: z.string().min(1, 'Confirmed by is required'),
});

export type ConfirmDeliveryNoteInput = z.infer<typeof ConfirmDeliveryNoteSchema>;

// ============================================================================
// Link Delivery Notes to Invoice Schema
// ============================================================================

export const LinkDeliveryNotesToInvoiceSchema = z.object({
  deliveryNoteIds: z.array(z.string().min(1)).min(1, 'At least one delivery note ID is required'),
});

export type LinkDeliveryNotesToInvoiceInput = z.infer<typeof LinkDeliveryNotesToInvoiceSchema>;

// ============================================================================
// Query Filters Schema
// ============================================================================

export const DeliveryNoteFiltersSchema = z.object({
  purchaseOrderId: z.string().optional(),
  vendorId: z.string().optional(),
  status: DeliveryNoteStatusSchema.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

export type DeliveryNoteFiltersInput = z.infer<typeof DeliveryNoteFiltersSchema>;
