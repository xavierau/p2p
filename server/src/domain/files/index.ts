/**
 * Files Domain Layer Exports
 * Bounded context for file attachments, versioning, and storage.
 */

// Entities
export { FileAttachment } from './entities/FileAttachment';
export { FileVersion } from './entities/FileVersion';

// Value Objects
export { S3ObjectKey } from './value-objects/S3ObjectKey';
export { FileChecksum } from './value-objects/FileChecksum';
export { VirusScanStatus } from './value-objects/VirusScanStatus';
export { FileMetadata } from './value-objects/FileMetadata';

// Repository Interfaces
export { IFileAttachmentRepository } from './repositories/IFileAttachmentRepository';
export {
  IFileAttachmentLinkRepository,
  type EntityType,
  type FileAttachmentLink,
} from './repositories/IFileAttachmentLinkRepository';
export { IFileVersionRepository } from './repositories/IFileVersionRepository';

// Domain Events
export { FileUploadedEvent } from './events/FileUploadedEvent';
export { FileScanCompleteEvent } from './events/FileScanCompleteEvent';
export { FileReplacedEvent } from './events/FileReplacedEvent';
