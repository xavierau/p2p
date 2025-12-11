/**
 * Analytics Foundation Routes
 *
 * REST API endpoints for the Analytics & Intelligence Foundation.
 * Provides access to spending metrics, price variance analysis,
 * purchase patterns, benchmarks, and consolidation opportunities.
 *
 * All routes require authentication and have rate limiting applied.
 *
 * @module routes/analytics/foundation
 */

import express from 'express';
import { z } from 'zod';
import { authenticateToken } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { validateQuery, validateParams } from '../../middleware/validateParams';
import { analyticsLimiter } from '../../middleware/rateLimiter';
import { Permission } from '../../constants/permissions';
import { AuthRequest } from '../../types/auth';
import { logger } from '../../utils/logger';
import {
  SpendingMetricQuerySchema,
  PriceVarianceQuerySchema,
  PurchasePatternQuerySchema,
} from '../../schemas/analytics.schema';
import prisma from '../../prisma';
import { getRedisServiceSingleton } from '../../services/infrastructure/redisService';
import { createCrossLocationService } from '../../services/analytics';

/**
 * Schema for itemId path parameter
 */
const ItemIdParamSchema = z.object({
  itemId: z
    .string()
    .regex(/^\d+$/, 'itemId must be a positive integer')
    .transform(Number),
});

const router = express.Router();

// Apply authentication and rate limiting to all routes
router.use(authenticateToken);
router.use(analyticsLimiter);

/**
 * GET /api/analytics/foundation/spending-metrics
 *
 * Retrieves paginated spending metrics with optional filters.
 *
 * @route GET /api/analytics/foundation/spending-metrics
 * @group Analytics Foundation - Spending metrics and analysis
 * @param {string} [startDate] - Filter by start date (ISO 8601)
 * @param {string} [endDate] - Filter by end date (ISO 8601)
 * @param {number} [itemId] - Filter by item ID
 * @param {number} [vendorId] - Filter by vendor ID
 * @param {number} [branchId] - Filter by branch ID
 * @param {number} [departmentId] - Filter by department ID
 * @param {number} [costCenterId] - Filter by cost center ID
 * @param {number} [page=1] - Page number (1-indexed)
 * @param {number} [limit=20] - Items per page (max 100)
 * @returns {Object} 200 - Paginated spending metrics with summary
 * @returns {Object} 401 - Unauthorized
 * @returns {Object} 500 - Internal server error
 * @security JWT
 */
