import { ValidationError } from '../../shared/DomainError';
import { randomUUID } from 'crypto';

/**
 * S3ObjectKey Value Object
 * Represents an immutable S3 object key with UUID-based naming for uniqueness.
 * Format: {prefix}/{uuid}/{filename}
 */
export class S3ObjectKey {
  private readonly _key: string;
  private readonly _prefix: string;
  private readonly _uuid: string;
  private readonly _filename: string;

  private constructor(prefix: string, uuid: string, filename: string) {
    this._prefix = prefix;
    this._uuid = uuid;
    this._filename = filename;
    this._key = `${prefix}/${uuid}/${filename}`;

    Object.freeze(this);
  }

  /**
   * Creates a new S3ObjectKey with a generated UUID.
   * @param prefix - The S3 key prefix (e.g., 'invoices', 'delivery-notes')
   * @param filename - The original filename
   * @throws ValidationError if inputs are invalid
   */
  static generate(prefix: string, filename: string): S3ObjectKey {
    if (!prefix || prefix.trim() === '') {
      throw new ValidationError('S3 prefix cannot be empty');
    }

    if (!filename || filename.trim() === '') {
      throw new ValidationError('Filename cannot be empty');
    }

    if (prefix.includes('/')) {
      throw new ValidationError('Prefix cannot contain forward slashes');
    }

    // Sanitize filename to prevent path traversal
    const sanitizedFilename = filename.replace(/[\/\\]/g, '_');

    const uuid = randomUUID();
    return new S3ObjectKey(prefix, uuid, sanitizedFilename);
  }

  /**
   * Reconstitutes an S3ObjectKey from a stored key string.
   * Used when loading from database.
   * @throws ValidationError if key format is invalid
   */
  static fromString(key: string): S3ObjectKey {
    if (!key || key.trim() === '') {
      throw new ValidationError('S3 key cannot be empty');
    }

    const parts = key.split('/');
    if (parts.length !== 3) {
      throw new ValidationError(
        `Invalid S3 key format: ${key}. Expected format: prefix/uuid/filename`
      );
    }

    const [prefix, uuid, filename] = parts;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) {
      throw new ValidationError(`Invalid UUID in S3 key: ${uuid}`);
    }

    return new S3ObjectKey(prefix, uuid, filename);
  }

  /**
   * Gets the full S3 object key.
   */
  toString(): string {
    return this._key;
  }

  /**
   * Gets just the filename portion.
   */
  getFilename(): string {
    return this._filename;
  }

  /**
   * Gets the prefix portion.
   */
  getPrefix(): string {
    return this._prefix;
  }

  /**
   * Gets the UUID portion.
   */
  getUUID(): string {
    return this._uuid;
  }

  /**
   * Value equality comparison.
   */
  equals(other: S3ObjectKey): boolean {
    if (!(other instanceof S3ObjectKey)) {
      return false;
    }
    return this._key === other._key;
  }

  get value(): string {
    return this._key;
  }
}
