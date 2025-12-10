import { ValidationError } from '../../shared/DomainError';

/**
 * FileMetadata Value Object
 * Encapsulates file metadata including name, MIME type, and size.
 * Enforces business rules like file size limits.
 */
export class FileMetadata {
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
  private static readonly VALID_MIME_TYPE_PATTERN = /^[a-z]+\/[a-z0-9\-\+\.]+$/i;

  private readonly _filename: string;
  private readonly _mimeType: string;
  private readonly _sizeBytes: number;

  private constructor(filename: string, mimeType: string, sizeBytes: number) {
    this._filename = filename;
    this._mimeType = mimeType;
    this._sizeBytes = sizeBytes;

    Object.freeze(this);
  }

  /**
   * Creates FileMetadata with validation.
   * @throws ValidationError if validation fails
   */
  static create(filename: string, mimeType: string, sizeBytes: number): FileMetadata {
    // Validate filename
    if (!filename || filename.trim() === '') {
      throw new ValidationError('Filename cannot be empty');
    }

    const sanitizedFilename = filename.trim();
    if (sanitizedFilename.length > 255) {
      throw new ValidationError('Filename cannot exceed 255 characters');
    }

    // Validate MIME type
    if (!mimeType || mimeType.trim() === '') {
      throw new ValidationError('MIME type cannot be empty');
    }

    const sanitizedMimeType = mimeType.trim().toLowerCase();
    if (!FileMetadata.VALID_MIME_TYPE_PATTERN.test(sanitizedMimeType)) {
      throw new ValidationError(`Invalid MIME type format: ${mimeType}`);
    }

    // Validate size
    if (sizeBytes < 0) {
      throw new ValidationError('File size cannot be negative');
    }

    if (sizeBytes === 0) {
      throw new ValidationError('File cannot be empty (0 bytes)');
    }

    if (sizeBytes > FileMetadata.MAX_FILE_SIZE) {
      throw new ValidationError(
        `File size exceeds maximum allowed size of ${FileMetadata.MAX_FILE_SIZE / (1024 * 1024)}MB`
      );
    }

    return new FileMetadata(sanitizedFilename, sanitizedMimeType, sizeBytes);
  }

  /**
   * Gets the file extension from the filename.
   * @returns The file extension (without dot) or null if no extension
   */
  getFileExtension(): string | null {
    const parts = this._filename.split('.');
    if (parts.length < 2) {
      return null;
    }
    return parts[parts.length - 1].toLowerCase();
  }

  /**
   * Checks if the file is an image based on MIME type.
   */
  isImage(): boolean {
    return this._mimeType.startsWith('image/');
  }

  /**
   * Checks if the file is a PDF.
   */
  isPDF(): boolean {
    return this._mimeType === 'application/pdf';
  }

  /**
   * Checks if the file is a document (PDF, Word, Excel, etc.).
   */
  isDocument(): boolean {
    const documentMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
    ];
    return documentMimeTypes.includes(this._mimeType);
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
   * Checks if file size is within a specific percentage of max allowed.
   * Useful for warnings.
   */
  isNearSizeLimit(thresholdPercentage: number = 90): boolean {
    return (this._sizeBytes / FileMetadata.MAX_FILE_SIZE) * 100 >= thresholdPercentage;
  }

  /**
   * Value equality comparison.
   */
  equals(other: FileMetadata): boolean {
    if (!(other instanceof FileMetadata)) {
      return false;
    }
    return (
      this._filename === other._filename &&
      this._mimeType === other._mimeType &&
      this._sizeBytes === other._sizeBytes
    );
  }

  get filename(): string {
    return this._filename;
  }

  get mimeType(): string {
    return this._mimeType;
  }

  get sizeBytes(): number {
    return this._sizeBytes;
  }

  static get MAX_SIZE(): number {
    return FileMetadata.MAX_FILE_SIZE;
  }
}
