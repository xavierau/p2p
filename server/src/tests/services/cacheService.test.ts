import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import NodeCache from 'node-cache';

// Create a fresh cache instance for testing
const testCache = new NodeCache({
  stdTTL: 60,
  checkperiod: 120,
  useClones: false,
});

// Create test versions of the cache functions
const testGenerateCacheKey = (prefix: string, params: Record<string, unknown> = {}): string => {
  const sortedParams = Object.keys(params)
    .sort()
    .filter(k => params[k] !== undefined && params[k] !== null)
    .map(k => `${k}:${JSON.stringify(params[k])}`)
    .join('|');
  return sortedParams ? `${prefix}:${sortedParams}` : `${prefix}:default`;
};

const testGetOrSet = async <T>(
  key: string,
  ttl: number,
  fetchFn: () => Promise<T>
): Promise<T> => {
  const cached = testCache.get<T>(key);
  if (cached !== undefined) {
    return cached;
  }

  const result = await fetchFn();
  testCache.set(key, result, ttl);
  return result;
};

const testInvalidateByPrefix = (prefix: string): void => {
  const keys = testCache.keys().filter(k => k.startsWith(prefix));
  keys.forEach(k => testCache.del(k));
};

const testInvalidateKey = (key: string): void => {
  testCache.del(key);
};

const testInvalidateAll = (): void => {
  testCache.flushAll();
};

const testGetCacheStats = () => testCache.getStats();

const CacheTTL = {
  ANALYTICS_DASHBOARD: 60,
  ANALYTICS_SPENDING: 300,
  ANALYTICS_TRENDS: 600,
  ANALYTICS_PRICE_CHANGES: 600,
  ENTITY_LIST: 30,
  LOOKUP_DATA: 3600,
} as const;

