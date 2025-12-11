import { ValidationRuleType, ValidationSeverity } from '@prisma/client';
import { ValidationContext } from '../types/ValidationContext';
import { ValidationResult } from '../value-objects/ValidationResult';
import { InvoiceWithRelations } from '../types/Invoice';

export interface IValidationRule {
  ruleType: ValidationRuleType;
  severity: ValidationSeverity;
  enabled: boolean;

  /**
   * Validate an invoice against this rule
   * @param invoice - Invoice with all relations loaded
   * @param context - Validation context with supporting data
   * @returns ValidationResult indicating pass/fail with details
   */
  validate(invoice: InvoiceWithRelations, context: ValidationContext): Promise<ValidationResult>;
}
