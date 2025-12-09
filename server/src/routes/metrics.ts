import { Router, Request, Response, NextFunction } from 'express';
import { getMetrics, getContentType } from '../services/metricsService';
import logger from '../utils/logger';

const router = Router();

/**
 * Metrics authentication middleware.
 *
 * In production, requires either:
 * 1. A valid metrics token (METRICS_TOKEN env var) via header or query param
 * 2. Request from an allowed IP address (METRICS_ALLOWED_IPS env var)
 *
 * In development, metrics are accessible without authentication.
 */
const metricsAuth = (req: Request, res: Response, next: NextFunction): void => {
  // In production, require a metrics token or IP allowlist
  if (process.env.NODE_ENV === 'production') {
    const metricsToken = process.env.METRICS_TOKEN;
    const providedToken = req.headers['x-metrics-token'] || req.query.token;

    // If METRICS_TOKEN is set, require it
    if (metricsToken && providedToken !== metricsToken) {
      logger.warn({ ip: req.ip }, 'Unauthorized metrics access attempt');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Optionally check for allowed IPs (Prometheus server, localhost, etc.)
    const allowedIPs = (process.env.METRICS_ALLOWED_IPS || '127.0.0.1,::1').split(',');
    const clientIP = req.ip || req.socket.remoteAddress || '';

    // If no token provided, check IP
    if (!metricsToken && !allowedIPs.some((ip) => clientIP.includes(ip.trim()))) {
      logger.warn({ ip: clientIP, allowedIPs }, 'Forbidden metrics access from disallowed IP');
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
  }

  next();
};

/**
 * GET /metrics
 * Prometheus metrics endpoint.
 *
 * Returns metrics in Prometheus text format including:
 * - Default Node.js metrics (memory, CPU, event loop)
 * - HTTP request metrics (count, duration)
 * - Business metrics (invoices, purchase orders, auth)
 *
 * Security:
 * - In production, requires METRICS_TOKEN header/query or allowed IP
 * - In development, accessible without authentication
 */
router.get('/', metricsAuth, async (_req, res) => {
  try {
    res.set('Content-Type', getContentType());
    res.send(await getMetrics());
  } catch (error) {
    logger.error({ err: error }, 'Error collecting metrics');
    res.status(500).send('Error collecting metrics');
  }
});

export default router;
