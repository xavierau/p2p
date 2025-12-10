import { ValidationError, ImmutableEntityError, BusinessRuleViolationError } from '../../shared/DomainError';
import { DeliveryNoteStatus } from '../value-objects/DeliveryNoteStatus';
import { DeliveryNoteItem } from './DeliveryNoteItem';

/**
 * DeliveryNote Aggregate Root
 * Represents a delivery note tracking goods receipt against purchase orders.
 * Enforces business rules: must have at least one item, immutable when confirmed.
 */
export class DeliveryNote {
  private readonly _id: string;
  private readonly _deliveryNoteNumber: string;
  private readonly _purchaseOrderId: string;
  private readonly _vendorId: string;
  private readonly _receivedBy: string;
  private readonly _deliveryDate: Date;
  private _status: DeliveryNoteStatus;
  private readonly _notes: string | null;
  private readonly _createdAt: Date;
  private readonly _updatedAt: Date;
  private readonly _items: DeliveryNoteItem[];

  private constructor(props: {
    id: string;
    deliveryNoteNumber: string;
    purchaseOrderId: string;
    vendorId: string;
    receivedBy: string;
    deliveryDate: Date;
    status: DeliveryNoteStatus;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    items: DeliveryNoteItem[];
  }) {
    this._id = props.id;
    this._deliveryNoteNumber = props.deliveryNoteNumber;
    this._purchaseOrderId = props.purchaseOrderId;
    this._vendorId = props.vendorId;
    this._receivedBy = props.receivedBy;
    this._deliveryDate = props.deliveryDate;
    this._status = props.status;
    this._notes = props.notes;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._items = [...props.items]; // Defensive copy

    this.validate();
  }

  /**
   * Factory method to create a new DeliveryNote in DRAFT status.
   * @throws ValidationError if validation fails
   */
  static create(props: {
    id: string;
    deliveryNoteNumber: string;
    purchaseOrderId: string;
    vendorId: string;
    receivedBy: string;
    deliveryDate: Date;
    notes?: string | null;
    items: DeliveryNoteItem[];
  }): DeliveryNote {
    const now = new Date();

    return new DeliveryNote({
      id: props.id,
      deliveryNoteNumber: props.deliveryNoteNumber,
      purchaseOrderId: props.purchaseOrderId,
      vendorId: props.vendorId,
      receivedBy: props.receivedBy,
      deliveryDate: props.deliveryDate,
      status: DeliveryNoteStatus.createDraft(),
      notes: props.notes ?? null,
      createdAt: now,
      updatedAt: now,
      items: props.items,
    });
  }

  /**
   * Factory method to reconstitute a DeliveryNote from persistence.
   * Used by repositories when loading from database.
   */
  static reconstitute(props: {
    id: string;
    deliveryNoteNumber: string;
    purchaseOrderId: string;
    vendorId: string;
    receivedBy: string;
    deliveryDate: Date;
    status: DeliveryNoteStatus;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    items: DeliveryNoteItem[];
  }): DeliveryNote {
    return new DeliveryNote(props);
  }

  /**
   * Validates the delivery note invariants.
   * @throws ValidationError if validation fails
   */
  private validate(): void {
    if (!this._id || this._id.trim() === '') {
      throw new ValidationError('DeliveryNote ID is required');
    }

    if (!this._deliveryNoteNumber || this._deliveryNoteNumber.trim() === '') {
      throw new ValidationError('Delivery note number is required');
    }

    if (!this._purchaseOrderId || this._purchaseOrderId.trim() === '') {
      throw new ValidationError('Purchase order ID is required');
    }

    if (!this._vendorId || this._vendorId.trim() === '') {
      throw new ValidationError('Vendor ID is required');
    }

    if (!this._receivedBy || this._receivedBy.trim() === '') {
      throw new ValidationError('Received by is required');
    }

    if (!(this._deliveryDate instanceof Date) || isNaN(this._deliveryDate.getTime())) {
      throw new ValidationError('Valid delivery date is required');
    }

    if (this._items.length === 0) {
      throw new BusinessRuleViolationError('Delivery note must have at least one item');
    }

    if (this._notes !== null && this._notes.trim() === '') {
      throw new ValidationError('Notes cannot be empty string (use null instead)');
    }

    // Validate all items belong to this delivery note
    for (const item of this._items) {
      if (item.deliveryNoteId !== this._id) {
        throw new ValidationError(
          `Item ${item.id} does not belong to delivery note ${this._id}`
        );
      }
    }
  }

