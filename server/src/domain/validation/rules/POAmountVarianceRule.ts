import { ValidationRuleType, ValidationSeverity } from '@prisma/client';
import { IValidationRule } from '../interfaces/IValidationRule';
import { ValidationContext } from '../types/ValidationContext';
import { ValidationResult } from '../value-objects/ValidationResult';
import { InvoiceWithRelations } from '../types/Invoice';

export class POAmountVarianceRule implements IValidationRule {
  ruleType = ValidationRuleType.PO_AMOUNT_VARIANCE;
  severity: ValidationSeverity = ValidationSeverity.WARNING;
  enabled = true;
  private variancePercent: number;

  constructor(
    private config: { enabled?: boolean; severity?: ValidationSeverity; variancePercent?: number } = {}
  ) {
    if (config.enabled !== undefined) this.enabled = config.enabled;
    if (config.severity) this.severity = config.severity;
    this.variancePercent = config.variancePercent || 10;
  }

  async validate(invoice: InvoiceWithRelations, context: ValidationContext): Promise<ValidationResult> {
    // Skip if no PO linked
    if (!context.purchaseOrder) {
      return ValidationResult.passed(
        this.ruleType,
        this.severity,
        { reason: 'No purchase order linked to invoice' }
      );
    }

    const po = context.purchaseOrder;

    // Calculate PO total from items
    const poTotal = po.items?.reduce((sum: number, item) =>
      sum + (item.price * item.quantity), 0) || 0;

    // Calculate variance
    const variance = Math.abs(invoice.totalAmount - poTotal);
    const variancePercent = poTotal > 0 ? (variance / poTotal) * 100 : 0;

    if (variancePercent > this.variancePercent) {
      return ValidationResult.failed(
        this.ruleType,
        this.severity,
        {
          message: `Invoice amount varies ${variancePercent.toFixed(2)}% from purchase order`,
          invoiceAmount: invoice.totalAmount,
          poAmount: poTotal,
          variance: variance,
          variancePercent: variancePercent,
          threshold: this.variancePercent,
          purchaseOrderId: po.id
        }
      );
    }

    return ValidationResult.passed(
      this.ruleType,
      this.severity,
      {
        reason: 'Amount variance within acceptable range',
        invoiceAmount: invoice.totalAmount,
        poAmount: poTotal,
        variancePercent: variancePercent
      }
    );
  }
}
