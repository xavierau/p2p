/**
 * FileReplacedEvent
 * Emitted when a file is replaced with a new version.
 * Can trigger cleanup of old S3 objects, notifications, or audit logging.
 */
export class FileReplacedEvent {
  readonly eventName = 'file.replaced';
  readonly timestamp: Date;

  constructor(
    readonly fileAttachmentId: string,
    readonly filename: string,
    readonly oldVersionNumber: number,
    readonly newVersionNumber: number,
    readonly oldS3Key: string,
    readonly newS3Key: string,
    readonly oldChecksum: string,
    readonly newChecksum: string,
    readonly replacedBy: string,
    readonly replacedAt: Date,
    readonly replacementReason: string | null
  ) {
    this.timestamp = new Date();
    Object.freeze(this);
  }

  /**
   * Checks if a replacement reason was provided.
   */
  hasReason(): boolean {
    return this.replacementReason !== null;
  }

  /**
   * Gets the version increment (should always be 1 for sequential versions).
   */
  getVersionIncrement(): number {
    return this.newVersionNumber - this.oldVersionNumber;
  }

  /**
   * Converts the event to a plain object for serialization.
   */
  toJSON(): Record<string, any> {
    return {
      eventName: this.eventName,
      timestamp: this.timestamp.toISOString(),
      fileAttachmentId: this.fileAttachmentId,
      filename: this.filename,
      oldVersionNumber: this.oldVersionNumber,
      newVersionNumber: this.newVersionNumber,
      oldS3Key: this.oldS3Key,
      newS3Key: this.newS3Key,
      oldChecksum: this.oldChecksum,
      newChecksum: this.newChecksum,
      replacedBy: this.replacedBy,
      replacedAt: this.replacedAt.toISOString(),
      replacementReason: this.replacementReason,
    };
  }
}