  /**
   * Ensures the delivery note is in DRAFT status (modifiable).
   * @throws ImmutableEntityError if the delivery note is confirmed
   */
  private ensureModifiable(): void {
    if (this._status.isConfirmed()) {
      throw new ImmutableEntityError(
        `Cannot modify delivery note ${this._deliveryNoteNumber} - already confirmed`
      );
    }
  }

  /**
   * Updates an existing delivery note item.
   * @throws ImmutableEntityError if the delivery note is confirmed
   * @throws ValidationError if item not found
   */
  updateItem(updatedItem: DeliveryNoteItem): void {
    this.ensureModifiable();

    const index = this._items.findIndex(item => item.id === updatedItem.id);
    if (index === -1) {
      throw new ValidationError(`Item ${updatedItem.id} not found in delivery note`);
    }

    if (updatedItem.deliveryNoteId !== this._id) {
      throw new ValidationError(
        `Cannot add item from different delivery note (expected ${this._id}, got ${updatedItem.deliveryNoteId})`
      );
    }

    this._items[index] = updatedItem;
    this.validate();
  }

  /**
   * Confirms the delivery note, making it immutable.
   * Transitions from DRAFT to CONFIRMED status.
   * @throws ImmutableEntityError if already confirmed
   * @throws BusinessRuleViolationError if business rules are violated
   */
  confirm(): void {
    if (this._status.isConfirmed()) {
      throw new ImmutableEntityError(
        `Delivery note ${this._deliveryNoteNumber} is already confirmed`
      );
    }

    if (this._items.length === 0) {
      throw new BusinessRuleViolationError(
        'Cannot confirm delivery note without items'
      );
    }

    const targetStatus = DeliveryNoteStatus.createConfirmed();
    this._status.transitionTo(targetStatus);
    this._status = targetStatus;
  }

  /**
   * Calculates the total quantity delivered across all items.
   */
  getTotalQuantityDelivered(): number {
    return this._items.reduce((total, item) => total + item.quantityDelivered, 0);
  }

  /**
   * Calculates the total effective quantity (excluding rejected items).
   */
  getTotalEffectiveQuantity(): number {
    return this._items.reduce((total, item) => total + item.getEffectiveQuantity(), 0);
  }

  /**
   * Checks if any items have delivery issues.
   */
  hasAnyIssues(): boolean {
    return this._items.some(item => item.hasIssues());
  }

  /**
   * Gets all items with issues (damaged, partial, rejected, or quantity discrepancies).
   */
  getItemsWithIssues(): DeliveryNoteItem[] {
    return this._items.filter(item => item.hasIssues());
  }

  /**
   * Checks if the delivery note can be confirmed.
   */
  canBeConfirmed(): boolean {
    return this._status.isDraft() && this._items.length > 0;
  }

  /**
   * Gets a defensive copy of items to prevent external modification.
   */
  getItems(): DeliveryNoteItem[] {
    return [...this._items];
  }

  /**
   * Finds an item by its ID.
   */
  findItemById(itemId: string): DeliveryNoteItem | undefined {
    return this._items.find(item => item.id === itemId);
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get deliveryNoteNumber(): string {
    return this._deliveryNoteNumber;
  }

  get purchaseOrderId(): string {
    return this._purchaseOrderId;
  }

  get vendorId(): string {
    return this._vendorId;
  }

  get receivedBy(): string {
    return this._receivedBy;
  }

  get deliveryDate(): Date {
    return this._deliveryDate;
  }

  get status(): DeliveryNoteStatus {
    return this._status;
  }

  get notes(): string | null {
    return this._notes;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get itemCount(): number {
    return this._items.length;
  }
}
