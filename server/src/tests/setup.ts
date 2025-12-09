import { vi, beforeAll, beforeEach, afterAll } from 'vitest';
import { resetIdCounter } from './helpers/test-factories';
import { getPrismaMock, resetSingletonPrismaMock } from './helpers/prisma-mock';

// Set test environment variables
// Use a proper 64+ character secret that passes validation
process.env.JWT_SECRET = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
process.env.NODE_ENV = 'test';

// Mock the Prisma client module
vi.mock('../prisma', () => {
  return {
    default: getPrismaMock(),
  };
});

// Mock the pubsub service to prevent side effects
vi.mock('../services/pubsub', () => {
  return {
    default: {
      publish: vi.fn(),
      subscribe: vi.fn(),
      emit: vi.fn(),
      on: vi.fn(),
    },
    PubSubService: {
      INVOICE_APPROVED: 'INVOICE_APPROVED',
      PO_STATUS_CHANGED: 'PO_STATUS_CHANGED',
      getInstance: vi.fn(() => ({
        publish: vi.fn(),
        subscribe: vi.fn(),
        emit: vi.fn(),
        on: vi.fn(),
      })),
    },
  };
});

// Mock the logger to prevent log output during tests
vi.mock('../utils/logger', () => {
  return {
    default: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      fatal: vi.fn(),
      child: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        fatal: vi.fn(),
      })),
    },
  };
});

// Mock the cache service to prevent actual caching during tests
vi.mock('../services/cacheService', () => ({
  getOrSet: vi.fn((key, ttl, fn) => fn()),
  generateCacheKey: vi.fn((prefix, params) => `${prefix}:mocked`),
  invalidateByPrefix: vi.fn(),
  invalidateKey: vi.fn(),
  invalidateAll: vi.fn(),
  getCacheStats: vi.fn(() => ({ hits: 0, misses: 0, keys: 0 })),
  CacheTTL: {
    ANALYTICS_DASHBOARD: 60,
    ANALYTICS_SPENDING: 300,
    ANALYTICS_TRENDS: 600,
    ANALYTICS_PRICE_CHANGES: 600,
    ENTITY_LIST: 30,
    LOOKUP_DATA: 3600,
  },
}));

// Mock the metrics service to prevent actual metric collection during tests
vi.mock('../services/metricsService', () => {
  const mockCounter = {
    inc: vi.fn(),
    labels: vi.fn(() => ({ inc: vi.fn() })),
  };
  const mockHistogram = {
    observe: vi.fn(),
    labels: vi.fn(() => ({ observe: vi.fn() })),
  };
  const mockGauge = {
    set: vi.fn(),
    labels: vi.fn(() => ({ set: vi.fn() })),
  };
  return {
    httpRequestsTotal: mockCounter,
    httpRequestDuration: mockHistogram,
    invoicesCreated: mockCounter,
    invoicesApproved: mockCounter,
    invoicesRejected: mockCounter,
    poStatusChanges: mockCounter,
    authLoginTotal: mockCounter,
    authRefreshTotal: mockCounter,
    cacheHitRate: mockGauge,
    cacheKeys: mockGauge,
    cacheHits: mockCounter,
    cacheMisses: mockCounter,
    getMetrics: vi.fn().mockResolvedValue(
      '# HELP test_metric Test metric\n# TYPE test_metric counter\ntest_metric 1\n' +
        '# HELP cache_hit_rate Cache hit rate percentage\n# TYPE cache_hit_rate gauge\ncache_hit_rate 0\n' +
        '# HELP cache_keys_total Total number of cached keys\n# TYPE cache_keys_total gauge\ncache_keys_total 0\n' +
        '# HELP cache_hits_total Total cache hits\n# TYPE cache_hits_total counter\ncache_hits_total 0\n' +
        '# HELP cache_misses_total Total cache misses\n# TYPE cache_misses_total counter\ncache_misses_total 0\n'
    ),
    getContentType: vi.fn().mockReturnValue('text/plain; version=0.0.4; charset=utf-8'),
  };
});

beforeAll(() => {
  // Global setup before all tests
});

beforeEach(() => {
  // Reset mocks before each test
  vi.clearAllMocks();
  resetSingletonPrismaMock();
  resetIdCounter();
});

afterAll(() => {
  // Global cleanup after all tests
  vi.restoreAllMocks();
});
