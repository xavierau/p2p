/**
 * DeliveryNoteCreatedEvent
 * Emitted when a new delivery note is created.
 * Can trigger notifications, inventory updates, or integration with external systems.
 */
export class DeliveryNoteCreatedEvent {
  readonly eventName = 'delivery_note.created';
  readonly timestamp: Date;

  constructor(
    readonly deliveryNoteId: string,
    readonly deliveryNoteNumber: string,
    readonly purchaseOrderId: string,
    readonly vendorId: string,
    readonly receivedBy: string,
    readonly deliveryDate: Date,
    readonly totalQuantityDelivered: number,
    readonly itemCount: number
  ) {
    this.timestamp = new Date();
    Object.freeze(this);
  }

  /**
   * Converts the event to a plain object for serialization.
   */
  toJSON(): Record<string, any> {
    return {
      eventName: this.eventName,
      timestamp: this.timestamp.toISOString(),
      deliveryNoteId: this.deliveryNoteId,
      deliveryNoteNumber: this.deliveryNoteNumber,
      purchaseOrderId: this.purchaseOrderId,
      vendorId: this.vendorId,
      receivedBy: this.receivedBy,
      deliveryDate: this.deliveryDate.toISOString(),
      totalQuantityDelivered: this.totalQuantityDelivered,
      itemCount: this.itemCount,
    };
  }
}
