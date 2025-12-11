import express from 'express';
import prisma from '../prisma';
import logger from '../utils/logger';
import { createRedisService, RedisService } from '../services/infrastructure/redisService';

const router = express.Router();

// Lazy initialization of Redis service
let redisService: RedisService | null = null;

function getRedisService(): RedisService | null {
  if (!redisService) {
    try {
      redisService = createRedisService();
    } catch (error) {
      logger.warn({ err: error }, 'Failed to initialize Redis service for health check');
      return null;
    }
  }
  return redisService;
}

/**
 * Basic health check response for quick status
 */
interface BasicHealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  database: 'connected' | 'disconnected';
  timestamp: string;
}

/**
 * Extended health check response including Redis and analytics status
 */
interface ExtendedHealthCheckResponse extends BasicHealthCheckResponse {
  redis?: {
    connected: boolean;
    latencyMs?: number;
  };
  analytics?: {
    available: boolean;
    message?: string;
  };
}

/**
 * Health check endpoint for load balancers and orchestrators.
 * Verifies database connectivity and returns system health status.
 *
 * GET /health
 *
 * Query params:
 * - extended=true: Include Redis and analytics status
 *
 * Returns:
 * - 200 with { status: 'healthy', database: 'connected' } on success
 * - 503 with { status: 'unhealthy', database: 'disconnected' } on failure
 */
router.get('/', async (req, res) => {
  const timestamp = new Date().toISOString();
  const extended = req.query.extended === 'true';

  let databaseHealthy = false;
  let redisHealthy = false;
  let redisLatencyMs: number | undefined;

  // Check database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseHealthy = true;
  } catch (error) {
    logger.error({ err: error }, 'Health check failed - database unreachable');
  }

  // For extended health check, also check Redis
  if (extended) {
    const redis = getRedisService();
    if (redis) {
      try {
        const startTime = Date.now();
        const pingResult = await redis.ping();
        redisLatencyMs = Date.now() - startTime;
        redisHealthy = pingResult;
      } catch (error) {
        logger.warn({ err: error }, 'Health check - Redis unreachable');
        redisHealthy = false;
      }
    }
  }

  // Basic response
  const basicResponse: BasicHealthCheckResponse = {
    status: databaseHealthy ? 'healthy' : 'unhealthy',
    database: databaseHealthy ? 'connected' : 'disconnected',
    timestamp,
  };

  // Return basic response if not extended
  if (!extended) {
    return res.status(databaseHealthy ? 200 : 503).json(basicResponse);
  }

  // Extended response with Redis and analytics status
  const extendedResponse: ExtendedHealthCheckResponse = {
    ...basicResponse,
    redis: {
      connected: redisHealthy,
      latencyMs: redisLatencyMs,
    },
    analytics: {
      available: databaseHealthy && redisHealthy,
      message: !redisHealthy
        ? 'Redis unavailable - analytics features may be degraded'
        : undefined,
    },
  };

  // For extended check, only healthy if both DB and Redis are connected
  const overallHealthy = databaseHealthy && redisHealthy;
  extendedResponse.status = overallHealthy ? 'healthy' : 'unhealthy';

  res.status(overallHealthy ? 200 : 503).json(extendedResponse);
});

/**
 * Analytics-specific health check endpoint.
 * Provides detailed status of analytics infrastructure.
 *
 * GET /health/analytics
 *
 * Returns detailed analytics health including:
 * - Redis connection status and latency
 * - Last job run timestamps (when available)
 */
router.get('/analytics', async (_req, res) => {
  const timestamp = new Date().toISOString();

  let redisHealthy = false;
  let redisLatencyMs: number | undefined;

  const redis = getRedisService();
  if (redis) {
    try {
      const startTime = Date.now();
      const pingResult = await redis.ping();
      redisLatencyMs = Date.now() - startTime;
      redisHealthy = pingResult;
    } catch (error) {
      logger.warn({ err: error }, 'Analytics health check - Redis unreachable');
    }
  }

  // Try to get last job run timestamps from Redis
  let lastJobRuns: Record<string, string | null> = {};
  if (redis && redisHealthy) {
    try {
      const jobKeys = [
        'analytics:job:compute-spending-metrics:lastRun',
        'analytics:job:compute-price-benchmarks:lastRun',
        'analytics:job:analyze-purchase-patterns:lastRun',
        'analytics:job:generate-recommendations:lastRun',
        'analytics:job:detect-anomalies:lastRun',
      ];

      for (const key of jobKeys) {
        const jobName = key.split(':')[2];
        const lastRun = await redis.getRaw(key);
        lastJobRuns[jobName] = lastRun;
      }
    } catch (error) {
      logger.warn({ err: error }, 'Failed to fetch last job run timestamps');
    }
  }

  const response = {
    timestamp,
    status: redisHealthy ? 'healthy' : 'degraded',
    redis: {
      connected: redisHealthy,
      latencyMs: redisLatencyMs,
    },
    queues: {
      // Queue status would require BullMQ integration
      // For now, return placeholder indicating queue system is not yet implemented
      status: 'not_implemented',
      message: 'Job queue monitoring requires BullMQ integration (Phase 5)',
    },
    lastJobRuns,
  };

  res.status(redisHealthy ? 200 : 503).json(response);
});

export default router;
