import pubsub, { PubSubService } from '../services/pubsub';
import * as validationService from '../services/invoiceValidationService';

export const initializeValidationSubscribers = () => {
  // Subscribe to INVOICE_CREATED event
  pubsub.subscribe(PubSubService.INVOICE_CREATED, async (invoiceId: number) => {
    try {
      console.log(`Running validation for invoice ${invoiceId}`);
      await validationService.validateInvoice(invoiceId);
      console.log(`Validation completed for invoice ${invoiceId}`);
    } catch (error) {
      console.error(`Invoice validation failed for invoice ${invoiceId}:`, error);
    }
  });

  console.log('Invoice validation subscribers initialized');
};
