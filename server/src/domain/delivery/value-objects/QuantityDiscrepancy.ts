import { ValidationError } from '../../shared/DomainError';

/**
 * Quantity Discrepancy Value Object
 * Represents the difference between ordered and delivered quantities.
 * Immutable - enforces business rules around quantity validation.
 */
export class QuantityDiscrepancy {
  private readonly _orderedQuantity: number;
  private readonly _deliveredQuantity: number;
  private readonly _discrepancy: number;
  private readonly _discrepancyPercentage: number;

  private constructor(orderedQuantity: number, deliveredQuantity: number) {
    this._orderedQuantity = orderedQuantity;
    this._deliveredQuantity = deliveredQuantity;
    this._discrepancy = orderedQuantity - deliveredQuantity;
    this._discrepancyPercentage = orderedQuantity > 0
      ? (this._discrepancy / orderedQuantity) * 100
      : 0;

    Object.freeze(this);
  }

  /**
   * Creates a QuantityDiscrepancy from ordered and delivered quantities.
   * @throws ValidationError if quantities are invalid (negative)
   */
  static create(orderedQuantity: number, deliveredQuantity: number): QuantityDiscrepancy {
    if (orderedQuantity < 0) {
      throw new ValidationError('Ordered quantity cannot be negative');
    }
    if (deliveredQuantity < 0) {
      throw new ValidationError('Delivered quantity cannot be negative');
    }

    return new QuantityDiscrepancy(orderedQuantity, deliveredQuantity);
  }

  /**
   * Creates a QuantityDiscrepancy with no discrepancy (perfect match).
   */
  static createExactMatch(quantity: number): QuantityDiscrepancy {
    if (quantity < 0) {
      throw new ValidationError('Quantity cannot be negative');
    }
    return new QuantityDiscrepancy(quantity, quantity);
  }

  /**
   * Checks if there is any discrepancy.
   */
  hasDiscrepancy(): boolean {
    return this._discrepancy !== 0;
  }

  /**
   * Checks if delivered quantity is less than ordered (under-delivery).
   */
  isUnderDelivery(): boolean {
    return this._discrepancy > 0;
  }

  /**
   * Checks if delivered quantity exceeds ordered (over-delivery).
   */
  isOverDelivery(): boolean {
    return this._discrepancy < 0;
  }

  /**
   * Checks if the discrepancy is within an acceptable threshold.
   * @param thresholdPercentage - Maximum acceptable discrepancy percentage
   */
  isWithinThreshold(thresholdPercentage: number): boolean {
    return Math.abs(this._discrepancyPercentage) <= thresholdPercentage;
  }

  /**
   * Checks if this is a complete delivery (no under-delivery).
   */
  isCompleteDelivery(): boolean {
    return this._deliveredQuantity >= this._orderedQuantity;
  }

  /**
   * Gets the absolute discrepancy value.
   */
  getAbsoluteDiscrepancy(): number {
    return Math.abs(this._discrepancy);
  }

  /**
   * Returns a human-readable description of the discrepancy.
   */
  getDescription(): string {
    if (!this.hasDiscrepancy()) {
      return 'Exact match';
    }

    const direction = this.isUnderDelivery() ? 'under-delivered' : 'over-delivered';
    return `${this.getAbsoluteDiscrepancy()} units ${direction} (${Math.abs(this._discrepancyPercentage).toFixed(2)}%)`;
  }

  /**
   * Value equality comparison.
   */
  equals(other: QuantityDiscrepancy): boolean {
    if (!(other instanceof QuantityDiscrepancy)) {
      return false;
    }
    return (
      this._orderedQuantity === other._orderedQuantity &&
      this._deliveredQuantity === other._deliveredQuantity
    );
  }

  get orderedQuantity(): number {
    return this._orderedQuantity;
  }

  get deliveredQuantity(): number {
    return this._deliveredQuantity;
  }

  get discrepancy(): number {
    return this._discrepancy;
  }

  get discrepancyPercentage(): number {
    return this._discrepancyPercentage;
  }
}
