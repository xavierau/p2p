/**
 * DeliveryNoteConfirmedEvent
 * Emitted when a delivery note is confirmed (transitioned from DRAFT to CONFIRMED).
 * Can trigger inventory updates, purchase order status updates, or quality checks.
 */
export class DeliveryNoteConfirmedEvent {
  readonly eventName = 'delivery_note.confirmed';
  readonly timestamp: Date;

  constructor(
    readonly deliveryNoteId: string,
    readonly deliveryNoteNumber: string,
    readonly purchaseOrderId: string,
    readonly vendorId: string,
    readonly totalQuantityDelivered: number,
    readonly totalEffectiveQuantity: number,
    readonly hasIssues: boolean,
    readonly confirmedBy: string,
    readonly confirmedAt: Date
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
      totalQuantityDelivered: this.totalQuantityDelivered,
      totalEffectiveQuantity: this.totalEffectiveQuantity,
      hasIssues: this.hasIssues,
      confirmedBy: this.confirmedBy,
      confirmedAt: this.confirmedAt.toISOString(),
    };
  }
}
