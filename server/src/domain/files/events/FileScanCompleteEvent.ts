/**
 * FileScanCompleteEvent
 * Emitted when a virus scan completes (either CLEAN or INFECTED).
 * Can trigger notifications, quarantine actions, or downstream processing.
 */
export class FileScanCompleteEvent {
  readonly eventName = 'file.scan_complete';
  readonly timestamp: Date;

  constructor(
    readonly fileAttachmentId: string,
    readonly filename: string,
    readonly scanResult: 'CLEAN' | 'INFECTED',
    readonly s3Key: string,
    readonly scannedAt: Date
  ) {
    this.timestamp = new Date();
    Object.freeze(this);
  }

  /**
   * Checks if the file is safe (scan result is CLEAN).
   */
  isSafe(): boolean {
    return this.scanResult === 'CLEAN';
  }

  /**
   * Checks if the file is infected.
   */
  isInfected(): boolean {
    return this.scanResult === 'INFECTED';
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
      scanResult: this.scanResult,
      s3Key: this.s3Key,
      scannedAt: this.scannedAt.toISOString(),
      isSafe: this.isSafe(),
    };
  }
}
