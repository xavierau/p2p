/**
 * FileUploadedEvent
 * Emitted when a new file is uploaded.
 * Can trigger virus scanning, notifications, or integration with external systems.
 */
export class FileUploadedEvent {
  readonly eventName = 'file.uploaded';
  readonly timestamp: Date;

  constructor(
    readonly fileAttachmentId: string,
    readonly filename: string,
    readonly mimeType: string,
    readonly sizeBytes: number,
    readonly s3Key: string,
    readonly uploadedBy: string,
    readonly uploadedAt: Date
  ) {
    this.timestamp = new Date();
    Object.freeze(this);
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
      mimeType: this.mimeType,
      sizeBytes: this.sizeBytes,
      s3Key: this.s3Key,
      uploadedBy: this.uploadedBy,
      uploadedAt: this.uploadedAt.toISOString(),
    };
  }
}
