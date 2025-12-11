import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { logger } from '../../utils/logger';
import {
  IAggregationService,
  ICacheService,
  AnalyticsEvents,
  type SpendingMetricsComputedPayload,
  type PriceBenchmarksComputedPayload,
} from '../../domain/analytics';
import { AggregationError } from '../../errors/AnalyticsError';
import { PubSubService } from '../pubsub';
import { AnalyticsConfig } from '../../config/analytics';

/**
 * Cache key prefixes for aggregation data
 */
const CACHE_KEYS = {
  SPENDING_METRICS: 'analytics:spending-metrics',
  PRICE_BENCHMARKS: 'analytics:price-benchmarks',
} as const;

/**
 * Represents a dimension combination for spending metrics
 */
interface SpendingDimension {
  itemId: number | null;
  vendorId: number | null;
  branchId: number | null;
  departmentId: number | null;
  costCenterId: number | null;
}

/**
 * Represents aggregated spending data from invoices
 */
interface AggregatedSpending extends SpendingDimension {
  totalAmount: number;
  invoiceCount: number;
  totalQuantity: number;
}

/**
 * Represents price data for an item at a branch
 */
interface ItemBranchPrice {
  itemId: number;
  vendorId: number;
  branchId: number | null;
  price: number;
}

/**
 * Aggregation service implementation
 * Computes daily spending metrics and price benchmarks
 *
 * ARCHITECTURE: Implements IAggregationService interface
 * Uses dependency injection for testability
 */
export class AggregationService implements IAggregationService {
  private readonly log = logger.child({ service: 'AggregationService' });

  constructor(
    private readonly prisma: PrismaClient,
    private readonly cacheService: ICacheService,
    private readonly pubsub: PubSubService
  ) {}

