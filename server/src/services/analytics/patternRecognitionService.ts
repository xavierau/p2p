import { PrismaClient, PurchasePattern } from '@prisma/client';
import { logger } from '../../utils/logger';
import {
  IPatternRecognitionService,
  Anomaly,
  AnomalyType,
  ICacheService,
  AnalyticsEvents,
  type PatternDetectedPayload,
  type AnomalyDetectedPayload,
} from '../../domain/analytics';
import { PatternRecognitionError, InsufficientDataError } from '../../errors/AnalyticsError';
import { PubSubService } from '../pubsub';
import { AnalyticsConfig } from '../../config/analytics';

/**
 * Cache key prefixes for pattern data
 */
const CACHE_KEYS = {
  PURCHASE_PATTERN: 'analytics:pattern',
  ANOMALIES: 'analytics:anomalies',
} as const;

/**
 * Represents an invoice item with date for pattern analysis
 */
interface OrderData {
  invoiceId: number;
  date: Date;
  quantity: number;
  price: number;
  amount: number;
}

/**
 * Pattern recognition service implementation
 * Analyzes purchase patterns and detects anomalies
 *
 * ARCHITECTURE: Implements IPatternRecognitionService interface
 * Uses dependency injection for testability
 */
export class PatternRecognitionService implements IPatternRecognitionService {
  private readonly log = logger.child({ service: 'PatternRecognitionService' });

  constructor(
    private readonly prisma: PrismaClient,
    private readonly cacheService: ICacheService,
    private readonly pubsub: PubSubService
  ) {}

  /**
   * Analyze purchase pattern for a specific item, optionally filtered by branch
   * Detects order cycles, trends, and seasonality
   *
   * @param itemId - Item to analyze
   * @param branchId - Optional branch filter
   * @returns The computed purchase pattern or null if insufficient data
   */
  async analyzePurchasePattern(
    itemId: number,
    branchId?: number
  ): Promise<PurchasePattern | null> {
    const cacheKey = this.buildCacheKey(CACHE_KEYS.PURCHASE_PATTERN, itemId, branchId);
    this.log.info({ itemId, branchId }, 'Analyzing purchase pattern');

    try {
      // Check cache first
      const cached = await this.cacheService.get<PurchasePattern>(cacheKey);
      if (cached) {
        this.log.debug({ itemId, branchId }, 'Returning cached purchase pattern');
        return cached;
      }

      // Query historical orders for this item
      const orders = await this.getOrderHistory(itemId, branchId);

      // Check if we have enough data
      const minInvoices = AnalyticsConfig.THRESHOLDS.MIN_INVOICES_FOR_PATTERN;
      if (orders.length < minInvoices) {
        this.log.info(
          { itemId, branchId, orderCount: orders.length, minRequired: minInvoices },
          'Insufficient data for pattern analysis'
        );
        return null;
      }

      // Compute pattern metrics
      const avgOrderCycleDays = this.detectOrderCycle(orders);
      const { mean: avgOrderQuantity, stdDev: stdDevQuantity } = this.computeStats(
        orders.map((o) => o.quantity)
      );
      const { mean: avgOrderAmount, stdDev: stdDevAmount } = this.computeStats(
        orders.map((o) => o.amount)
      );

      // Detect trends
      const { isIncreasing, isDecreasing } = this.detectTrend(orders);

      // Detect seasonality (simplified - monthly patterns)
      const { isSeasonal, seasonalityPattern } = this.detectSeasonality(orders);

      // Get last order date
      const sortedOrders = [...orders].sort(
        (a, b) => b.date.getTime() - a.date.getTime()
      );
      const lastOrderDate = sortedOrders[0]?.date ?? null;

      // Predict next order
      const nextPredictedOrder = this.predictNextOrderFromData(lastOrderDate, avgOrderCycleDays);

      // Compute confidence score based on data quality
      const confidenceScore = this.computeConfidenceScore(orders, avgOrderCycleDays);

      // Get analysis date range
      const sortedByDate = [...orders].sort(
        (a, b) => a.date.getTime() - b.date.getTime()
      );
      const analysisStartDate = sortedByDate[0]?.date ?? new Date();
      const analysisEndDate = sortedByDate[sortedByDate.length - 1]?.date ?? new Date();

      // Upsert the pattern
      const pattern = await this.prisma.purchasePattern.upsert({
        where: {
          itemId_branchId: {
            itemId,
            branchId: branchId ?? null,
          },
        },
        create: {
          itemId,
          branchId: branchId ?? null,
          avgOrderCycleDays,
          avgOrderQuantity,
          avgOrderAmount,
          stdDevQuantity,
          stdDevAmount,
          isIncreasing,
          isDecreasing,
          isSeasonal,
          seasonalityPattern: seasonalityPattern ? JSON.stringify(seasonalityPattern) : null,
          lastOrderDate,
          nextPredictedOrder,
          confidenceScore,
          basedOnInvoices: orders.length,
          analysisStartDate,
          analysisEndDate,
        },
        update: {
          avgOrderCycleDays,
          avgOrderQuantity,
          avgOrderAmount,
          stdDevQuantity,
          stdDevAmount,
          isIncreasing,
          isDecreasing,
          isSeasonal,
          seasonalityPattern: seasonalityPattern ? JSON.stringify(seasonalityPattern) : null,
          lastOrderDate,
          nextPredictedOrder,
          confidenceScore,
          basedOnInvoices: orders.length,
          analysisStartDate,
          analysisEndDate,
        },
      });

      // Cache the result
      await this.cacheService.set(
        cacheKey,
        pattern,
        AnalyticsConfig.CACHE_TTL.PURCHASE_PATTERNS
      );

      // Publish event
      const payload: PatternDetectedPayload = {
        timestamp: new Date(),
        source: 'PatternRecognitionService',
        itemId,
        branchId: branchId ?? null,
        confidenceScore,
        isNewPattern: true,
      };
      this.pubsub.publish(AnalyticsEvents.PATTERN_DETECTED, payload);

      this.log.info(
        { itemId, branchId, confidenceScore, cycleDays: avgOrderCycleDays },
        'Purchase pattern analyzed successfully'
      );

      return pattern;
    } catch (error) {
      this.log.error({ error, itemId, branchId }, 'Failed to analyze purchase pattern');
      throw new PatternRecognitionError(
        'analyzePurchasePattern',
        `Failed to analyze pattern for item ${itemId}`,
        error as Error
      );
    }
  }

