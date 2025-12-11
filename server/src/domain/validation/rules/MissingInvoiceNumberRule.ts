import { ValidationRuleType, ValidationSeverity } from '@prisma/client';
import { IValidationRule } from '../interfaces/IValidationRule';
import { ValidationContext } from '../types/ValidationContext';
import { ValidationResult } from '../value-objects/ValidationResult';
import { InvoiceWithRelations } from '../types/Invoice';

export class MissingInvoiceNumberRule implements IValidationRule {
  ruleType = ValidationRuleType.MISSING_INVOICE_NUMBER;
  severity: ValidationSeverity = ValidationSeverity.WARNING;
  enabled = true;

  constructor(
    private config: { enabled?: boolean; severity?: ValidationSeverity } = {}
  ) {
    if (config.enabled !== undefined) this.enabled = config.enabled;
    if (config.severity) this.severity = config.severity;
  }

  async validate(invoice: InvoiceWithRelations, context: ValidationContext): Promise<ValidationResult> {
    const isMissing = !invoice.invoiceNumber || invoice.invoiceNumber.trim() === '';

    if (isMissing) {
      return ValidationResult.failed(
        this.ruleType,
        this.severity,
        {
          message: 'Invoice number is missing',
          recommendation: 'Add invoice number for proper tracking and duplicate prevention'
        }
      );
    }

    return ValidationResult.passed(
      this.ruleType,
      this.severity,
      { reason: 'Invoice number provided' }
    );
  }
}
