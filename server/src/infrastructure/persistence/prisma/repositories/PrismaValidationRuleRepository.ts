/**
 * Prisma Validation Rule Repository Implementation
 *
 * Infrastructure layer implementation of IValidationRuleRepository using Prisma.
 */

import { ValidationRuleType, ValidationSeverity } from '@prisma/client';
import {
  IValidationRuleRepository,
  ValidationRule,
} from '../../../../domain/validation/repositories/IValidationRuleRepository';

export class PrismaValidationRuleRepository implements IValidationRuleRepository {
  constructor(private prisma: any) {}

  async findAll(): Promise<ValidationRule[]> {
    const rules = await this.prisma.validationRule.findMany({
      orderBy: { ruleType: 'asc' },
    });

    return rules as ValidationRule[];
  }

  async findEnabled(): Promise<ValidationRule[]> {
    const rules = await this.prisma.validationRule.findMany({
      where: { enabled: true },
    });

    return rules as ValidationRule[];
  }

  async findById(id: number): Promise<ValidationRule | null> {
    const rule = await this.prisma.validationRule.findUnique({
      where: { id },
    });

    return rule as ValidationRule | null;
  }

  async findByType(ruleType: ValidationRuleType): Promise<ValidationRule | null> {
    const rule = await this.prisma.validationRule.findFirst({
      where: { ruleType },
    });

    return rule as ValidationRule | null;
  }

  async update(
    id: number,
    data: {
      enabled?: boolean;
      severity?: ValidationSeverity;
      config?: any;
    }
  ): Promise<ValidationRule> {
    const rule = await this.prisma.validationRule.update({
      where: { id },
      data,
    });

    return rule as ValidationRule;
  }
}
