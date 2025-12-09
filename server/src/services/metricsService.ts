import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { getCacheStats } from './cacheService';

const register = new Registry();

// Collect default Node.js metrics (memory, CPU, event loop)
collectDefaultMetrics({ register });

// ============================================================================
// HTTP Metrics
// ============================================================================

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

// ============================================================================
// Business Metrics - Invoices
// ============================================================================

export const invoicesCreated = new Counter({
  name: 'invoices_created_total',
  help: 'Total invoices created',
  registers: [register],
});

export const invoicesApproved = new Counter({
  name: 'invoices_approved_total',
  help: 'Total invoices approved',
  registers: [register],
});

export const invoicesRejected = new Counter({
  name: 'invoices_rejected_total',
  help: 'Total invoices rejected',
  registers: [register],
});

// ============================================================================
// Business Metrics - Purchase Orders
// ============================================================================

export const poStatusChanges = new Counter({
  name: 'purchase_order_status_changes_total',
  help: 'Total PO status changes',
  labelNames: ['from_status', 'to_status'],
  registers: [register],
});

// ============================================================================
// Business Metrics - Authentication
// ============================================================================

export const authLoginTotal = new Counter({
  name: 'auth_login_total',
  help: 'Total login attempts',
  labelNames: ['status'],
  registers: [register],
});

export const authRefreshTotal = new Counter({
  name: 'auth_refresh_total',
  help: 'Total token refresh attempts',
  labelNames: ['status'],
  registers: [register],
});

// ============================================================================
// Cache Metrics
// ============================================================================

export const cacheHitRate = new Gauge({
  name: 'cache_hit_rate',
  help: 'Cache hit rate percentage',
  registers: [register],
});

export const cacheKeys = new Gauge({
  name: 'cache_keys_total',
  help: 'Total number of cached keys',
  registers: [register],
});

export const cacheHits = new Counter({
  name: 'cache_hits_total',
  help: 'Total cache hits',
  registers: [register],
});

export const cacheMisses = new Counter({
  name: 'cache_misses_total',
  help: 'Total cache misses',
  registers: [register],
});

// Update cache metrics periodically (every 10 seconds)
setInterval(() => {
  try {
    const stats = getCacheStats();
    const hitRate =
      stats.hits + stats.misses > 0
        ? (stats.hits / (stats.hits + stats.misses)) * 100
        : 0;
    cacheHitRate.set(hitRate);
    cacheKeys.set(stats.keys);
  } catch (error) {
    // Ignore errors if cache service not initialized
  }
}, 10000);

// ============================================================================
// Registry Access
// ============================================================================

export const getMetrics = async (): Promise<string> => {
  return register.metrics();
};

export const getContentType = (): string => {
  return register.contentType;
};
