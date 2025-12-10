import { FileVersion } from '../entities/FileVersion';

/**
 * Repository interface for FileVersion entity.
 * Manages historical versions of file attachments for audit trail.
 * Separated to follow Interface Segregation Principle.
 */
export interface IFileVersionRepository {
  /**
   * Persists a new file version.
   * @throws Error if file version with same ID already exists
   */
  save(fileVersion: FileVersion): Promise<void>;

  /**
   * Finds a file version by its ID.
   * @returns FileVersion if found, null otherwise
   */
  findById(id: string): Promise<FileVersion | null>;

  /**
   * Finds all versions for a specific file attachment.
   * Ordered by version number descending (newest first).
   * @returns Array of file versions (empty if none found)
   */
  findByFileAttachmentId(fileAttachmentId: string): Promise<FileVersion[]>;

  /**
   * Finds a specific version number for a file attachment.
   * @returns FileVersion if found, null otherwise
   */
  findByFileAttachmentIdAndVersion(
    fileAttachmentId: string,
    versionNumber: number
  ): Promise<FileVersion | null>;

  /**
   * Finds the latest version for a file attachment.
   * @returns FileVersion if found, null otherwise
   */
  findLatestByFileAttachmentId(fileAttachmentId: string): Promise<FileVersion | null>;

  /**
   * Finds all versions replaced by a specific user.
   * @returns Array of file versions (empty if none found)
   */
  findByReplacedBy(userId: string): Promise<FileVersion[]>;

  /**
   * Finds versions within a date range.
   * @returns Array of file versions (empty if none found)
   */
  findByReplacementDateRange(startDate: Date, endDate: Date): Promise<FileVersion[]>;

  /**
   * Gets the version count for a specific file attachment.
   * @returns Count of versions
   */
  countByFileAttachmentId(fileAttachmentId: string): Promise<number>;

  /**
   * Checks if a file attachment has any versions.
   * @returns true if versions exist, false otherwise
   */
  hasVersions(fileAttachmentId: string): Promise<boolean>;

  /**
   * Deletes all versions for a specific file attachment.
   * Should be called when deleting the file attachment.
   * @returns Count of deleted versions
   */
  deleteByFileAttachmentId(fileAttachmentId: string): Promise<number>;

  /**
   * Deletes a specific version.
   * Should only be used for cleanup/maintenance, not normal operations.
   * @throws Error if version not found
   */
  delete(id: string): Promise<void>;

  /**
   * Gets the total storage used by versions in bytes.
   * @returns Total size in bytes
   */
  getTotalStorageUsed(): Promise<number>;

  /**
   * Gets the total storage used by versions for a specific file attachment.
   * @returns Total size in bytes
   */
  getTotalStorageUsedByFileAttachment(fileAttachmentId: string): Promise<number>;
}
