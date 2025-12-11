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
import { ValidationRuleCache } from './ValidationRuleCache';

export class SuspiciousDetector {
  constructor(private ruleCache: ValidationRuleCache) {}

  async detectAnomalies(invoice: InvoiceWithRelations, context: ValidationContext): Promise<ValidationResult[]> {
    // Load active rules from cache (DB query only if cache expired)
    const activeRules = await this.ruleCache.getEnabledRules();

    // Create rule instances based on database config
    const rules: IValidationRule[] = [];

    for (const ruleConfig of activeRules) {
      // Skip duplicate rule (handled separately)
      if (ruleConfig.ruleType === 'DUPLICATE_INVOICE_NUMBER') continue;

      const config = {
        enabled: ruleConfig.enabled,
        severity: ruleConfig.severity,
        ...(ruleConfig.config as Record<string, unknown>)
      };

      switch (ruleConfig.ruleType) {
        case 'MISSING_INVOICE_NUMBER':
          rules.push(new MissingInvoiceNumberRule(config));
          break;
        case 'AMOUNT_THRESHOLD_EXCEEDED':
          rules.push(new AmountThresholdExceededRule(config));
          break;
        case 'ROUND_AMOUNT_PATTERN':
          rules.push(new RoundAmountPatternRule(config));
          break;
        case 'PO_AMOUNT_VARIANCE':
          rules.push(new POAmountVarianceRule(config));
          break;
        case 'PO_ITEM_MISMATCH':
          rules.push(new POItemMismatchRule(config));
          break;
        case 'DELIVERY_NOTE_MISMATCH':
          rules.push(new DeliveryNoteMismatchRule(config));
          break;
        case 'PRICE_VARIANCE':
          rules.push(new PriceVarianceRule(config));
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
