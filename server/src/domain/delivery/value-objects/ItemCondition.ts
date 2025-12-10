import { ValidationError } from '../../shared/DomainError';

/**
 * Item Condition Value Object
 * Represents the physical condition of delivered items.
 */
export class ItemCondition {
  private static readonly VALID_CONDITIONS = [
    'GOOD',
    'DAMAGED',
    'PARTIAL',
    'REJECTED'
  ] as const;

  private constructor(private readonly _value: typeof ItemCondition.VALID_CONDITIONS[number]) {
    Object.freeze(this);
  }

  /**
   * Creates an ItemCondition from a string value.
   * @throws ValidationError if the condition is invalid
   */
  static fromString(value: string): ItemCondition {
    if (!this.VALID_CONDITIONS.includes(value as any)) {
      throw new ValidationError(
        `Invalid item condition: ${value}. Valid conditions are: ${this.VALID_CONDITIONS.join(', ')}`
      );
    }
    return new ItemCondition(value as any);
  }

  /**
   * Creates a GOOD condition (default for new deliveries).
   */
  static createGood(): ItemCondition {
    return new ItemCondition('GOOD');
  }

  /**
   * Creates a DAMAGED condition.
   */
  static createDamaged(): ItemCondition {
    return new ItemCondition('DAMAGED');
  }

  /**
   * Creates a PARTIAL condition.
   */
  static createPartial(): ItemCondition {
    return new ItemCondition('PARTIAL');
  }

  /**
   * Creates a REJECTED condition.
   */
  static createRejected(): ItemCondition {
    return new ItemCondition('REJECTED');
  }

  /**
   * Checks if the item is in good condition.
   */
  isGood(): boolean {
    return this._value === 'GOOD';
  }

  /**
   * Checks if the item has any issues (damaged, partial, or rejected).
   */
  hasIssues(): boolean {
    return this._value !== 'GOOD';
  }

  /**
   * Checks if the item was rejected.
   */
  isRejected(): boolean {
    return this._value === 'REJECTED';
  }

  /**
   * Returns the string representation of the condition.
   */
  toString(): string {
    return this._value;
  }

  /**
   * Value equality comparison.
   */
  equals(other: ItemCondition): boolean {
    if (!(other instanceof ItemCondition)) {
      return false;
    }
    return this._value === other._value;
  }

  get value(): string {
    return this._value;
  }
}
