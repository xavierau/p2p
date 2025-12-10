import { FileAttachment } from '../entities/FileAttachment';
import { VirusScanStatus } from '../value-objects/VirusScanStatus';

/**
 * Repository interface for FileAttachment aggregate.
 * Defines contract for persistence operations without coupling to implementation details.
 * Infrastructure layer will provide concrete implementation (e.g., PrismaFileAttachmentRepository).
 */
export interface IFileAttachmentRepository {
  /**
   * Persists a new file attachment.
   * @throws Error if file attachment with same ID already exists
   */
  save(fileAttachment: FileAttachment): Promise<void>;

  /**
   * Updates an existing file attachment.
   * Typically used only for virus scan status updates.
   * @throws Error if file attachment not found
   */
  update(fileAttachment: FileAttachment): Promise<void>;

  /**
   * Finds a file attachment by its ID.
   * @returns FileAttachment if found, null otherwise
   */
  findById(id: string): Promise<FileAttachment | null>;

  /**
   * Finds a file attachment by its S3 key.
   * @returns FileAttachment if found, null otherwise
   */
  findByS3Key(s3Key: string): Promise<FileAttachment | null>;

  /**
   * Finds all file attachments with a specific virus scan status.
   * @returns Array of file attachments (empty if none found)
   */
  findByVirusScanStatus(status: VirusScanStatus): Promise<FileAttachment[]>;

  /**
   * Finds all file attachments uploaded by a specific user.
   * @returns Array of file attachments (empty if none found)
   */
  findByUploadedBy(userId: string): Promise<FileAttachment[]>;

  /**
   * Finds file attachments within a date range.
   * @returns Array of file attachments (empty if none found)
   */
  findByUploadDateRange(startDate: Date, endDate: Date): Promise<FileAttachment[]>;

  /**
   * Finds all pending virus scans (status = PENDING).
   * Useful for batch processing or monitoring.
   * @returns Array of file attachments pending scan (empty if none found)
   */
  findPendingScans(): Promise<FileAttachment[]>;

  /**
   * Finds all infected files (status = INFECTED).
   * Useful for quarantine management.
   * @returns Array of infected file attachments (empty if none found)
   */
  findInfectedFiles(): Promise<FileAttachment[]>;

  /**
   * Checks if a file attachment exists by ID.
   * @returns true if exists, false otherwise
   */
  exists(id: string): Promise<boolean>;

  /**
   * Deletes a file attachment by ID.
   * Should also handle cleanup of associated records (links, versions).
   * @throws Error if file attachment not found
   */
  delete(id: string): Promise<void>;

  /**
   * Gets the total count of file attachments.
   * @returns Total count
   */
  count(): Promise<number>;

  /**
   * Gets the total storage used in bytes.
   * @returns Total size in bytes
   */
  getTotalStorageUsed(): Promise<number>;
}
