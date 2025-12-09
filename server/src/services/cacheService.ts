import NodeCache from 'node-cache';
import { logger } from '../utils/logger';

const cache = new NodeCache({
  stdTTL: 60,
  checkperiod: 120,
  useClones: false, // Better performance, but be careful with mutations
});

export const CacheTTL = {
  ANALYTICS_DASHBOARD: 60,    // 1 minute
  ANALYTICS_SPENDING: 300,    // 5 minutes
  ANALYTICS_TRENDS: 600,      // 10 minutes
  ANALYTICS_PRICE_CHANGES: 600, // 10 minutes
  ENTITY_LIST: 30,            // 30 seconds
  LOOKUP_DATA: 3600,          // 1 hour (branches, departments)
} as const;

export const generateCacheKey = (prefix: string, params: Record<string, unknown> = {}): string => {
  const sortedParams = Object.keys(params)
    .sort()
    .filter(k => params[k] !== undefined && params[k] !== null)
    .map(k => `${k}:${JSON.stringify(params[k])}`)
    .join('|');
  return sortedParams ? `${prefix}:${sortedParams}` : `${prefix}:default`;
};

export const getOrSet = async <T>(
  key: string,
  ttl: number,
  fetchFn: () => Promise<T>
): Promise<T> => {
  const cached = cache.get<T>(key);
  if (cached !== undefined) {
    logger.debug({ key }, 'Cache hit');
    return cached;
  }

  logger.debug({ key }, 'Cache miss');
  const result = await fetchFn();
  cache.set(key, result, ttl);
  return result;
};

export const invalidateByPrefix = (prefix: string): void => {
  const keys = cache.keys().filter(k => k.startsWith(prefix));
  if (keys.length > 0) {
    keys.forEach(k => cache.del(k));
    logger.info({ prefix, count: keys.length }, 'Cache invalidated');
  }
};

export const invalidateKey = (key: string): void => {
  cache.del(key);
};

export const invalidateAll = (): void => {
  cache.flushAll();
  logger.info('All cache invalidated');
};

export const getCacheStats = () => cache.getStats();
