import { ValidationResult } from '../value-objects/ValidationResult';
import { ValidationContext } from '../types/ValidationContext';
import { IValidationRule } from '../interfaces/IValidationRule';
import { InvoiceWithRelations } from '../types/Invoice';
import { MissingInvoiceNumberRule } from '../rules/MissingInvoiceNumberRule';
import { AmountThresholdExceededRule } from '../rules/AmountThresholdExceededRule';
import { RoundAmountPatternRule } from '../rules/RoundAmountPatternRule';
import { POAmountVarianceRule } from '../rules/POAmountVarianceRule';
import { POItemMismatchRule } from '../rules/POItemMismatchRule';
import { DeliveryNoteMismatchRule } from '../rules/DeliveryNoteMismatchRule';
import { PriceVarianceRule } from '../rules/PriceVarianceRule';
import { ValidationConfigService } from './ValidationConfigService';
import { ValidationRuleType } from '@prisma/client';

export class SuspiciousDetector {
  constructor(private configService: ValidationConfigService) {}

  async detectAnomalies(invoice: InvoiceWithRelations, context: ValidationContext): Promise<ValidationResult[]> {
    // Load all rule configurations with env overrides applied
    const allConfigs = await this.configService.getAllRuleConfigs();

    // Create rule instances based on merged config (env + database)
    const rules: IValidationRule[] = [];

    for (const [ruleType, config] of allConfigs) {
      // Skip disabled rules
      if (!config.enabled) continue;

      // Skip duplicate rule (handled separately by DuplicateDetector)
      if (ruleType === ValidationRuleType.DUPLICATE_INVOICE_NUMBER) continue;

      // Instantiate rule based on type with merged config
      switch (ruleType) {
        case ValidationRuleType.MISSING_INVOICE_NUMBER:
          rules.push(new MissingInvoiceNumberRule(config));
          break;
        case ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED:
          rules.push(new AmountThresholdExceededRule(config));
          break;
        case ValidationRuleType.ROUND_AMOUNT_PATTERN:
          rules.push(new RoundAmountPatternRule(config));
          break;
        case ValidationRuleType.PRICE_VARIANCE:
          rules.push(new PriceVarianceRule(config));
          break;
        case ValidationRuleType.PO_AMOUNT_VARIANCE:
          rules.push(new POAmountVarianceRule(config));
          break;
        case ValidationRuleType.PO_ITEM_MISMATCH:
          rules.push(new POItemMismatchRule(config));
          break;
        case ValidationRuleType.DELIVERY_NOTE_MISMATCH:
          rules.push(new DeliveryNoteMismatchRule(config));
          break;
      }
    }

    // Execute all rules in parallel
    const results = await Promise.all(
      rules.map(rule => rule.validate(invoice, context))
    );

    return results;
  }
}
