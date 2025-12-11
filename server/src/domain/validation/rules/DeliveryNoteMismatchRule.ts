import { ValidationRuleType, ValidationSeverity } from '@prisma/client';
import { IValidationRule } from '../interfaces/IValidationRule';
import { ValidationContext } from '../types/ValidationContext';
import { ValidationResult } from '../value-objects/ValidationResult';
import { InvoiceWithRelations } from '../types/Invoice';

export class DeliveryNoteMismatchRule implements IValidationRule {
  ruleType = ValidationRuleType.DELIVERY_NOTE_MISMATCH;
  severity: ValidationSeverity = ValidationSeverity.WARNING;
  enabled = true;

  constructor(
    private config: { enabled?: boolean; severity?: ValidationSeverity } = {}
  ) {
    if (config.enabled !== undefined) this.enabled = config.enabled;
    if (config.severity) this.severity = config.severity;
  }

  async validate(invoice: InvoiceWithRelations, context: ValidationContext): Promise<ValidationResult> {
    // Skip if no delivery notes linked
    if (!context.deliveryNotes || context.deliveryNotes.length === 0) {
      return ValidationResult.passed(
        this.ruleType,
        this.severity,
        { reason: 'No delivery notes linked to invoice' }
      );
    }

    // Aggregate delivered quantities by item
    const deliveredQuantities = new Map<number, number>();

    for (const dn of context.deliveryNotes) {
      for (const dnItem of dn.items || []) {
        const current = deliveredQuantities.get(dnItem.itemId) || 0;
        deliveredQuantities.set(dnItem.itemId, current + dnItem.quantityDelivered);
      }
    }

    // Check if any invoice items exceed delivered quantities
    const mismatches: Array<{
      itemId: number;
      invoicedQuantity: number;
      deliveredQuantity: number;
      excess: number;
    }> = [];

    for (const invoiceItem of invoice.items || []) {
      const delivered = deliveredQuantities.get(invoiceItem.itemId) || 0;

      if (invoiceItem.quantity > delivered) {
        mismatches.push({
          itemId: invoiceItem.itemId,
          invoicedQuantity: invoiceItem.quantity,
          deliveredQuantity: delivered,
          excess: invoiceItem.quantity - delivered
        });
      }
    }

    if (mismatches.length > 0) {
      return ValidationResult.failed(
        this.ruleType,
        this.severity,
        {
          message: `${mismatches.length} item(s) have invoice quantity exceeding delivered quantity`,
          mismatches,
          mismatchCount: mismatches.length,
          recommendation: 'Verify delivered quantities match invoice or wait for additional deliveries'
        }
      );
    }

    return ValidationResult.passed(
      this.ruleType,
      this.severity,
      { reason: 'All invoice quantities match or are less than delivered quantities' }
    );
  }
}
