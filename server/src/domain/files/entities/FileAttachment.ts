import { ValidationError, ImmutableEntityError } from '../../shared/DomainError';
import { S3ObjectKey } from '../value-objects/S3ObjectKey';
import { FileChecksum } from '../value-objects/FileChecksum';
import { VirusScanStatus } from '../value-objects/VirusScanStatus';
import { FileMetadata } from '../value-objects/FileMetadata';

/**
 * FileAttachment Aggregate Root
 * Represents an uploaded file with S3 storage, virus scanning, and versioning support.
 * Immutable after creation except for virus scan status updates.
 */
export class FileAttachment {
  private readonly _id: string;
  private readonly _s3Key: S3ObjectKey;
  private readonly _metadata: FileMetadata;
  private readonly _checksum: FileChecksum;
  private _virusScanStatus: VirusScanStatus;
  private readonly _uploadedBy: string;
  private readonly _uploadedAt: Date;
  private readonly _currentVersion: number;

  private constructor(props: {
    id: string;
    s3Key: S3ObjectKey;
    metadata: FileMetadata;
    checksum: FileChecksum;
    virusScanStatus: VirusScanStatus;
    uploadedBy: string;
    uploadedAt: Date;
    currentVersion: number;
  }) {
    this._id = props.id;
    this._s3Key = props.s3Key;
    this._metadata = props.metadata;
    this._checksum = props.checksum;
    this._virusScanStatus = props.virusScanStatus;
    this._uploadedBy = props.uploadedBy;
    this._uploadedAt = props.uploadedAt;
    this._currentVersion = props.currentVersion;

    this.validate();
  }

  /**
   * Factory method to create a new FileAttachment.
   * Automatically generates S3 key and sets initial PENDING virus scan status.
   * @throws ValidationError if validation fails
   */
  static create(props: {
    id: string;
    prefix: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    checksum: FileChecksum;
    uploadedBy: string;
  }): FileAttachment {
    const metadata = FileMetadata.create(props.filename, props.mimeType, props.sizeBytes);
    const s3Key = S3ObjectKey.generate(props.prefix, props.filename);
    const virusScanStatus = VirusScanStatus.createPending();
    const uploadedAt = new Date();
    const currentVersion = 1;

    return new FileAttachment({
      id: props.id,
      s3Key,
      metadata,
      checksum: props.checksum,
      virusScanStatus,
      uploadedBy: props.uploadedBy,
      uploadedAt,
      currentVersion,
    });
  }

  /**
   * Factory method to reconstitute a FileAttachment from persistence.
   * Used by repositories when loading from database.
   */
  static reconstitute(props: {
    id: string;
    s3Key: S3ObjectKey;
    metadata: FileMetadata;
    checksum: FileChecksum;
    virusScanStatus: VirusScanStatus;
    uploadedBy: string;
    uploadedAt: Date;
    currentVersion: number;
  }): FileAttachment {
    return new FileAttachment(props);
  }

  /**
   * Validates the file attachment invariants.
   * @throws ValidationError if validation fails
   */
  private validate(): void {
    if (!this._id || this._id.trim() === '') {
      throw new ValidationError('FileAttachment ID is required');
    }

    if (!this._uploadedBy || this._uploadedBy.trim() === '') {
      throw new ValidationError('Uploaded by is required');
    }

    if (!(this._uploadedAt instanceof Date) || isNaN(this._uploadedAt.getTime())) {
      throw new ValidationError('Valid upload date is required');
    }

    if (this._currentVersion < 1) {
      throw new ValidationError('Current version must be at least 1');
    }
  }

  /**
   * Marks the virus scan as complete with the result.
   * This is the ONLY allowed mutation after creation.
   * @throws ImmutableEntityError if scan already complete
   * @throws InvalidStateTransitionError if transition is invalid
   */
  markScanComplete(result: 'CLEAN' | 'INFECTED'): void {
    if (this._virusScanStatus.isScanComplete()) {
      throw new ImmutableEntityError(
        `File ${this._id} virus scan already complete with status: ${this._virusScanStatus.toString()}`
      );
    }

    const targetStatus = result === 'CLEAN'
      ? VirusScanStatus.createClean()
      : VirusScanStatus.createInfected();

    this._virusScanStatus.transitionTo(targetStatus);
    this._virusScanStatus = targetStatus;
  }

  /**
   * Checks if the file is safe to download/use.
   */
  isSafe(): boolean {
    return this._virusScanStatus.isSafe();
  }

  /**
   * Checks if the file is ready for use (scan complete and clean).
   */
  isReady(): boolean {
    return this._virusScanStatus.isClean();
  }

  /**
   * Checks if the file should be quarantined (infected).
   */
  isQuarantined(): boolean {
    return this._virusScanStatus.isInfected();
  }

  /**
   * Checks if the file is still pending scan.
   */
  isPendingScan(): boolean {
    return this._virusScanStatus.isPending();
  }

  /**
   * Gets the file extension.
   */
  getFileExtension(): string | null {
    return this._metadata.getFileExtension();
  }

  /**
   * Gets human-readable file size.
   */
  getHumanReadableSize(): string {
    return this._metadata.getHumanReadableSize();
  }

  /**
   * Checks if this is the original version (version 1).
   */
  isOriginalVersion(): boolean {
    return this._currentVersion === 1;
  }

  /**
   * Gets display information for UI.
   */
  getDisplayInfo(): {
    filename: string;
    size: string;
    uploadedBy: string;
    uploadedAt: Date;
    status: string;
    isSafe: boolean;
  } {
    return {
      filename: this._metadata.filename,
      size: this.getHumanReadableSize(),
      uploadedBy: this._uploadedBy,
      uploadedAt: this._uploadedAt,
      status: this._virusScanStatus.toString(),
      isSafe: this.isSafe(),
    };
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get s3Key(): S3ObjectKey {
    return this._s3Key;
  }

  get metadata(): FileMetadata {
    return this._metadata;
  }

  get checksum(): FileChecksum {
    return this._checksum;
  }

  get virusScanStatus(): VirusScanStatus {
    return this._virusScanStatus;
  }

  get uploadedBy(): string {
    return this._uploadedBy;
  }

  get uploadedAt(): Date {
    return this._uploadedAt;
  }

  get currentVersion(): number {
    return this._currentVersion;
  }

  get filename(): string {
    return this._metadata.filename;
  }

  get mimeType(): string {
    return this._metadata.mimeType;
  }

  get sizeBytes(): number {
    return this._metadata.sizeBytes;
  }
}
