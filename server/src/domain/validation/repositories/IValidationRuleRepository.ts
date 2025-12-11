/**
 * Validation Rule Repository Interface
 *
 * Domain layer interface for validation rule data access.
 * Decouples domain logic from persistence implementation.
 */

import { ValidationRuleType, ValidationSeverity } from '@prisma/client';

export interface ValidationRule {
  id: number;
  ruleType: ValidationRuleType;
  name: string;
  description: string | null;
  enabled: boolean;
  severity: ValidationSeverity;
  config: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IValidationRuleRepository {
  /**
   * Find all validation rules
   */
  findAll(): Promise<ValidationRule[]>;

  /**
   * Find all enabled validation rules
   */
  findEnabled(): Promise<ValidationRule[]>;

  /**
   * Find validation rule by ID
   */
  findById(id: number): Promise<ValidationRule | null>;

  /**
   * Find validation rule by type
   */
  findByType(ruleType: ValidationRuleType): Promise<ValidationRule | null>;

  /**
   * Update validation rule
   */
  update(
    id: number,
    data: {
      enabled?: boolean;
      severity?: ValidationSeverity;
      config?: Record<string, unknown>;
    }
  ): Promise<ValidationRule>;
}