  /**
   * Predict the next order date for a specific item
   * Uses detected cycle length + last order date
   *
   * @param itemId - Item to predict for
   * @param branchId - Optional branch filter
   * @returns Predicted next order date or null if unable to predict
   */
  async predictNextOrder(itemId: number, branchId?: number): Promise<Date | null> {
    this.log.debug({ itemId, branchId }, 'Predicting next order');

    try {
      // First try to get existing pattern
      const pattern = await this.prisma.purchasePattern.findUnique({
        where: {
          itemId_branchId: {
            itemId,
            branchId: branchId ?? null,
          },
        },
      });

      if (pattern?.nextPredictedOrder) {
        return pattern.nextPredictedOrder;
      }

      // If no pattern exists, try to analyze
      const analyzed = await this.analyzePurchasePattern(itemId, branchId);
      return analyzed?.nextPredictedOrder ?? null;
    } catch (error) {
      this.log.error({ error, itemId, branchId }, 'Failed to predict next order');
      throw new PatternRecognitionError(
        'predictNextOrder',
        `Failed to predict next order for item ${itemId}`,
        error as Error
      );
    }
  }

  /**
   * Detect anomalies in ordering behavior for a specific item
   * Flags orders that deviate more than ANOMALY_STD_DEV standard deviations
   *
   * @param itemId - Item to check
   * @param branchId - Optional branch filter
   * @returns Array of detected anomalies
   */
  async detectAnomalies(itemId: number, branchId?: number): Promise<Anomaly[]> {
    const cacheKey = this.buildCacheKey(CACHE_KEYS.ANOMALIES, itemId, branchId);
    this.log.info({ itemId, branchId }, 'Detecting anomalies');

    try {
      // Check cache first
      const cached = await this.cacheService.get<Anomaly[]>(cacheKey);
      if (cached) {
        this.log.debug({ itemId, branchId }, 'Returning cached anomalies');
        return cached;
      }

      // Get or create pattern
      let pattern = await this.prisma.purchasePattern.findUnique({
        where: {
          itemId_branchId: {
            itemId,
            branchId: branchId ?? null,
          },
        },
      });

      if (!pattern) {
        pattern = await this.analyzePurchasePattern(itemId, branchId);
        if (!pattern) {
          this.log.info({ itemId, branchId }, 'Cannot detect anomalies without pattern');
          return [];
        }
      }

      // Get order history
      const orders = await this.getOrderHistory(itemId, branchId);
      if (orders.length === 0) {
        return [];
      }

      const anomalyThreshold = AnalyticsConfig.THRESHOLDS.ANOMALY_STD_DEV;
      const anomalies: Anomaly[] = [];

      for (const order of orders) {
        // Guard against division by zero in standard deviation
        const quantityDeviation =
          pattern.stdDevQuantity > 0
            ? Math.abs(order.quantity - pattern.avgOrderQuantity) / pattern.stdDevQuantity
            : 0;

        const amountDeviation =
          pattern.stdDevAmount > 0
            ? Math.abs(order.amount - pattern.avgOrderAmount) / pattern.stdDevAmount
            : 0;

        const isQuantityAnomaly = quantityDeviation > anomalyThreshold;
        const isAmountAnomaly = amountDeviation > anomalyThreshold;

        if (isQuantityAnomaly || isAmountAnomaly) {
          let type: AnomalyType;
          if (isQuantityAnomaly && isAmountAnomaly) {
            type = 'BOTH';
          } else if (isQuantityAnomaly) {
            type = 'QUANTITY_ANOMALY';
          } else {
            type = 'AMOUNT_ANOMALY';
          }

          const anomaly: Anomaly = {
            invoiceId: order.invoiceId,
            invoiceDate: order.date,
            quantity: order.quantity,
            amount: order.amount,
            expectedQuantity: pattern.avgOrderQuantity,
            expectedAmount: pattern.avgOrderAmount,
            quantityDeviation,
            amountDeviation,
            type,
          };

          anomalies.push(anomaly);

          // Publish event for each anomaly
          const payload: AnomalyDetectedPayload = {
            timestamp: new Date(),
            source: 'PatternRecognitionService',
            invoiceId: order.invoiceId,
            itemId,
            anomalyType: type,
            deviation: Math.max(quantityDeviation, amountDeviation),
          };
          this.pubsub.publish(AnalyticsEvents.ANOMALY_DETECTED, payload);
        }
      }

      // Cache the results
      await this.cacheService.set(
        cacheKey,
        anomalies,
        AnalyticsConfig.CACHE_TTL.PURCHASE_PATTERNS
      );

      this.log.info(
        { itemId, branchId, anomalyCount: anomalies.length },
        'Anomaly detection completed'
      );

      return anomalies;
    } catch (error) {
      this.log.error({ error, itemId, branchId }, 'Failed to detect anomalies');
      throw new PatternRecognitionError(
        'detectAnomalies',
        `Failed to detect anomalies for item ${itemId}`,
        error as Error
      );
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Get order history for an item, optionally filtered by branch
   */
  private async getOrderHistory(
    itemId: number,
    branchId?: number
  ): Promise<OrderData[]> {
    const whereClause: {
      itemId: number;
      invoice: {
        status: string;
        deletedAt: null;
        branchId?: number;
      };
    } = {
      itemId,
      invoice: {
        status: 'APPROVED',
        deletedAt: null,
      },
    };

    if (branchId) {
      whereClause.invoice.branchId = branchId;
    }

    const items = await this.prisma.invoiceItem.findMany({
      where: whereClause,
      include: {
        invoice: {
          select: {
            id: true,
            date: true,
          },
        },
      },
      orderBy: {
        invoice: {
          date: 'asc',
        },
      },
    });

    return items.map((item) => ({
      invoiceId: item.invoice.id,
      date: item.invoice.date,
      quantity: item.quantity,
      price: item.price,
      amount: item.quantity * item.price,
    }));
  }

  /**
   * Detect the average order cycle in days
   * Guards against division by zero
   *
   * @param orders - Array of orders sorted by date
   * @returns Average cycle length in days
   */
  private detectOrderCycle(orders: OrderData[]): number {
    if (orders.length < 2) {
      return 0;
    }

    // Sort by date
    const sorted = [...orders].sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate intervals between orders
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const daysDiff =
        (sorted[i].date.getTime() - sorted[i - 1].date.getTime()) / (1000 * 60 * 60 * 24);
      intervals.push(daysDiff);
    }

    // Guard against empty intervals array
    if (intervals.length === 0) {
      return 0;
    }

    // Return average interval
    const sum = intervals.reduce((acc, val) => acc + val, 0);
    return this.safeDiv(sum, intervals.length);
  }

  /**
   * Compute mean and standard deviation
   * Guards against empty arrays and division by zero
   */
  private computeStats(values: number[]): { mean: number; stdDev: number } {
    if (values.length === 0) {
      return { mean: 0, stdDev: 0 };
    }

    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = this.safeDiv(sum, values.length);

    if (values.length < 2) {
      return { mean, stdDev: 0 };
    }

    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    const variance = this.safeDiv(
      squaredDiffs.reduce((acc, val) => acc + val, 0),
      values.length
    );
    const stdDev = Math.sqrt(variance);

    return { mean, stdDev };
  }

  /**
   * Detect trend direction (increasing/decreasing)
   * Uses simple linear regression slope
   */
  private detectTrend(orders: OrderData[]): {
    isIncreasing: boolean;
    isDecreasing: boolean;
  } {
    if (orders.length < 3) {
      return { isIncreasing: false, isDecreasing: false };
    }

    // Sort by date
    const sorted = [...orders].sort((a, b) => a.date.getTime() - b.date.getTime());
    const amounts = sorted.map((o) => o.amount);

    // Simple trend: compare first third average to last third average
    const thirdLength = Math.floor(amounts.length / 3);
    if (thirdLength === 0) {
      return { isIncreasing: false, isDecreasing: false };
    }

    const firstThird = amounts.slice(0, thirdLength);
    const lastThird = amounts.slice(-thirdLength);

    const firstAvg = this.safeDiv(
      firstThird.reduce((a, b) => a + b, 0),
      firstThird.length
    );
    const lastAvg = this.safeDiv(
      lastThird.reduce((a, b) => a + b, 0),
      lastThird.length
    );

    // Consider significant if change is more than 10%
    const changePercent =
      firstAvg > 0 ? ((lastAvg - firstAvg) / firstAvg) * 100 : 0;

    return {
      isIncreasing: changePercent > 10,
      isDecreasing: changePercent < -10,
    };
  }

  /**
   * Detect seasonality patterns (simplified monthly analysis)
   */
  private detectSeasonality(orders: OrderData[]): {
    isSeasonal: boolean;
    seasonalityPattern: Record<number, number> | null;
  } {
    if (orders.length < 12) {
      return { isSeasonal: false, seasonalityPattern: null };
    }

    // Group by month
    const monthlyTotals: Record<number, { sum: number; count: number }> = {};
    for (const order of orders) {
      const month = order.date.getMonth();
      if (!monthlyTotals[month]) {
        monthlyTotals[month] = { sum: 0, count: 0 };
      }
      monthlyTotals[month].sum += order.amount;
      monthlyTotals[month].count++;
    }

    // Calculate monthly averages
    const monthlyAvg: Record<number, number> = {};
    for (const [month, data] of Object.entries(monthlyTotals)) {
      monthlyAvg[Number(month)] = this.safeDiv(data.sum, data.count);
    }

    // Check for seasonality: variance in monthly averages
    const avgValues = Object.values(monthlyAvg);
    if (avgValues.length < 4) {
      return { isSeasonal: false, seasonalityPattern: null };
    }

    const { mean, stdDev } = this.computeStats(avgValues);
    const coefficientOfVariation = this.safeDiv(stdDev, mean) * 100;

    // Consider seasonal if coefficient of variation > 20%
    const isSeasonal = coefficientOfVariation > 20;

    return {
      isSeasonal,
      seasonalityPattern: isSeasonal ? monthlyAvg : null,
    };
  }

  /**
   * Predict next order date from last order and cycle
   */
  private predictNextOrderFromData(
    lastOrderDate: Date | null,
    avgCycleDays: number
  ): Date | null {
    if (!lastOrderDate || avgCycleDays <= 0) {
      return null;
    }

    const nextOrder = new Date(lastOrderDate);
    nextOrder.setDate(nextOrder.getDate() + Math.round(avgCycleDays));
    return nextOrder;
  }

  /**
   * Compute confidence score based on data quality
   * Higher score = more reliable pattern
   */
  private computeConfidenceScore(orders: OrderData[], avgCycleDays: number): number {
    // Factors affecting confidence:
    // 1. Sample size (more orders = higher confidence)
    // 2. Consistency of cycle (lower variance = higher confidence)
    // 3. Recency of data

    const minInvoices = AnalyticsConfig.THRESHOLDS.MIN_INVOICES_FOR_PATTERN;
    const idealSampleSize = minInvoices * 4; // 20 invoices for full confidence from sample size

    // Sample size factor (0 to 0.4)
    const sampleFactor = Math.min(orders.length / idealSampleSize, 1) * 0.4;

    // Cycle consistency factor (0 to 0.4)
    let cycleFactor = 0.2;
    if (avgCycleDays > 0 && orders.length >= 2) {
      const sorted = [...orders].sort((a, b) => a.date.getTime() - b.date.getTime());
      const intervals: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        const daysDiff =
          (sorted[i].date.getTime() - sorted[i - 1].date.getTime()) / (1000 * 60 * 60 * 24);
        intervals.push(daysDiff);
      }
      const { stdDev } = this.computeStats(intervals);
      const cv = this.safeDiv(stdDev, avgCycleDays);
      // Lower CV = more consistent = higher confidence
      cycleFactor = Math.max(0, 0.4 - cv * 0.2);
    }

    // Recency factor (0 to 0.2)
    let recencyFactor = 0.1;
    if (orders.length > 0) {
      const sorted = [...orders].sort((a, b) => b.date.getTime() - a.date.getTime());
      const daysSinceLastOrder =
        (Date.now() - sorted[0].date.getTime()) / (1000 * 60 * 60 * 24);
      // Full recency score if last order within 30 days
      recencyFactor = Math.max(0, 0.2 - (daysSinceLastOrder / 180) * 0.2);
    }

    return Math.min(sampleFactor + cycleFactor + recencyFactor, 1);
  }

  /**
   * Build cache key with optional branch
   */
  private buildCacheKey(prefix: string, itemId: number, branchId?: number): string {
    return branchId ? `${prefix}:${itemId}:${branchId}` : `${prefix}:${itemId}:all`;
  }

  /**
   * Safe division that returns 0 when dividing by 0
   */
  private safeDiv(numerator: number, denominator: number): number {
    if (denominator === 0) {
      return 0;
    }
    return numerator / denominator;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Factory function to create PatternRecognitionService
 * ARCHITECTURE: Use factory functions instead of singletons for testability
 *
 * @param prisma - PrismaClient instance
 * @param cacheService - ICacheService implementation
 * @param pubsub - PubSubService instance
 * @returns PatternRecognitionService instance
 */
export function createPatternRecognitionService(
  prisma: PrismaClient,
  cacheService: ICacheService,
  pubsub: PubSubService
): PatternRecognitionService {
  return new PatternRecognitionService(prisma, cacheService, pubsub);
}
