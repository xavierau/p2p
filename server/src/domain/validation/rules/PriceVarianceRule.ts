import { ValidationRuleType, ValidationSeverity } from '@prisma/client';
import { IValidationRule } from '../interfaces/IValidationRule';
import { ValidationContext } from '../types/ValidationContext';
import { ValidationResult } from '../value-objects/ValidationResult';
import { InvoiceWithRelations } from '../types/Invoice';

export class PriceVarianceRule implements IValidationRule {
  ruleType = ValidationRuleType.PRICE_VARIANCE;
  severity: ValidationSeverity = ValidationSeverity.INFO;
  enabled = true;
  private variancePercent: number;
  private historicalCount: number;

  constructor(
    private config: {
      enabled?: boolean;
      severity?: ValidationSeverity;
      variancePercent?: number;
      historicalCount?: number;
    } = {}
  ) {
    if (config.enabled !== undefined) this.enabled = config.enabled;
    if (config.severity) this.severity = config.severity;
    this.variancePercent = config.variancePercent || 15;
    this.historicalCount = config.historicalCount || 5;
  }

  async validate(invoice: InvoiceWithRelations, context: ValidationContext): Promise<ValidationResult> {
    // Skip if no price history available
    if (!context.priceHistory || context.priceHistory.length === 0) {
      return ValidationResult.passed(
        this.ruleType,
        this.severity,
        { reason: 'No historical price data available for comparison' }
      );
    }

    const variances: Array<{
      itemId: number;
      currentPrice: number;
      averagePrice: number;
      variance: number;
      variancePercent: number;
      historicalSampleSize: number;
    }> = [];

    // Check each invoice item against historical prices
    for (const invoiceItem of invoice.items || []) {
      // Filter price history for this specific item
      const itemHistory = context.priceHistory.filter(
        ph => ph.itemId === invoiceItem.itemId
      );

      if (itemHistory.length === 0) continue;

      // Calculate average of recent prices
      const recentPrices = itemHistory
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, this.historicalCount)
        .map(ph => ph.price);

      const averagePrice = recentPrices.reduce((sum: number, price: number) => sum + price, 0) / recentPrices.length;

      // Calculate variance
      const variance = Math.abs(invoiceItem.price - averagePrice);
      const variancePercent = averagePrice > 0 ? (variance / averagePrice) * 100 : 0;

      if (variancePercent > this.variancePercent) {
        variances.push({
          itemId: invoiceItem.itemId,
          currentPrice: invoiceItem.price,
          averagePrice: averagePrice,
          variance: variance,
          variancePercent: variancePercent,
          historicalSampleSize: recentPrices.length
        });
      }
    }

    if (variances.length > 0) {
      return ValidationResult.failed(
        this.ruleType,
        this.severity,
        {
          message: `${variances.length} item(s) have prices significantly different from historical average`,
          variances,
          varianceCount: variances.length,
          thresholdPercent: this.variancePercent,
          recommendation: 'Review pricing with vendor to ensure accuracy'
        }
      );
    }

    return ValidationResult.passed(
      this.ruleType,
      this.severity,
      { reason: 'All item prices are within acceptable variance from historical averages' }
    );
  }
}
