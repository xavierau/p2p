import { ValidationError } from '../../shared/DomainError';
import { S3ObjectKey } from '../value-objects/S3ObjectKey';
import { FileChecksum } from '../value-objects/FileChecksum';

/**
 * FileVersion Entity
 * Represents a historical version of a file attachment.
 * Immutable once created - maintains audit trail of file changes.
 */
export class FileVersion {
  private readonly _id: string;
  private readonly _fileAttachmentId: string;
  private readonly _versionNumber: number;
  private readonly _s3Key: S3ObjectKey;
  private readonly _checksum: FileChecksum;
  private readonly _sizeBytes: number;
  private readonly _replacedBy: string; // User ID who replaced this version
  private readonly _replacedAt: Date;
  private readonly _replacementReason: string | null;

  private constructor(props: {
    id: string;
    fileAttachmentId: string;
    versionNumber: number;
    s3Key: S3ObjectKey;
    checksum: FileChecksum;
    sizeBytes: number;
    replacedBy: string;
    replacedAt: Date;
    replacementReason: string | null;
  }) {
    this._id = props.id;
    this._fileAttachmentId = props.fileAttachmentId;
    this._versionNumber = props.versionNumber;
    this._s3Key = props.s3Key;
    this._checksum = props.checksum;
    this._sizeBytes = props.sizeBytes;
    this._replacedBy = props.replacedBy;
    this._replacedAt = props.replacedAt;
    this._replacementReason = props.replacementReason;

    this.validate();
    Object.freeze(this);
  }

  /**
   * Factory method to create a new FileVersion when a file is replaced.
   * @throws ValidationError if validation fails
   */
  static create(props: {
    id: string;
    fileAttachmentId: string;
    versionNumber: number;
    s3Key: S3ObjectKey;
    checksum: FileChecksum;
    sizeBytes: number;
    replacedBy: string;
    replacementReason?: string | null;
  }): FileVersion {
    return new FileVersion({
      id: props.id,
      fileAttachmentId: props.fileAttachmentId,
      versionNumber: props.versionNumber,
      s3Key: props.s3Key,
      checksum: props.checksum,
      sizeBytes: props.sizeBytes,
      replacedBy: props.replacedBy,
      replacedAt: new Date(),
      replacementReason: props.replacementReason ?? null,
    });
  }

  /**
   * Factory method to reconstitute a FileVersion from persistence.
   * Used by repositories when loading from database.
   */
  static reconstitute(props: {
    id: string;
    fileAttachmentId: string;
    versionNumber: number;
    s3Key: S3ObjectKey;
    checksum: FileChecksum;
    sizeBytes: number;
    replacedBy: string;
    replacedAt: Date;
    replacementReason: string | null;
  }): FileVersion {
    return new FileVersion(props);
  }

  /**
   * Validates the file version invariants.
   * @throws ValidationError if validation fails
   */
  private validate(): void {
    if (!this._id || this._id.trim() === '') {
      throw new ValidationError('FileVersion ID is required');
    }

    if (!this._fileAttachmentId || this._fileAttachmentId.trim() === '') {
      throw new ValidationError('File attachment ID is required');
    }

    if (this._versionNumber < 1) {
      throw new ValidationError('Version number must be at least 1');
    }

    if (this._sizeBytes < 0) {
      throw new ValidationError('File size cannot be negative');
    }

    if (!this._replacedBy || this._replacedBy.trim() === '') {
      throw new ValidationError('Replaced by is required');
    }

    if (!(this._replacedAt instanceof Date) || isNaN(this._replacedAt.getTime())) {
      throw new ValidationError('Valid replacement date is required');
    }

    if (this._replacementReason !== null && this._replacementReason.trim() === '') {
      throw new ValidationError('Replacement reason cannot be empty string (use null instead)');
    }
  }

  /**
   * Checks if this version has a documented reason for replacement.
   */
  hasReplacementReason(): boolean {
    return this._replacementReason !== null;
  }

  /**
   * Gets the S3 key for this historical version.
   */
  getS3Key(): string {
    return this._s3Key.toString();
  }

  /**
   * Gets human-readable file size.
   */
  getHumanReadableSize(): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = this._sizeBytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Gets display information for UI.
   */
  getDisplayInfo(): {
    versionNumber: number;
    size: string;
    replacedBy: string;
    replacedAt: Date;
    reason: string | null;
  } {
    return {
      versionNumber: this._versionNumber,
      size: this.getHumanReadableSize(),
      replacedBy: this._replacedBy,
      replacedAt: this._replacedAt,
      reason: this._replacementReason,
    };
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get fileAttachmentId(): string {
    return this._fileAttachmentId;
  }

  get versionNumber(): number {
    return this._versionNumber;
  }

  get s3Key(): S3ObjectKey {
    return this._s3Key;
  }

  get checksum(): FileChecksum {
    return this._checksum;
  }

  get sizeBytes(): number {
    return this._sizeBytes;
  }

  get replacedBy(): string {
    return this._replacedBy;
  }

  get replacedAt(): Date {
    return this._replacedAt;
  }

  get replacementReason(): string | null {
    return this._replacementReason;
  }
}
