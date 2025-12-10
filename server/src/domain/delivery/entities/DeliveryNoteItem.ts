import { ValidationError } from '../../shared/DomainError';
import { ItemCondition } from '../value-objects/ItemCondition';
import { QuantityDiscrepancy } from '../value-objects/QuantityDiscrepancy';

/**
 * DeliveryNoteItem Entity
 * Represents a single line item in a delivery note with quantity tracking and condition.
 * Immutable once created - part of DeliveryNote aggregate.
 */
export class DeliveryNoteItem {
  private readonly _id: string;
  private readonly _deliveryNoteId: string;
  private readonly _purchaseOrderItemId: string;
  private readonly _itemId: string;
  private readonly _quantityDelivered: number;
  private readonly _condition: ItemCondition;
  private readonly _notes: string | null;
  private readonly _orderedQuantity: number;
  private readonly _discrepancy: QuantityDiscrepancy;

  private constructor(props: {
    id: string;
    deliveryNoteId: string;
    purchaseOrderItemId: string;
    itemId: string;
    quantityDelivered: number;
    orderedQuantity: number;
    condition: ItemCondition;
    notes: string | null;
  }) {
    this._id = props.id;
    this._deliveryNoteId = props.deliveryNoteId;
    this._purchaseOrderItemId = props.purchaseOrderItemId;
    this._itemId = props.itemId;
    this._quantityDelivered = props.quantityDelivered;
    this._orderedQuantity = props.orderedQuantity;
    this._condition = props.condition;
    this._notes = props.notes;
    this._discrepancy = QuantityDiscrepancy.create(props.orderedQuantity, props.quantityDelivered);

    this.validate();
    Object.freeze(this);
  }

  /**
   * Factory method to create a new DeliveryNoteItem.
   * @throws ValidationError if validation fails
   */
  static create(props: {
    id: string;
    deliveryNoteId: string;
    purchaseOrderItemId: string;
    itemId: string;
    quantityDelivered: number;
    orderedQuantity: number;
    condition?: ItemCondition;
    notes?: string | null;
  }): DeliveryNoteItem {
    return new DeliveryNoteItem({
      id: props.id,
      deliveryNoteId: props.deliveryNoteId,
      purchaseOrderItemId: props.purchaseOrderItemId,
      itemId: props.itemId,
      quantityDelivered: props.quantityDelivered,
      orderedQuantity: props.orderedQuantity,
      condition: props.condition ?? ItemCondition.createGood(),
      notes: props.notes ?? null,
    });
  }

  /**
   * Validates the delivery note item invariants.
   * @throws ValidationError if validation fails
   */
  private validate(): void {
    if (!this._id || this._id.trim() === '') {
      throw new ValidationError('DeliveryNoteItem ID is required');
    }

    if (!this._deliveryNoteId || this._deliveryNoteId.trim() === '') {
      throw new ValidationError('Delivery note ID is required');
    }

    if (!this._purchaseOrderItemId || this._purchaseOrderItemId.trim() === '') {
      throw new ValidationError('Purchase order item ID is required');
    }

    if (!this._itemId || this._itemId.trim() === '') {
      throw new ValidationError('Item ID is required');
    }

    if (this._quantityDelivered < 0) {
      throw new ValidationError('Quantity delivered cannot be negative');
    }

    if (this._orderedQuantity < 0) {
      throw new ValidationError('Ordered quantity cannot be negative');
    }

    if (this._notes !== null && this._notes.trim() === '') {
      throw new ValidationError('Notes cannot be empty string (use null instead)');
    }
  }

  /**
   * Checks if this item has any delivery issues.
   */
  hasIssues(): boolean {
    return this._condition.hasIssues() || this._discrepancy.hasDiscrepancy();
  }

  /**
   * Checks if this item was rejected.
   */
  isRejected(): boolean {
    return this._condition.isRejected();
  }

  /**
   * Checks if delivered quantity matches ordered quantity.
   */
  hasExactQuantity(): boolean {
    return !this._discrepancy.hasDiscrepancy();
  }

  /**
   * Gets the effective quantity (considering rejections).
   * Rejected items contribute 0 to the effective quantity.
   */
  getEffectiveQuantity(): number {
    return this.isRejected() ? 0 : this._quantityDelivered;
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get deliveryNoteId(): string {
    return this._deliveryNoteId;
  }

  get purchaseOrderItemId(): string {
    return this._purchaseOrderItemId;
  }

  get itemId(): string {
    return this._itemId;
  }

  get quantityDelivered(): number {
    return this._quantityDelivered;
  }

  get orderedQuantity(): number {
    return this._orderedQuantity;
  }

  get condition(): ItemCondition {
    return this._condition;
  }

  get notes(): string | null {
    return this._notes;
  }

  get discrepancy(): QuantityDiscrepancy {
    return this._discrepancy;
  }
}
