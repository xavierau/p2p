import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';
import {
  ICrossLocationService,
  PriceVarianceResult,
  BranchPrice,
  BenchmarkStats,
  BranchSpending,
  ConsolidationOpportunity,
  ConsolidationBranchDetail,
  ICacheService,
} from '../../domain/analytics';
import { CrossLocationError } from '../../errors/AnalyticsError';
import { AnalyticsConfig } from '../../config/analytics';

/**
 * Cache key prefixes for cross-location data
 */
const CACHE_KEYS = {
  PRICE_VARIANCE: 'analytics:price-variance',
  BENCHMARK_STATS: 'analytics:benchmark-stats',
  BRANCH_SPENDING: 'analytics:branch-spending',
  CONSOLIDATION: 'analytics:consolidation',
} as const;

/**
 * Cross-location service implementation
 * Compares prices and spending across branches
 *
 * ARCHITECTURE: Implements ICrossLocationService interface
 * Uses dependency injection for testability
 */
export class CrossLocationService implements ICrossLocationService {
  private readonly log = logger.child({ service: 'CrossLocationService' });

  constructor(
    private readonly prisma: PrismaClient,
    private readonly cacheService: ICacheService
  ) {}

  /**
   * Get price variance for an item across all branches
   *
   * @param itemId - Item to analyze
   * @param vendorId - Optional vendor filter
   * @returns Array of price variance results
   */
  async getPriceVariance(
    itemId: number,
    vendorId?: number
  ): Promise<PriceVarianceResult[]> {
    const cacheKey = this.buildCacheKey(CACHE_KEYS.PRICE_VARIANCE, itemId, vendorId);
    this.log.info({ itemId, vendorId }, 'Getting price variance');

    try {
      // Check cache first
      const cached = await this.cacheService.get<PriceVarianceResult[]>(cacheKey);
      if (cached) {
        this.log.debug({ itemId, vendorId }, 'Returning cached price variance');
        return cached;
      }

      // Get recent price snapshots for this item
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const whereClause: {
        itemId: number;
        date: { gte: Date };
        vendorId?: number;
      } = {
        itemId,
        date: { gte: thirtyDaysAgo },
      };

      if (vendorId) {
        whereClause.vendorId = vendorId;
      }

      const snapshots = await this.prisma.priceSnapshot.findMany({
        where: whereClause,
        include: {
          item: {
            select: {
              id: true,
              name: true,
            },
          },
          vendor: {
            select: {
              id: true,
              name: true,
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          date: 'desc',
        },
      });

      if (snapshots.length === 0) {
        // Fallback to invoice items if no snapshots
        return this.getPriceVarianceFromInvoices(itemId, vendorId, cacheKey);
      }

      // Group by vendor
      const byVendor = new Map<
        number,
        {
          vendorId: number;
          vendorName: string;
          itemName: string;
          prices: { branchId: number | null; branchName: string; price: number }[];
        }
      >();

      for (const snapshot of snapshots) {
        const vId = snapshot.vendorId;
        if (!byVendor.has(vId)) {
          byVendor.set(vId, {
            vendorId: vId,
            vendorName: snapshot.vendor.name,
            itemName: snapshot.item.name,
            prices: [],
          });
        }

        byVendor.get(vId)!.prices.push({
          branchId: snapshot.branchId,
          branchName: snapshot.branch?.name ?? 'Unassigned',
          price: snapshot.price,
        });
      }

      // Compute variance for each vendor
      const results: PriceVarianceResult[] = [];

      for (const [vId, data] of byVendor) {
        // Get unique branches (latest price per branch)
        const branchPriceMap = new Map<number | null, { name: string; price: number }>();
        for (const p of data.prices) {
          // Keep first (most recent) price per branch
          if (!branchPriceMap.has(p.branchId)) {
            branchPriceMap.set(p.branchId, { name: p.branchName, price: p.price });
          }
        }

        const priceValues = Array.from(branchPriceMap.values()).map((v) => v.price);
        const { avgPrice, minPrice, maxPrice } = this.computePriceStats(priceValues);

        const branches: BranchPrice[] = [];
        for (const [branchId, { name, price }] of branchPriceMap) {
          const varianceFromAvg =
            avgPrice > 0 ? ((price - avgPrice) / avgPrice) * 100 : 0;
          branches.push({
            branchId,
            branchName: name,
            price,
            varianceFromAvg,
          });
        }

        // Calculate max variance
        const maxVariance =
          branches.length > 0
            ? Math.max(...branches.map((b) => Math.abs(b.varianceFromAvg)))
            : 0;

        results.push({
          itemId,
          itemName: data.itemName,
          vendorId: vId,
          vendorName: data.vendorName,
          branches,
          networkAvgPrice: avgPrice,
          networkMinPrice: minPrice,
          networkMaxPrice: maxPrice,
          maxVariance,
        });
      }

      // Cache the results
      await this.cacheService.set(
        cacheKey,
        results,
        AnalyticsConfig.CACHE_TTL.PRICE_VARIANCE
      );

      this.log.info(
        { itemId, vendorId, resultCount: results.length },
        'Price variance computed'
      );

      return results;
    } catch (error) {
      this.log.error({ error, itemId, vendorId }, 'Failed to get price variance');
      throw new CrossLocationError(
        'getPriceVariance',
        `Failed to get price variance for item ${itemId}`,
        error as Error
      );
    }
  }

  /**
   * Get benchmark statistics for an item across the network
   *
   * @param itemId - Item to analyze
   * @returns Benchmark stats or null if insufficient data
   */
  async getBenchmarkStats(itemId: number): Promise<BenchmarkStats | null> {
    const cacheKey = `${CACHE_KEYS.BENCHMARK_STATS}:${itemId}`;
    this.log.info({ itemId }, 'Getting benchmark stats');

    try {
      // Check cache first
      const cached = await this.cacheService.get<BenchmarkStats>(cacheKey);
      if (cached) {
        this.log.debug({ itemId }, 'Returning cached benchmark stats');
        return cached;
      }

      // Get recent price snapshots
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const snapshots = await this.prisma.priceSnapshot.findMany({
        where: {
          itemId,
          date: { gte: thirtyDaysAgo },
        },
        orderBy: {
          date: 'desc',
        },
      });

      if (snapshots.length === 0) {
        // Fallback to current item prices from invoices
        return this.getBenchmarkStatsFromInvoices(itemId, cacheKey);
      }

      // Get unique branch prices (latest per branch)
      const branchPriceMap = new Map<number | null, number>();
      for (const snapshot of snapshots) {
        if (!branchPriceMap.has(snapshot.branchId)) {
          branchPriceMap.set(snapshot.branchId, snapshot.price);
        }
      }

      const priceValues = Array.from(branchPriceMap.values());
      if (priceValues.length === 0) {
        return null;
      }

      const { avgPrice, minPrice, maxPrice } = this.computePriceStats(priceValues);

      const stats: BenchmarkStats = {
        itemId,
        avgPrice,
        minPrice,
        maxPrice,
        priceRange: maxPrice - minPrice,
        branchCount: branchPriceMap.size,
      };

      // Cache the results
      await this.cacheService.set(
        cacheKey,
        stats,
        AnalyticsConfig.CACHE_TTL.BENCHMARKS
      );

      this.log.info({ itemId, branchCount: stats.branchCount }, 'Benchmark stats computed');

      return stats;
    } catch (error) {
      this.log.error({ error, itemId }, 'Failed to get benchmark stats');
      throw new CrossLocationError(
        'getBenchmarkStats',
        `Failed to get benchmark stats for item ${itemId}`,
        error as Error
      );
    }
  }

  /**
   * Compare spending by branch for a date range
   *
   * @param startDate - Start of date range
   * @param endDate - End of date range
   * @param itemId - Optional item filter
   * @returns Array of branch spending summaries
   */
  async compareSpendingByBranch(
    startDate: Date,
    endDate: Date,
    itemId?: number
  ): Promise<BranchSpending[]> {
    const cacheKey = this.buildSpendingCacheKey(startDate, endDate, itemId);
    this.log.info({ startDate, endDate, itemId }, 'Comparing spending by branch');

    try {
      // Check cache first
      const cached = await this.cacheService.get<BranchSpending[]>(cacheKey);
      if (cached) {
        this.log.debug({ startDate, endDate, itemId }, 'Returning cached branch spending');
        return cached;
      }

      // Build where clause for spending metrics
      interface SpendingMetricWhere {
        date: { gte: Date; lte: Date };
        branchId: { not: null };
        itemId?: number;
      }

      const whereClause: SpendingMetricWhere = {
        date: {
          gte: startDate,
          lte: endDate,
        },
        branchId: { not: null },
      };

      if (itemId) {
        whereClause.itemId = itemId;
      }

      // Query spending metrics
      const metrics = await this.prisma.spendingMetric.findMany({
        where: whereClause,
        include: {
          branch: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Aggregate by branch
      const branchMap = new Map<
        number,
        { branchId: number; branchName: string; totalAmount: number; invoiceCount: number }
      >();

      for (const metric of metrics) {
        if (!metric.branchId || !metric.branch) continue;

        const existing = branchMap.get(metric.branchId);
        if (existing) {
          existing.totalAmount += metric.totalAmount;
          existing.invoiceCount += metric.invoiceCount;
        } else {
          branchMap.set(metric.branchId, {
            branchId: metric.branchId,
            branchName: metric.branch.name,
            totalAmount: metric.totalAmount,
            invoiceCount: metric.invoiceCount,
          });
        }
      }

      const results: BranchSpending[] = Array.from(branchMap.values());

      // Sort by total amount descending
      results.sort((a, b) => b.totalAmount - a.totalAmount);

      // Cache the results
      await this.cacheService.set(
        cacheKey,
        results,
        AnalyticsConfig.CACHE_TTL.SPENDING_METRICS
      );

      this.log.info(
        { startDate, endDate, itemId, branchCount: results.length },
        'Branch spending comparison completed'
      );

      return results;
    } catch (error) {
      this.log.error({ error, startDate, endDate, itemId }, 'Failed to compare spending by branch');
      throw new CrossLocationError(
        'compareSpendingByBranch',
        'Failed to compare spending by branch',
        error as Error
      );
    }
  }

  /**
   * Find opportunities to consolidate purchases across branches
   * Identifies items purchased from multiple vendors
   *
   * @returns Array of consolidation opportunities
   */
  async findConsolidationOpportunities(): Promise<ConsolidationOpportunity[]> {
    const cacheKey = CACHE_KEYS.CONSOLIDATION;
    this.log.info('Finding consolidation opportunities');

    try {
      // Check cache first
      const cached = await this.cacheService.get<ConsolidationOpportunity[]>(cacheKey);
      if (cached) {
        this.log.debug('Returning cached consolidation opportunities');
        return cached;
      }

      // Get spending metrics from last 90 days grouped by item
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const metrics = await this.prisma.spendingMetric.findMany({
        where: {
          date: { gte: ninetyDaysAgo },
          itemId: { not: null },
        },
        include: {
          item: {
            select: {
              id: true,
              name: true,
              vendorId: true,
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
            },
          },
          vendor: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Group by item
      const byItem = new Map<
        number,
        {
          itemId: number;
          itemName: string;
          branches: Map<
            number | null,
            {
              branchId: number | null;
              branchName: string | undefined;
              vendors: Set<number>;
              vendorName: string | undefined;
              totalAmount: number;
            }
          >;
          vendorSet: Set<number>;
          totalSpending: number;
        }
      >();

      for (const metric of metrics) {
        if (!metric.itemId || !metric.item) continue;

        const itemId = metric.itemId;
        if (!byItem.has(itemId)) {
          byItem.set(itemId, {
            itemId,
            itemName: metric.item.name,
            branches: new Map(),
            vendorSet: new Set(),
            totalSpending: 0,
          });
        }

        const itemData = byItem.get(itemId)!;
        itemData.totalSpending += metric.totalAmount;

        if (metric.vendorId) {
          itemData.vendorSet.add(metric.vendorId);
        }

        const branchKey = metric.branchId;
        if (!itemData.branches.has(branchKey)) {
          itemData.branches.set(branchKey, {
            branchId: metric.branchId,
            branchName: metric.branch?.name,
            vendors: new Set(),
            vendorName: metric.vendor?.name,
            totalAmount: 0,
          });
        }

        const branchData = itemData.branches.get(branchKey)!;
        branchData.totalAmount += metric.totalAmount;
        if (metric.vendorId) {
          branchData.vendors.add(metric.vendorId);
        }
      }

      // Filter to items with multiple vendors or branches
      const opportunities: ConsolidationOpportunity[] = [];

      for (const [itemId, data] of byItem) {
        // Consolidation opportunity if multiple vendors or multiple branches
        if (data.vendorSet.size >= 2 || data.branches.size >= 2) {
          const branches: ConsolidationBranchDetail[] = [];

          for (const [, branchData] of data.branches) {
            branches.push({
              branchId: branchData.branchId,
              branchName: branchData.branchName,
              vendorId: branchData.vendors.size === 1 ? Array.from(branchData.vendors)[0] : null,
              vendorName: branchData.vendors.size === 1 ? branchData.vendorName : undefined,
              totalAmount: branchData.totalAmount,
            });
          }

          opportunities.push({
            itemId,
            itemName: data.itemName,
            branchCount: data.branches.size,
            vendorCount: data.vendorSet.size,
            totalSpending: data.totalSpending,
            branches,
          });
        }
      }

      // Sort by total spending descending
      opportunities.sort((a, b) => b.totalSpending - a.totalSpending);

      // Cache the results
      await this.cacheService.set(
        cacheKey,
        opportunities,
        AnalyticsConfig.CACHE_TTL.SPENDING_METRICS
      );

      this.log.info(
        { opportunityCount: opportunities.length },
        'Consolidation opportunities identified'
      );

      return opportunities;
    } catch (error) {
      this.log.error({ error }, 'Failed to find consolidation opportunities');
      throw new CrossLocationError(
        'findConsolidationOpportunities',
        'Failed to find consolidation opportunities',
        error as Error
      );
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Get price variance from invoice items (fallback when no snapshots)
   */
  private async getPriceVarianceFromInvoices(
    itemId: number,
    vendorId: number | undefined,
    cacheKey: string
  ): Promise<PriceVarianceResult[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    interface InvoiceItemWhere {
      itemId: number;
      invoice: {
        status: string;
        deletedAt: null;
        date: { gte: Date };
      };
      item?: { vendorId: number };
    }

    const whereClause: InvoiceItemWhere = {
      itemId,
      invoice: {
        status: 'APPROVED',
        deletedAt: null,
        date: { gte: thirtyDaysAgo },
      },
    };

    if (vendorId) {
      whereClause.item = { vendorId };
    }

    const invoiceItems = await this.prisma.invoiceItem.findMany({
      where: whereClause,
      include: {
        item: {
          select: {
            id: true,
            name: true,
            vendorId: true,
            vendor: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        invoice: {
          select: {
            branchId: true,
            branch: {
              select: {
                id: true,
                name: true,
              },
            },
            date: true,
          },
        },
      },
      orderBy: {
        invoice: { date: 'desc' },
      },
    });

    if (invoiceItems.length === 0) {
      return [];
    }

    // Group by vendor
    const byVendor = new Map<
      number,
      {
        vendorId: number;
        vendorName: string;
        itemName: string;
        prices: Map<number | null, { name: string; price: number }>;
      }
    >();

    for (const ii of invoiceItems) {
      const vId = ii.item.vendorId;
      if (!byVendor.has(vId)) {
        byVendor.set(vId, {
          vendorId: vId,
          vendorName: ii.item.vendor.name,
          itemName: ii.item.name,
          prices: new Map(),
        });
      }

      const vendorData = byVendor.get(vId)!;
      const branchId = ii.invoice.branchId;
      if (!vendorData.prices.has(branchId)) {
        vendorData.prices.set(branchId, {
          name: ii.invoice.branch?.name ?? 'Unassigned',
          price: ii.price,
        });
      }
    }

    const results: PriceVarianceResult[] = [];

    for (const [vId, data] of byVendor) {
      const priceValues = Array.from(data.prices.values()).map((v) => v.price);
      const { avgPrice, minPrice, maxPrice } = this.computePriceStats(priceValues);

      const branches: BranchPrice[] = [];
      for (const [branchId, { name, price }] of data.prices) {
        const varianceFromAvg = avgPrice > 0 ? ((price - avgPrice) / avgPrice) * 100 : 0;
        branches.push({
          branchId,
          branchName: name,
          price,
          varianceFromAvg,
        });
      }

      const maxVariance =
        branches.length > 0
          ? Math.max(...branches.map((b) => Math.abs(b.varianceFromAvg)))
          : 0;

      results.push({
        itemId,
        itemName: data.itemName,
        vendorId: vId,
        vendorName: data.vendorName,
        branches,
        networkAvgPrice: avgPrice,
        networkMinPrice: minPrice,
        networkMaxPrice: maxPrice,
        maxVariance,
      });
    }

    await this.cacheService.set(cacheKey, results, AnalyticsConfig.CACHE_TTL.PRICE_VARIANCE);
    return results;
  }

  /**
   * Get benchmark stats from invoices (fallback when no snapshots)
   */
  private async getBenchmarkStatsFromInvoices(
    itemId: number,
    cacheKey: string
  ): Promise<BenchmarkStats | null> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const invoiceItems = await this.prisma.invoiceItem.findMany({
      where: {
        itemId,
        invoice: {
          status: 'APPROVED',
          deletedAt: null,
          date: { gte: thirtyDaysAgo },
        },
      },
      include: {
        invoice: {
          select: {
            branchId: true,
          },
        },
      },
    });

    if (invoiceItems.length === 0) {
      return null;
    }

    // Get unique branch prices
    const branchPriceMap = new Map<number | null, number>();
    for (const ii of invoiceItems) {
      if (!branchPriceMap.has(ii.invoice.branchId)) {
        branchPriceMap.set(ii.invoice.branchId, ii.price);
      }
    }

    const priceValues = Array.from(branchPriceMap.values());
    const { avgPrice, minPrice, maxPrice } = this.computePriceStats(priceValues);

    const stats: BenchmarkStats = {
      itemId,
      avgPrice,
      minPrice,
      maxPrice,
      priceRange: maxPrice - minPrice,
      branchCount: branchPriceMap.size,
    };

    await this.cacheService.set(cacheKey, stats, AnalyticsConfig.CACHE_TTL.BENCHMARKS);
    return stats;
  }

  /**
   * Compute price statistics
   * Guards against empty arrays and division by zero
   */
  private computePriceStats(prices: number[]): {
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
  } {
    if (prices.length === 0) {
      return { avgPrice: 0, minPrice: 0, maxPrice: 0 };
    }

    const sum = prices.reduce((acc, p) => acc + p, 0);
    const avgPrice = this.safeDiv(sum, prices.length);

    return {
      avgPrice,
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
    };
  }

  /**
   * Build cache key with optional vendor filter
   */
  private buildCacheKey(prefix: string, itemId: number, vendorId?: number): string {
    return vendorId ? `${prefix}:${itemId}:${vendorId}` : `${prefix}:${itemId}:all`;
  }

  /**
   * Build cache key for spending comparison
   */
  private buildSpendingCacheKey(startDate: Date, endDate: Date, itemId?: number): string {
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    const itemPart = itemId ?? 'all';
    return `${CACHE_KEYS.BRANCH_SPENDING}:${startStr}:${endStr}:${itemPart}`;
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
 * Factory function to create CrossLocationService
 * ARCHITECTURE: Use factory functions instead of singletons for testability
 *
 * @param prisma - PrismaClient instance
 * @param cacheService - ICacheService implementation
 * @returns CrossLocationService instance
 */
export function createCrossLocationService(
  prisma: PrismaClient,
  cacheService: ICacheService
): CrossLocationService {
  return new CrossLocationService(prisma, cacheService);
}
