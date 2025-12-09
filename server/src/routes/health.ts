import express from 'express';
import prisma from '../prisma';
import logger from '../utils/logger';

const router = express.Router();

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  database: 'connected' | 'disconnected';
  timestamp: string;
}

/**
 * Health check endpoint for load balancers and orchestrators.
 * Verifies database connectivity and returns system health status.
 *
 * GET /health
 *
 * Returns:
 * - 200 with { status: 'healthy', database: 'connected' } on success
 * - 503 with { status: 'unhealthy', database: 'disconnected' } on failure
 */
router.get('/', async (_req, res) => {
  const timestamp = new Date().toISOString();

  try {
    // Verify database connectivity with a simple query
    await prisma.$queryRaw`SELECT 1`;

    const response: HealthCheckResponse = {
      status: 'healthy',
      database: 'connected',
      timestamp,
    };

    res.status(200).json(response);
  } catch (error) {
    logger.error({ err: error }, 'Health check failed - database unreachable');

    const response: HealthCheckResponse = {
      status: 'unhealthy',
      database: 'disconnected',
      timestamp,
    };

    res.status(503).json(response);
  }
});

export default router;
