import { z } from 'zod';
import { sanitizedString, optionalSanitizedString } from '../schemas';

/**
 * Zod schemas for FileAttachment validation.
 * Validates API inputs for file attachment operations.
 */

// ============================================================================
// Enums
// ============================================================================

export const VirusScanStatusSchema = z.enum(['PENDING', 'CLEAN', 'INFECTED']);
export type VirusScanStatusType = z.infer<typeof VirusScanStatusSchema>;

export const EntityTypeSchema = z.enum([
  'DELIVERY_NOTE',
  'INVOICE',
  'PURCHASE_ORDER',
  'VENDOR',
]);
export type EntityTypeType = z.infer<typeof EntityTypeSchema>;

// ============================================================================
// File Size Validation
// ============================================================================

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// ============================================================================
// Upload URL Schema
// ============================================================================

export const UploadUrlSchema = z.object({
  filename: z.string().min(1, 'Filename is required').max(255).transform(val => val.trim()),
  contentType: z.string().min(1, 'Content type is required').regex(
    /^[a-z]+\/[a-z0-9\-\+\.]+$/i,
    'Invalid content type format'
  ),
  sizeBytes: z.number().int().positive('File size must be positive').max(
    MAX_FILE_SIZE_BYTES,
    `File size must not exceed ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`
  ),
});

export type UploadUrlInput = z.infer<typeof UploadUrlSchema>;

// ============================================================================
// Confirm Upload Schema
// ============================================================================

export const ConfirmUploadSchema = z.object({
  checksum: z.string().min(1, 'Checksum is required').regex(
    /^[a-f0-9]{64}$/i,
    'Checksum must be a valid SHA-256 hash'
  ),
});

export type ConfirmUploadInput = z.infer<typeof ConfirmUploadSchema>;

// ============================================================================
// Attach File Schema
// ============================================================================

export const AttachFileSchema = z.object({
  entityType: EntityTypeSchema,
  entityId: z.string().min(1, 'Entity ID is required'),
});

export type AttachFileInput = z.infer<typeof AttachFileSchema>;

// ============================================================================
// Detach File Schema
// ============================================================================

export const DetachFileSchema = z.object({
  entityType: EntityTypeSchema.optional(),
  entityId: z.string().optional(),
});

export type DetachFileInput = z.infer<typeof DetachFileSchema>;

// ============================================================================
// Replace File Schema
// ============================================================================

export const ReplaceFileSchema = z.object({
  filename: z.string().min(1, 'Filename is required').max(255).transform(val => val.trim()),
  contentType: z.string().min(1, 'Content type is required'),
  sizeBytes: z.number().int().positive('File size must be positive').max(
    MAX_FILE_SIZE_BYTES,
    `File size must not exceed ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`
  ),
  checksum: z.string().min(1, 'Checksum is required').regex(
    /^[a-f0-9]{64}$/i,
    'Checksum must be a valid SHA-256 hash'
  ),
});

export type ReplaceFileInput = z.infer<typeof ReplaceFileSchema>;

// ============================================================================
// Query Filters Schema
// ============================================================================

export const FileAttachmentFiltersSchema = z.object({
  entityType: EntityTypeSchema.optional(),
  entityId: z.string().optional(),
  uploadedBy: z.string().optional(),
  virusScanStatus: VirusScanStatusSchema.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

export type FileAttachmentFiltersInput = z.infer<typeof FileAttachmentFiltersSchema>;
