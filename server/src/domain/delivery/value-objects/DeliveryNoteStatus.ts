import { ValidationError, InvalidStateTransitionError } from '../../shared/DomainError';

/**
 * Delivery Note Status Value Object
 * Represents the immutable state of a delivery note with enforced transitions.
 */
export class DeliveryNoteStatus {
  private static readonly VALID_STATUSES = ['DRAFT', 'CONFIRMED'] as const;
  private static readonly VALID_TRANSITIONS: Record<string, string[]> = {
    DRAFT: ['CONFIRMED'],
    CONFIRMED: [], // Terminal state - no further transitions allowed
  };

  private constructor(private readonly _value: typeof DeliveryNoteStatus.VALID_STATUSES[number]) {
    Object.freeze(this);
  }

  /**
   * Creates a DeliveryNoteStatus from a string value.
   * @throws ValidationError if the status is invalid
   */
  static fromString(value: string): DeliveryNoteStatus {
    if (!this.VALID_STATUSES.includes(value as any)) {
      throw new ValidationError(
        `Invalid delivery note status: ${value}. Valid statuses are: ${this.VALID_STATUSES.join(', ')}`
      );
    }
    return new DeliveryNoteStatus(value as any);
  }

  /**
   * Creates a new DRAFT status (initial state).
   */
  static createDraft(): DeliveryNoteStatus {
    return new DeliveryNoteStatus('DRAFT');
  }

  /**
   * Creates a CONFIRMED status.
   */
  static createConfirmed(): DeliveryNoteStatus {
    return new DeliveryNoteStatus('CONFIRMED');
  }

  /**
   * Validates if transition to target status is allowed.
   * @throws InvalidStateTransitionError if transition is not allowed
   */
  canTransitionTo(targetStatus: DeliveryNoteStatus): boolean {
    const allowedTransitions = DeliveryNoteStatus.VALID_TRANSITIONS[this._value];
    return allowedTransitions.includes(targetStatus._value);
  }

  /**
   * Performs state transition with validation.
   * @throws InvalidStateTransitionError if transition is not allowed
   */
  transitionTo(targetStatus: DeliveryNoteStatus): void {
    if (!this.canTransitionTo(targetStatus)) {
      throw new InvalidStateTransitionError(
        `Cannot transition from ${this._value} to ${targetStatus._value}`
      );
    }
  }

  /**
   * Checks if the delivery note is in DRAFT state (modifiable).
   */
  isDraft(): boolean {
    return this._value === 'DRAFT';
  }

  /**
   * Checks if the delivery note is CONFIRMED (immutable).
   */
  isConfirmed(): boolean {
    return this._value === 'CONFIRMED';
  }

  /**
   * Returns the string representation of the status.
   */
  toString(): string {
    return this._value;
  }

  /**
   * Value equality comparison.
   */
  equals(other: DeliveryNoteStatus): boolean {
    if (!(other instanceof DeliveryNoteStatus)) {
      return false;
    }
    return this._value === other._value;
  }

  get value(): string {
    return this._value;
  }
}
