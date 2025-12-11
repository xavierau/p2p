import { ValidationRuleType, ValidationSeverity } from '@prisma/client';

export class ValidationResult {
  private constructor(
    public readonly ruleType: ValidationRuleType,
    public readonly severity: ValidationSeverity,
    public readonly passed: boolean,
    public readonly details: Record<string, unknown>,
    public readonly metadata?: Record<string, unknown>
  ) {
    Object.freeze(this);
  }

  static passed(
    ruleType: ValidationRuleType,
    severity: ValidationSeverity,
    details: Record<string, unknown> = {},
    metadata?: Record<string, unknown>
  ): ValidationResult {
    return new ValidationResult(ruleType, severity, true, details, metadata);
  }

  static failed(
    ruleType: ValidationRuleType,
    severity: ValidationSeverity,
    details: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): ValidationResult {
    return new ValidationResult(ruleType, severity, false, details, metadata);
  }

  isBlocking(): boolean {
    return this.severity === ValidationSeverity.CRITICAL && !this.passed;
  }

  requiresReview(): boolean {
    return !this.passed && this.severity !== ValidationSeverity.INFO;
  }

  isPassed(): boolean {
    return this.passed;
  }
}

export interface InvoiceValidationSummary {
  invoiceId: number;
  isValid: boolean;
  hasBlockingIssues: boolean;
  flagCount: number;
  highestSeverity: ValidationSeverity | null;
  validations: ValidationResult[];
}