router.get(
  '/spending-metrics',
  authorize(Permission.ANALYTICS_READ),
  validateQuery(SpendingMetricQuerySchema),
  async (req: AuthRequest, res) => {
    const {
      startDate,
      endDate,
      itemId,
      vendorId,
      branchId,
      departmentId,
      costCenterId,
      page,
      limit,
    } = req.query as {
      startDate?: string;
      endDate?: string;
      itemId?: number;
      vendorId?: number;
      branchId?: number;
      departmentId?: number;
      costCenterId?: number;
      page: number;
      limit: number;
    };

    try {
      // Build where clause
      const where: {
        date?: { gte?: Date; lte?: Date };
        itemId?: number;
        vendorId?: number;
        branchId?: number;
        departmentId?: number;
        costCenterId?: number;
      } = {};

      if (startDate || endDate) {
        where.date = {};
        if (startDate) where.date.gte = new Date(startDate);
        if (endDate) where.date.lte = new Date(endDate);
      }
      if (itemId) where.itemId = itemId;
      if (vendorId) where.vendorId = vendorId;
      if (branchId) where.branchId = branchId;
      if (departmentId) where.departmentId = departmentId;
      if (costCenterId) where.costCenterId = costCenterId;

      const skip = (page - 1) * limit;

      // Fetch data and compute summary in parallel
      const [total, data, summaryAggregates] = await prisma.$transaction([
        prisma.spendingMetric.count({ where }),
        prisma.spendingMetric.findMany({
          where,
          skip,
          take: limit,
          orderBy: { date: 'desc' },
          include: {
            item: { select: { id: true, name: true } },
            vendor: { select: { id: true, name: true } },
            branch: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
            costCenter: { select: { id: true, name: true } },
          },
        }),
        // Compute summary totals across the entire filtered dataset
        prisma.spendingMetric.aggregate({
          where,
          _sum: {
            totalAmount: true,
            invoiceCount: true,
            quantity: true,
          },
          _avg: {
            avgUnitPrice: true,
          },
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      // Build summary from aggregates
      const summary = {
        totalSpending: summaryAggregates._sum.totalAmount ?? 0,
        totalTransactions: summaryAggregates._sum.invoiceCount ?? 0,
        totalQuantity: summaryAggregates._sum.quantity ?? 0,
        averageUnitPrice: summaryAggregates._avg.avgUnitPrice ?? 0,
      };

      res.json({
        data,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrevious: page > 1,
        },
        summary,
      });
    } catch (error) {
      logger.error({ err: error }, 'Failed to retrieve spending metrics');
      res.status(500).json({ error: 'Failed to retrieve spending metrics' });
    }
  }
);

/**
 * GET /api/analytics/foundation/price-variance
 *
 * Retrieves price variance data across branches for a specific item.
 * Compares prices paid at different locations to identify savings opportunities.
 *
 * @route GET /api/analytics/foundation/price-variance
 * @group Analytics Foundation - Cross-location price analysis
 * @param {number} itemId - Item ID to analyze (required)
 * @param {number} [vendorId] - Filter by vendor ID
 * @returns {Object} 200 - Price variance data with branch comparisons
 * @returns {Object} 401 - Unauthorized
 * @returns {Object} 500 - Internal server error
 * @security JWT
 */
router.get(
  '/price-variance',
  authorize(Permission.ANALYTICS_READ),
  validateQuery(PriceVarianceQuerySchema),
  async (req: AuthRequest, res) => {
    const { itemId, vendorId } = req.query as {
      itemId: number;
      vendorId?: number;
    };

    try {
      const cacheService = await getRedisServiceSingleton();
      const crossLocationService = createCrossLocationService(prisma, cacheService);

      const result = await crossLocationService.getPriceVariance(itemId, vendorId);
      res.json(result);
    } catch (error) {
      logger.error({ err: error, itemId, vendorId }, 'Failed to retrieve price variance');
      res.status(500).json({ error: 'Failed to retrieve price variance' });
    }
  }
);

/**
 * GET /api/analytics/foundation/purchase-patterns
 *
 * Retrieves detected purchase patterns for items.
 * Includes cycle time, quantity trends, and seasonality detection.
 *
 * @route GET /api/analytics/foundation/purchase-patterns
 * @group Analytics Foundation - Purchase pattern analysis
 * @param {number} [itemId] - Filter by item ID
 * @param {number} [branchId] - Filter by branch ID
 * @param {number} [page=1] - Page number (1-indexed)
 * @param {number} [limit=20] - Items per page (max 100)
 * @returns {Object} 200 - Paginated purchase patterns
 * @returns {Object} 401 - Unauthorized
 * @returns {Object} 500 - Internal server error
 * @security JWT
 */
router.get(
  '/purchase-patterns',
  authorize(Permission.ANALYTICS_READ),
  validateQuery(PurchasePatternQuerySchema),
  async (req: AuthRequest, res) => {
    const { itemId, branchId, page, limit } = req.query as {
      itemId?: number;
      branchId?: number;
      page: number;
      limit: number;
    };

    try {
      // Build where clause
      const where: {
        itemId?: number;
        branchId?: number | null;
      } = {};

      if (itemId) where.itemId = itemId;
      if (branchId !== undefined) where.branchId = branchId ?? null;

      const skip = (page - 1) * limit;

      const [total, data] = await prisma.$transaction([
        prisma.purchasePattern.count({ where }),
        prisma.purchasePattern.findMany({
          where,
          skip,
          take: limit,
          orderBy: { confidenceScore: 'desc' },
          include: {
            item: { select: { id: true, name: true } },
            branch: { select: { id: true, name: true } },
          },
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      res.json({
        data,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrevious: page > 1,
        },
      });
    } catch (error) {
      logger.error({ err: error }, 'Failed to retrieve purchase patterns');
      res.status(500).json({ error: 'Failed to retrieve purchase patterns' });
    }
  }
);

/**
 * GET /api/analytics/foundation/benchmarks/:itemId
 *
 * Retrieves benchmark statistics for a specific item across the network.
 * Includes network average, min/max prices, and standard deviation.
 *
 * @route GET /api/analytics/foundation/benchmarks/:itemId
 * @group Analytics Foundation - Benchmarking
 * @param {number} itemId.path.required - Item ID to get benchmarks for
 * @returns {Object} 200 - Benchmark statistics
 * @returns {Object} 401 - Unauthorized
 * @returns {Object} 404 - Benchmark data not found
 * @returns {Object} 500 - Internal server error
 * @security JWT
 */
router.get(
  '/benchmarks/:itemId',
  authorize(Permission.ANALYTICS_READ),
  validateParams(ItemIdParamSchema),
  async (req: AuthRequest, res) => {
    const itemId = Number(req.params.itemId);

    try {
      const cacheService = await getRedisServiceSingleton();
      const crossLocationService = createCrossLocationService(prisma, cacheService);

      const result = await crossLocationService.getBenchmarkStats(itemId);

      if (!result) {
        return res.status(404).json({
          error: 'Benchmark data not found',
          message: `No benchmark data available for item ${itemId}`,
        });
      }

      res.json(result);
    } catch (error) {
      logger.error({ err: error, itemId }, 'Failed to retrieve benchmark stats');
      res.status(500).json({ error: 'Failed to retrieve benchmark stats' });
    }
  }
);

/**
 * GET /api/analytics/foundation/consolidation-opportunities
 *
 * Identifies vendor consolidation opportunities across the network.
 * Analyzes cases where multiple vendors supply the same item
 * and calculates potential savings from standardization.
 *
 * @route GET /api/analytics/foundation/consolidation-opportunities
 * @group Analytics Foundation - Consolidation analysis
 * @returns {Object[]} 200 - List of consolidation opportunities with savings estimates
 * @returns {Object} 401 - Unauthorized
 * @returns {Object} 500 - Internal server error
 * @security JWT
 */
router.get(
  '/consolidation-opportunities',
  authorize(Permission.ANALYTICS_READ),
  async (req: AuthRequest, res) => {
    try {
      const cacheService = await getRedisServiceSingleton();
      const crossLocationService = createCrossLocationService(prisma, cacheService);

      const opportunities = await crossLocationService.findConsolidationOpportunities();
      res.json(opportunities);
    } catch (error) {
      logger.error({ err: error }, 'Failed to retrieve consolidation opportunities');
      res.status(500).json({ error: 'Failed to retrieve consolidation opportunities' });
    }
  }
);

export default router;