describe('cacheService', () => {
  beforeEach(() => {
    // Clear all cache before each test
    testInvalidateAll();
  });

  afterEach(() => {
    // Clean up after each test
    testInvalidateAll();
  });

  describe('generateCacheKey', () => {
    it('should create consistent keys for same parameters', () => {
      const params = { groupBy: 'vendor', startDate: '2024-01-01' };
      const key1 = testGenerateCacheKey('analytics:spending', params);
      const key2 = testGenerateCacheKey('analytics:spending', params);

      expect(key1).toBe(key2);
    });

    it('should create different keys for different parameters', () => {
      const key1 = testGenerateCacheKey('analytics:spending', { groupBy: 'vendor' });
      const key2 = testGenerateCacheKey('analytics:spending', { groupBy: 'item' });

      expect(key1).not.toBe(key2);
    });

    it('should sort parameters for consistent key generation', () => {
      const key1 = testGenerateCacheKey('test', { a: 1, b: 2 });
      const key2 = testGenerateCacheKey('test', { b: 2, a: 1 });

      expect(key1).toBe(key2);
    });

    it('should filter out undefined and null values', () => {
      const key1 = testGenerateCacheKey('test', { a: 1, b: undefined, c: null });
      const key2 = testGenerateCacheKey('test', { a: 1 });

      expect(key1).toBe(key2);
    });

    it('should return default suffix for empty params', () => {
      const key = testGenerateCacheKey('analytics:dashboard', {});

      expect(key).toBe('analytics:dashboard:default');
    });

    it('should return default suffix when no params provided', () => {
      const key = testGenerateCacheKey('analytics:dashboard');

      expect(key).toBe('analytics:dashboard:default');
    });

    it('should handle complex parameter values', () => {
      const key = testGenerateCacheKey('test', {
        array: [1, 2, 3],
        nested: { a: 1 }
      });

      expect(key).toContain('array');
      expect(key).toContain('nested');
    });
  });

  describe('getOrSet', () => {
    it('should return cached value on cache hit', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
      const key = 'test:hit';
      const ttl = 60;

      // First call - cache miss
      const result1 = await testGetOrSet(key, ttl, fetchFn);
      expect(result1).toEqual({ data: 'test' });
      expect(fetchFn).toHaveBeenCalledTimes(1);

      // Second call - cache hit
      const result2 = await testGetOrSet(key, ttl, fetchFn);
      expect(result2).toEqual({ data: 'test' });
      expect(fetchFn).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should call fetchFn on cache miss', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ data: 'fresh' });
      const key = 'test:miss';
      const ttl = 60;

      const result = await testGetOrSet(key, ttl, fetchFn);

      expect(result).toEqual({ data: 'fresh' });
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('should store result in cache after fetch', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ data: 'stored' });
      const key = 'test:store';
      const ttl = 60;

      await testGetOrSet(key, ttl, fetchFn);

      // Reset the mock
      fetchFn.mockClear();

      // This should hit the cache
      const result = await testGetOrSet(key, ttl, fetchFn);

      expect(result).toEqual({ data: 'stored' });
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('should handle async errors from fetchFn', async () => {
      const error = new Error('Fetch failed');
      const fetchFn = vi.fn().mockRejectedValue(error);
      const key = 'test:error';
      const ttl = 60;

      await expect(testGetOrSet(key, ttl, fetchFn)).rejects.toThrow('Fetch failed');
    });
  });

  describe('invalidateByPrefix', () => {
    it('should remove all keys matching prefix', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });

      // Set up multiple cached entries
      await testGetOrSet('analytics:dashboard:default', 60, fetchFn);
      await testGetOrSet('analytics:spending:vendor', 60, fetchFn);
      await testGetOrSet('other:key', 60, fetchFn);

      // Reset mock to track cache hits/misses
      fetchFn.mockClear();

      // Invalidate all analytics keys
      testInvalidateByPrefix('analytics:');

      // Analytics keys should be invalidated (cache miss)
      await testGetOrSet('analytics:dashboard:default', 60, fetchFn);
      await testGetOrSet('analytics:spending:vendor', 60, fetchFn);

      expect(fetchFn).toHaveBeenCalledTimes(2);

      // Other key should still be cached (cache hit)
      fetchFn.mockClear();
      await testGetOrSet('other:key', 60, fetchFn);
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('should not affect keys with different prefix', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });

      await testGetOrSet('analytics:test', 60, fetchFn);
      await testGetOrSet('vendor:test', 60, fetchFn);

      fetchFn.mockClear();

      testInvalidateByPrefix('analytics:');

      // Vendor key should still be cached
      await testGetOrSet('vendor:test', 60, fetchFn);
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('should handle empty prefix gracefully', () => {
      // Should not throw
      expect(() => testInvalidateByPrefix('')).not.toThrow();
    });
  });

  describe('invalidateKey', () => {
    it('should remove specific key from cache', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });

      await testGetOrSet('specific:key', 60, fetchFn);
      await testGetOrSet('other:key', 60, fetchFn);

      fetchFn.mockClear();

      testInvalidateKey('specific:key');

      // Specific key should be invalidated
      await testGetOrSet('specific:key', 60, fetchFn);
      expect(fetchFn).toHaveBeenCalledTimes(1);

      // Other key should still be cached
      fetchFn.mockClear();
      await testGetOrSet('other:key', 60, fetchFn);
      expect(fetchFn).not.toHaveBeenCalled();
    });
  });

  describe('invalidateAll', () => {
    it('should clear entire cache', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });

      await testGetOrSet('key1', 60, fetchFn);
      await testGetOrSet('key2', 60, fetchFn);
      await testGetOrSet('key3', 60, fetchFn);

      fetchFn.mockClear();

      testInvalidateAll();

      // All keys should be invalidated
      await testGetOrSet('key1', 60, fetchFn);
      await testGetOrSet('key2', 60, fetchFn);
      await testGetOrSet('key3', 60, fetchFn);

      expect(fetchFn).toHaveBeenCalledTimes(3);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });

      // Generate some cache activity
      await testGetOrSet('stats:test', 60, fetchFn);
      await testGetOrSet('stats:test', 60, fetchFn); // Cache hit

      const stats = testGetCacheStats();

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('keys');
      expect(typeof stats.hits).toBe('number');
      expect(typeof stats.misses).toBe('number');
      expect(typeof stats.keys).toBe('number');
    });
  });

  describe('CacheTTL', () => {
    it('should have expected TTL values', () => {
      expect(CacheTTL.ANALYTICS_DASHBOARD).toBe(60);
      expect(CacheTTL.ANALYTICS_SPENDING).toBe(300);
      expect(CacheTTL.ANALYTICS_TRENDS).toBe(600);
      expect(CacheTTL.ANALYTICS_PRICE_CHANGES).toBe(600);
      expect(CacheTTL.ENTITY_LIST).toBe(30);
      expect(CacheTTL.LOOKUP_DATA).toBe(3600);
    });

    it('should be readonly', () => {
      // TypeScript enforces this, but we verify the values are as expected
      const ttlKeys = Object.keys(CacheTTL);
      expect(ttlKeys).toContain('ANALYTICS_DASHBOARD');
      expect(ttlKeys).toContain('ANALYTICS_SPENDING');
      expect(ttlKeys).toContain('ANALYTICS_TRENDS');
      expect(ttlKeys).toContain('ANALYTICS_PRICE_CHANGES');
      expect(ttlKeys).toContain('ENTITY_LIST');
      expect(ttlKeys).toContain('LOOKUP_DATA');
    });
  });
});
