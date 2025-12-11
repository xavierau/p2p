import { ValidationRuleType, ValidationSeverity } from '@prisma/client';
import { IValidationRule } from '../interfaces/IValidationRule';
import { ValidationContext } from '../types/ValidationContext';
import { ValidationResult } from '../value-objects/ValidationResult';
import { InvoiceWithRelations } from '../types/Invoice';

export class AmountThresholdExceededRule implements IValidationRule {
  ruleType = ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED;
  severity: ValidationSeverity = ValidationSeverity.WARNING;
  enabled = true;
  private threshold: number;

  constructor(
    private config: { enabled?: boolean; severity?: ValidationSeverity; threshold?: number } = {}
  ) {
    if (config.enabled !== undefined) this.enabled = config.enabled;
    if (config.severity) this.severity = config.severity;
    this.threshold = config.threshold || 10000;
  }

  async validate(invoice: InvoiceWithRelations, context: ValidationContext): Promise<ValidationResult> {
    if (invoice.totalAmount > this.threshold) {
      return ValidationResult.failed(
        this.ruleType,
        this.severity,
        {
          message: `Invoice amount ${invoice.totalAmount.toFixed(2)} exceeds threshold ${this.threshold.toFixed(2)}`,
          amount: invoice.totalAmount,
          threshold: this.threshold,
          excess: invoice.totalAmount - this.threshold
        }
      );
    }

    return ValidationResult.passed(
      this.ruleType,
      this.severity,
      { reason: 'Amount within threshold', amount: invoice.totalAmount, threshold: this.threshold }
    );
  }
}
