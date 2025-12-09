import { Request, Response, NextFunction } from 'express';
import { httpRequestsTotal, httpRequestDuration } from '../services/metricsService';

/**
 * Endpoints to exclude from metrics tracking.
 * Health and metrics endpoints should not be tracked to avoid noise.
 */
const EXCLUDED_PATHS = ['/health', '/metrics'];

/**
 * Normalizes request path to a route pattern for consistent metric labels.
 * Replaces numeric IDs with :id placeholder to prevent high cardinality.
 *
 * @example
 * - /api/invoices/123 -> /api/invoices/:id
 * - /api/vendors/456/items -> /api/vendors/:id/items
 */
const normalizeRoute = (path: string): string => {
  return path.replace(/\/\d+/g, '/:id');
};

/**
 * Express middleware to collect HTTP request metrics.
 *
 * Tracks:
 * - Total request count by method, route, and status code
 * - Request duration histogram by method, route, and status code
 *
 * Skips tracking for health and metrics endpoints.
 */
export const metricsMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Skip metrics for excluded paths
  if (EXCLUDED_PATHS.some((path) => req.path.startsWith(path))) {
    next();
    return;
  }

  const startTime = process.hrtime.bigint();

  // Hook into response finish event to record metrics
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const durationNs = Number(endTime - startTime);
    const durationSeconds = durationNs / 1e9;

    const route = normalizeRoute(req.path);
    const method = req.method;
    const statusCode = res.statusCode.toString();

    // Increment request counter
    httpRequestsTotal.inc({
      method,
      route,
      status_code: statusCode,
    });

    // Record request duration
    httpRequestDuration.observe(
      {
        method,
        route,
        status_code: statusCode,
      },
      durationSeconds
    );
  });

  next();
};
