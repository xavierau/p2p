import { ValidationError, InvalidStateTransitionError } from '../../shared/DomainError';

/**
 * VirusScanStatus Value Object
 * Represents the immutable virus scan status of a file with enforced transitions.
 */
export class VirusScanStatus {
  private static readonly VALID_STATUSES = ['PENDING', 'CLEAN', 'INFECTED'] as const;
  private static readonly VALID_TRANSITIONS: Record<string, string[]> = {
    PENDING: ['CLEAN', 'INFECTED'], // Can transition to either clean or infected
    CLEAN: [], // Terminal state
    INFECTED: [], // Terminal state
  };

  private constructor(private readonly _value: typeof VirusScanStatus.VALID_STATUSES[number]) {
    Object.freeze(this);
  }

  /**
   * Creates a VirusScanStatus from a string value.
   * @throws ValidationError if the status is invalid
   */
  static fromString(value: string): VirusScanStatus {
    if (!this.VALID_STATUSES.includes(value as any)) {
      throw new ValidationError(
        `Invalid virus scan status: ${value}. Valid statuses are: ${this.VALID_STATUSES.join(', ')}`
      );
    }
    return new VirusScanStatus(value as any);
  }

  /**
   * Creates a PENDING status (initial state for new uploads).
   */
  static createPending(): VirusScanStatus {
    return new VirusScanStatus('PENDING');
  }

  /**
   * Creates a CLEAN status.
   */
  static createClean(): VirusScanStatus {
    return new VirusScanStatus('CLEAN');
  }

  /**
   * Creates an INFECTED status.
   */
  static createInfected(): VirusScanStatus {
    return new VirusScanStatus('INFECTED');
  }

  /**
   * Validates if transition to target status is allowed.
   */
  canTransitionTo(targetStatus: VirusScanStatus): boolean {
    const allowedTransitions = VirusScanStatus.VALID_TRANSITIONS[this._value];
    return allowedTransitions.includes(targetStatus._value);
  }

  /**
   * Performs state transition with validation.
   * @throws InvalidStateTransitionError if transition is not allowed
   */
  transitionTo(targetStatus: VirusScanStatus): void {
    if (!this.canTransitionTo(targetStatus)) {
      throw new InvalidStateTransitionError(
        `Cannot transition virus scan status from ${this._value} to ${targetStatus._value}`
      );
    }
  }

  /**
   * Checks if the file is pending scan.
   */
  isPending(): boolean {
    return this._value === 'PENDING';
  }

  /**
   * Checks if the file is clean (scan complete, no threats).
   */
  isClean(): boolean {
    return this._value === 'CLEAN';
  }

  /**
   * Checks if the file is infected.
   */
  isInfected(): boolean {
    return this._value === 'INFECTED';
  }

  /**
   * Checks if the scan is complete (either clean or infected).
   */
  isScanComplete(): boolean {
    return this.isClean() || this.isInfected();
  }

  /**
   * Checks if the file is safe to download/use.
   */
  isSafe(): boolean {
    return this.isClean();
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
  equals(other: VirusScanStatus): boolean {
    if (!(other instanceof VirusScanStatus)) {
      return false;
    }
    return this._value === other._value;
  }

  get value(): string {
    return this._value;
  }
}
