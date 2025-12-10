/**
 * Delivery Domain Layer Exports
 * Bounded context for delivery notes and goods receipt tracking.
 */

// Entities
export { DeliveryNote } from './entities/DeliveryNote';
export { DeliveryNoteItem } from './entities/DeliveryNoteItem';

// Value Objects
export { DeliveryNoteStatus } from './value-objects/DeliveryNoteStatus';
export { ItemCondition } from './value-objects/ItemCondition';
export { QuantityDiscrepancy } from './value-objects/QuantityDiscrepancy';

// Repository Interfaces
export { IDeliveryNoteRepository } from './repositories/IDeliveryNoteRepository';
export {
  IInvoiceDeliveryLinkRepository,
  type InvoiceDeliveryLink,
} from './repositories/IInvoiceDeliveryLinkRepository';

// Domain Events
export { DeliveryNoteCreatedEvent } from './events/DeliveryNoteCreatedEvent';
export { DeliveryNoteConfirmedEvent } from './events/DeliveryNoteConfirmedEvent';