  /**
   * Compute daily spending metrics for a specific date
   * Groups by all dimensions: item, vendor, branch, department, cost center
   * Uses transaction for data integrity
   *
   * @param date - The date to compute metrics for
   */
  async computeDailySpendingMetrics(date: Date): Promise<void> {
    const startTime = Date.now();
    const dateStr = date.toISOString().split('T')[0];
    this.log.info({ date: dateStr }, 'Starting daily spending metrics computation');

    try {
      // Define start and end of the day
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Query approved invoices for the date with all needed relations
      const invoices = await this.prisma.invoice.findMany({
        where: {
          status: 'APPROVED',
          deletedAt: null,
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        include: {
          items: {
            include: {
              item: {
                select: {
                  id: true,
                  vendorId: true,
                },
              },
            },
          },
          branch: true,
          department: true,
          costCenter: true,
        },
      });

      if (invoices.length === 0) {
        this.log.info({ date: dateStr }, 'No approved invoices found for date');
        return;
      }

      // Aggregate by dimensions
      const aggregations = this.aggregateByDimensions(invoices, startOfDay);

      // Use transaction with batched upserts for better performance
      // Process in batches of 50 to avoid overwhelming the database
      const BATCH_SIZE = 50;
      const metricsCount = await this.prisma.$transaction(async (tx) => {
        let count = 0;

        // Process in batches for better performance
        for (let i = 0; i < aggregations.length; i += BATCH_SIZE) {
          const batch = aggregations.slice(i, i + BATCH_SIZE);

          // Execute batch of upserts in parallel within the transaction
          await Promise.all(
            batch.map((agg) => {
              const dimensionHash = this.computeDimensionHash(startOfDay, agg);

              return tx.spendingMetric.upsert({
                where: { dimensionHash },
                create: {
                  dimensionHash,
                  date: startOfDay,
                  itemId: agg.itemId,
                  vendorId: agg.vendorId,
                  branchId: agg.branchId,
                  departmentId: agg.departmentId,
                  costCenterId: agg.costCenterId,
                  totalAmount: agg.totalAmount,
                  invoiceCount: agg.invoiceCount,
                  quantity: agg.totalQuantity,
                  avgUnitPrice: this.safeDiv(agg.totalAmount, agg.totalQuantity),
                },
                update: {
                  totalAmount: agg.totalAmount,
                  invoiceCount: agg.invoiceCount,
                  quantity: agg.totalQuantity,
                  avgUnitPrice: this.safeDiv(agg.totalAmount, agg.totalQuantity),
                  computedAt: new Date(),
                },
              });
            })
          );

          count += batch.length;
        }

        return count;
      });

      // Invalidate cache after computation
      await this.cacheService.invalidateByPrefix(CACHE_KEYS.SPENDING_METRICS);

      const durationMs = Date.now() - startTime;
      this.log.info(
        { date: dateStr, metricsCount, durationMs },
        'Completed daily spending metrics computation'
      );

      // Publish event
      const payload: SpendingMetricsComputedPayload = {
        timestamp: new Date(),
        source: 'AggregationService',
        date: startOfDay,
        metricsCount,
        durationMs,
      };
      this.pubsub.publish(AnalyticsEvents.SPENDING_METRICS_COMPUTED, payload);
    } catch (error) {
      this.log.error({ error, date: dateStr }, 'Failed to compute daily spending metrics');
      throw new AggregationError(
        'computeDailySpendingMetrics',
        `Failed to compute metrics for ${dateStr}`,
        error as Error
      );
    }
  }

  /**
   * Compute price benchmarks across all branches for a specific date
   * Calculates network average, min, max prices and variance from average
   *
   * @param date - The date to compute benchmarks for
   */
  async computePriceBenchmarks(date: Date): Promise<void> {
    const startTime = Date.now();
    const dateStr = date.toISOString().split('T')[0];
    this.log.info({ date: dateStr }, 'Starting price benchmarks computation');

    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Query invoice items for the date to get actual prices paid
      const invoiceItems = await this.prisma.invoiceItem.findMany({
        where: {
          invoice: {
            status: 'APPROVED',
            deletedAt: null,
            date: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        },
        include: {
          item: {
            select: {
              id: true,
              vendorId: true,
            },
          },
          invoice: {
            select: {
              branchId: true,
            },
          },
        },
      });

      if (invoiceItems.length === 0) {
        this.log.info({ date: dateStr }, 'No invoice items found for price benchmarks');
        return;
      }

      // Extract unique item prices by branch
      const pricesByItem = this.groupPricesByItem(invoiceItems);

      // Compute network statistics and insert snapshots
      const snapshotCount = await this.prisma.$transaction(async (tx) => {
        let count = 0;

        for (const [itemId, priceData] of pricesByItem) {
          const stats = this.computePriceStats(priceData.prices);

          // Create snapshot for each unique branch-vendor combination
          const uniqueCombinations = new Map<string, ItemBranchPrice>();
          for (const price of priceData.prices) {
            const key = `${price.branchId ?? 'null'}-${price.vendorId}`;
            // Take the latest price if duplicates exist
            uniqueCombinations.set(key, price);
          }

          for (const price of uniqueCombinations.values()) {
            const varianceFromAvg =
              stats.avgPrice > 0
                ? ((price.price - stats.avgPrice) / stats.avgPrice) * 100
                : 0;

            await tx.priceSnapshot.create({
              data: {
                itemId: price.itemId,
                vendorId: price.vendorId,
                branchId: price.branchId,
                price: price.price,
                date: startOfDay,
                networkAvgPrice: stats.avgPrice,
                networkMinPrice: stats.minPrice,
                networkMaxPrice: stats.maxPrice,
                varianceFromAvg,
              },
            });
            count++;
          }
        }
        return count;
      });

      // Invalidate cache after computation
      await this.cacheService.invalidateByPrefix(CACHE_KEYS.PRICE_BENCHMARKS);

      const durationMs = Date.now() - startTime;
      this.log.info(
        { date: dateStr, snapshotCount, durationMs },
        'Completed price benchmarks computation'
      );

      // Publish event
      const payload: PriceBenchmarksComputedPayload = {
        timestamp: new Date(),
        source: 'AggregationService',
        date: startOfDay,
        snapshotCount,
        durationMs,
      };
      this.pubsub.publish(AnalyticsEvents.PRICE_BENCHMARKS_COMPUTED, payload);
    } catch (error) {
      this.log.error({ error, date: dateStr }, 'Failed to compute price benchmarks');
      throw new AggregationError(
        'computePriceBenchmarks',
        `Failed to compute price benchmarks for ${dateStr}`,
        error as Error
      );
    }
  }

  /**
   * Refresh any materialized views or aggregated data structures
   * Currently recomputes metrics for the last 7 days
   */
  async refreshMaterializedViews(): Promise<void> {
    this.log.info('Starting materialized views refresh');

    try {
      const today = new Date();
      const promises: Promise<void>[] = [];

      // Refresh last 7 days
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        promises.push(this.computeDailySpendingMetrics(date));
        promises.push(this.computePriceBenchmarks(date));
      }

      await Promise.all(promises);
      this.log.info('Completed materialized views refresh');
    } catch (error) {
      this.log.error({ error }, 'Failed to refresh materialized views');
      throw new AggregationError(
        'refreshMaterializedViews',
        'Failed to refresh materialized views',
        error as Error
      );
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Aggregate invoices by all dimension combinations
   */
  private aggregateByDimensions(
    invoices: Array<{
      id: number;
      branchId: number | null;
      departmentId: number | null;
      costCenterId: number | null;
      items: Array<{
        quantity: number;
        price: number;
        item: { id: number; vendorId: number };
      }>;
    }>,
    date: Date
  ): AggregatedSpending[] {
    const aggregationMap = new Map<string, AggregatedSpending>();

    for (const invoice of invoices) {
      for (const invoiceItem of invoice.items) {
        const dimension: SpendingDimension = {
          itemId: invoiceItem.item.id,
          vendorId: invoiceItem.item.vendorId,
          branchId: invoice.branchId,
          departmentId: invoice.departmentId,
          costCenterId: invoice.costCenterId,
        };

        const key = this.computeDimensionHash(date, dimension);
        const existing = aggregationMap.get(key);
        const lineTotal = invoiceItem.quantity * invoiceItem.price;

        if (existing) {
          existing.totalAmount += lineTotal;
          existing.invoiceCount += 1;
          existing.totalQuantity += invoiceItem.quantity;
        } else {
          aggregationMap.set(key, {
            ...dimension,
            totalAmount: lineTotal,
            invoiceCount: 1,
            totalQuantity: invoiceItem.quantity,
          });
        }
      }
    }

    return Array.from(aggregationMap.values());
  }

  /**
   * Compute SHA256 dimension hash for uniqueness
   * ARCHITECTURE: Use hash instead of composite key with NULLs
   * because PostgreSQL treats NULL != NULL
   */
  private computeDimensionHash(date: Date, dimension: SpendingDimension): string {
    const dateStr = date.toISOString().split('T')[0];
    const parts = [
      dateStr,
      dimension.itemId ?? 'null',
      dimension.vendorId ?? 'null',
      dimension.branchId ?? 'null',
      dimension.departmentId ?? 'null',
      dimension.costCenterId ?? 'null',
    ];
    return createHash('sha256').update(parts.join('|')).digest('hex');
  }

  /**
   * Group invoice items by item ID with their prices
   */
  private groupPricesByItem(
    invoiceItems: Array<{
      price: number;
      item: { id: number; vendorId: number };
      invoice: { branchId: number | null };
    }>
  ): Map<number, { itemId: number; prices: ItemBranchPrice[] }> {
    const result = new Map<number, { itemId: number; prices: ItemBranchPrice[] }>();

    for (const item of invoiceItems) {
      const itemId = item.item.id;
      const priceData: ItemBranchPrice = {
        itemId,
        vendorId: item.item.vendorId,
        branchId: item.invoice.branchId,
        price: item.price,
      };

      const existing = result.get(itemId);
      if (existing) {
        existing.prices.push(priceData);
      } else {
        result.set(itemId, { itemId, prices: [priceData] });
      }
    }

    return result;
  }

  /**
   * Compute price statistics (avg, min, max, stdDev)
   * Guards against empty arrays and division by zero
   */
  private computePriceStats(prices: ItemBranchPrice[]): {
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    stdDev: number;
  } {
    if (prices.length === 0) {
      return { avgPrice: 0, minPrice: 0, maxPrice: 0, stdDev: 0 };
    }

    const priceValues = prices.map((p) => p.price);
    const sum = priceValues.reduce((acc, p) => acc + p, 0);
    const avgPrice = this.safeDiv(sum, priceValues.length);
    const minPrice = Math.min(...priceValues);
    const maxPrice = Math.max(...priceValues);

    // Compute standard deviation with guard for single element
    let stdDev = 0;
    if (priceValues.length > 1) {
      const squaredDiffs = priceValues.map((p) => Math.pow(p - avgPrice, 2));
      const variance = this.safeDiv(
        squaredDiffs.reduce((acc, d) => acc + d, 0),
        priceValues.length
      );
      stdDev = Math.sqrt(variance);
    }

    return { avgPrice, minPrice, maxPrice, stdDev };
  }

  /**
   * Safe division that returns 0 when dividing by 0
   * Guards against division by zero in statistical calculations
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
 * Factory function to create AggregationService
 * ARCHITECTURE: Use factory functions instead of singletons for testability
 *
 * @param prisma - PrismaClient instance
 * @param cacheService - ICacheService implementation
 * @param pubsub - PubSubService instance
 * @returns AggregationService instance
 */
export function createAggregationService(
  prisma: PrismaClient,
  cacheService: ICacheService,
  pubsub: PubSubService
): AggregationService {
  return new AggregationService(prisma, cacheService, pubsub);
}
