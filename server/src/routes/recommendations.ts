import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { validateQuery, validateParams, validateBody } from '../middleware/validateParams';
import { analyticsLimiter } from '../middleware/rateLimiter';
import { Permission } from '../constants/permissions';
import { AuthRequest } from '../types/auth';
import { logger } from '../utils/logger';
import { IdParamSchema } from '../utils/validation';
import {
  RecommendationQuerySchema,
  RecommendationDismissSchema,
  RecommendationApplySchema,
} from '../schemas/analytics.schema';
import prisma from '../prisma';
import pubsub from '../services/pubsub';
import {
  getRedisServiceSingleton,
  RedisService,
} from '../services/infrastructure/redisService';
import { createRecommendationService, RecommendationService } from '../services/recommendations';
import { NotFoundError } from '../errors/AppError';

const router = express.Router();

// Module-level cache for recommendation service (initialized lazily with mutex protection)
let recommendationService: RecommendationService | null = null;
let serviceInitPromise: Promise<RecommendationService> | null = null;

/**
 * Get or create the singleton RecommendationService instance
 * Uses mutex pattern to prevent race conditions during initialization
 */
async function getRecommendationService(): Promise<RecommendationService> {
  // Fast path: already initialized
  if (recommendationService) {
    return recommendationService;
  }

  // Mutex: if initialization is in progress, wait for it
  if (serviceInitPromise) {
    return serviceInitPromise;
  }

  // Start initialization
  serviceInitPromise = (async () => {
    try {
      const redisService = await getRedisServiceSingleton();
      recommendationService = createRecommendationService(prisma, redisService, pubsub);
      return recommendationService;
    } catch (error) {
      serviceInitPromise = null;
      throw error;
    }
  })();

  return serviceInitPromise;
}

// Apply authentication and rate limiting to all routes
router.use(authenticateToken);
router.use(analyticsLimiter);

// ============================================================================
// GET /api/recommendations
// Returns paginated recommendations with optional filters
// ============================================================================
router.get(
  '/',
  authorize(Permission.ANALYTICS_READ),
  validateQuery(RecommendationQuerySchema),
  async (req: AuthRequest, res) => {
    const { status, type, priority, page, limit } = req.query as {
      status?: 'PENDING' | 'VIEWED' | 'DISMISSED' | 'APPLIED' | 'EXPIRED';
      type?: string;
      priority?: number;
      page: number;
      limit: number;
    };

    try {
      const service = await getRecommendationService();

      const result = await service.list(
        {
          status: status as any,
          type: type as any,
          priority,
        },
        { page, limit }
      );

      res.json(result);
    } catch (error) {
      logger.error({ err: error }, 'Failed to retrieve recommendations');
      res.status(500).json({ error: 'Failed to retrieve recommendations' });
    }
  }
);

// ============================================================================
// GET /api/recommendations/:id
// Returns a single recommendation by ID
// ============================================================================
router.get(
  '/:id',
  authorize(Permission.ANALYTICS_READ),
  validateParams(IdParamSchema),
  async (req: AuthRequest, res) => {
    const id = Number(req.params.id);

    try {
      const service = await getRecommendationService();
      const recommendation = await service.getById(id);

      if (!recommendation) {
        return res.status(404).json({
          error: 'Recommendation not found',
          code: 'NOT_FOUND',
        });
      }

      res.json(recommendation);
    } catch (error) {
      logger.error({ err: error, id }, 'Failed to retrieve recommendation');
      res.status(500).json({ error: 'Failed to retrieve recommendation' });
    }
  }
);

// ============================================================================
// PATCH /api/recommendations/:id/view
// Marks a recommendation as viewed
// ARCHITECTURE: Uses PATCH for partial state update per REST conventions
// ============================================================================
router.patch(
  '/:id/view',
  authorize(Permission.RECOMMENDATION_MANAGE),
  validateParams(IdParamSchema),
  async (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    try {
      const service = await getRecommendationService();
      const recommendation = await service.markViewed(id, userId);
      res.json(recommendation);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          error: error.message,
          code: 'NOT_FOUND',
        });
      }
      logger.error({ err: error, id, userId }, 'Failed to mark recommendation as viewed');
      res.status(500).json({ error: 'Failed to mark recommendation as viewed' });
    }
  }
);

// ============================================================================
// PATCH /api/recommendations/:id/dismiss
// Dismisses a recommendation with optional reason
// ARCHITECTURE: Uses PATCH for partial state update per REST conventions
// ============================================================================
router.patch(
  '/:id/dismiss',
  authorize(Permission.RECOMMENDATION_MANAGE),
  validateParams(IdParamSchema),
  validateBody(RecommendationDismissSchema),
  async (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    const userId = req.user?.userId;
    const { reason } = req.body as { reason?: string };

    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    try {
      const service = await getRecommendationService();
      const recommendation = await service.dismiss(id, userId, reason);
      res.json(recommendation);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          error: error.message,
          code: 'NOT_FOUND',
        });
      }
      logger.error({ err: error, id, userId }, 'Failed to dismiss recommendation');
      res.status(500).json({ error: 'Failed to dismiss recommendation' });
    }
  }
);

// ============================================================================
// PATCH /api/recommendations/:id/apply
// Marks a recommendation as applied with optional notes
// ARCHITECTURE: Uses PATCH for partial state update per REST conventions
// ============================================================================
router.patch(
  '/:id/apply',
  authorize(Permission.RECOMMENDATION_MANAGE),
  validateParams(IdParamSchema),
  validateBody(RecommendationApplySchema),
  async (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    const userId = req.user?.userId;
    const { notes } = req.body as { notes?: string };

    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    try {
      const service = await getRecommendationService();
      // Note: The current service.apply() doesn't accept notes, but we validate them
      // for future compatibility. The notes could be stored in an audit log.
      const recommendation = await service.apply(id, userId);

      // Log the notes for audit purposes if provided
      if (notes) {
        logger.info(
          { recommendationId: id, userId, notes },
          'Recommendation applied with notes'
        );
      }

      res.json(recommendation);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          error: error.message,
          code: 'NOT_FOUND',
        });
      }
      logger.error({ err: error, id, userId }, 'Failed to apply recommendation');
      res.status(500).json({ error: 'Failed to apply recommendation' });
    }
  }
);

export default router;
