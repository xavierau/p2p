import { ValidationRuleType, ValidationSeverity } from '@prisma/client';
import { IValidationRule } from '../interfaces/IValidationRule';
import { ValidationContext } from '../types/ValidationContext';
import { ValidationResult } from '../value-objects/ValidationResult';
import { InvoiceWithRelations } from '../types/Invoice';

export class RoundAmountPatternRule implements IValidationRule {
  ruleType = ValidationRuleType.ROUND_AMOUNT_PATTERN;
  severity: ValidationSeverity = ValidationSeverity.INFO;
  enabled = true;
  private minimumAmount: number;

  constructor(
    private config: { enabled?: boolean; severity?: ValidationSeverity; minimumAmount?: number } = {}
  ) {
    if (config.enabled !== undefined) this.enabled = config.enabled;
    if (config.severity) this.severity = config.severity;
    this.minimumAmount = config.minimumAmount || 1000;
  }

  async validate(invoice: InvoiceWithRelations, context: ValidationContext): Promise<ValidationResult> {
    // Check if amount is a round number (divisible by 100) and above minimum
    const isRound = invoice.totalAmount % 100 === 0;
    const aboveMinimum = invoice.totalAmount >= this.minimumAmount;

    if (isRound && aboveMinimum) {
      return ValidationResult.failed(
        this.ruleType,
        this.severity,
        {
          message: `Invoice has suspiciously round amount: ${invoice.totalAmount.toFixed(2)}`,
          amount: invoice.totalAmount,
          pattern: 'Round number (divisible by 100)',
          recommendation: 'Verify this is a legitimate invoice and not fraudulent'
        }
      );
    }

    return ValidationResult.passed(
      this.ruleType,
      this.severity,
      { reason: 'Amount is not suspiciously round', amount: invoice.totalAmount }
    );
  }
}
