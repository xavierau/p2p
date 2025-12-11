/**
 * Cache service interface - allows swapping between node-cache and Redis
 * ARCHITECTURE: Abstracts caching to enable migration without code changes
 */
export interface ICacheService {
  /**
   * Get a cached value by key
   * @param key - Cache key
   * @returns The cached value or null if not found
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a value in cache
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds (optional)
   */
  set(key: string, value: unknown, ttl?: number): Promise<void>;

  /**
   * Delete a cached value by key
   * @param key - Cache key
   */
  del(key: string): Promise<void>;

  /**
   * Invalidate all cache entries matching a prefix
   * @param prefix - Key prefix to match
   */
  invalidateByPrefix(prefix: string): Promise<void>;

  /**
   * Health check for the cache service
   * @returns true if cache is healthy
   */
  ping(): Promise<boolean>;
}
