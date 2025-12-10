import { ValidationError } from '../../shared/DomainError';

/**
 * FileChecksum Value Object
 * Represents a SHA-256 checksum for file integrity verification.
 * Immutable and ensures valid checksum format.
 */
export class FileChecksum {
  private static readonly SHA256_LENGTH = 64;
  private static readonly HEX_PATTERN = /^[a-f0-9]{64}$/i;

  private readonly _value: string;

  private constructor(value: string) {
    this._value = value.toLowerCase();
    Object.freeze(this);
  }

  /**
   * Creates a FileChecksum from a SHA-256 hash string.
   * @throws ValidationError if checksum is invalid
   */
  static fromString(checksum: string): FileChecksum {
    if (!checksum || checksum.trim() === '') {
      throw new ValidationError('Checksum cannot be empty');
    }

    const normalized = checksum.trim().toLowerCase();

    if (normalized.length !== FileChecksum.SHA256_LENGTH) {
      throw new ValidationError(
        `Invalid checksum length: expected ${FileChecksum.SHA256_LENGTH} characters, got ${normalized.length}`
      );
    }

    if (!FileChecksum.HEX_PATTERN.test(normalized)) {
      throw new ValidationError(
        'Invalid checksum format: must be a valid SHA-256 hexadecimal string'
      );
    }

    return new FileChecksum(normalized);
  }

  /**
   * Returns the checksum string value.
   */
  toString(): string {
    return this._value;
  }

  /**
   * Value equality comparison.
   */
  equals(other: FileChecksum): boolean {
    if (!(other instanceof FileChecksum)) {
      return false;
    }
    return this._value === other._value;
  }

  /**
   * Verifies if another checksum matches this one.
   * Useful for integrity verification.
   */
  matches(other: FileChecksum): boolean {
    return this.equals(other);
  }

  get value(): string {
    return this._value;
  }
}
