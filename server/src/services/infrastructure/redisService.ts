import Redis from 'ioredis';
import { logger } from '../../utils/logger';
import { ICacheService } from '../../domain/analytics/services/ICacheService';
import { CacheError } from '../../errors/AnalyticsError';

/**
 * Redis implementation of ICacheService
 * ARCHITECTURE: Implements interface to allow swapping implementations
 * Uses dependency injection - no singleton pattern
 */
export class RedisService implements ICacheService {
  private client: Redis;
  private pubClient: Redis;
  private subClient: Redis;
  private isConnected: boolean = false;

  /**
   * ARCHITECTURE: Accept dependencies via constructor (no singleton)
   * @param redisUrl - Redis connection URL
   */
  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          logger.error({ times }, 'Redis retry limit exceeded');
          return null; // Stop retrying
        }
        return Math.min(times * 200, 2000);
      },
    });

    this.pubClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
    });

    this.subClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.isConnected = true;
      logger.info('Redis client connected');
    });

    this.client.on('error', (err) => {
      this.isConnected = false;
      logger.error({ err }, 'Redis client error');
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis client connection closed');
    });

    this.pubClient.on('error', (err) =>
      logger.error({ err }, 'Redis pub client error')
    );
    this.subClient.on('error', (err) =>
      logger.error({ err }, 'Redis sub client error')
    );
  }

  // ============================================================================
  // ICacheService Implementation
  // ============================================================================

  /**
   * Get a cached value by key
   * @param key - Cache key
   * @returns The cached value or null if not found
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (value === null) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error({ error, key }, 'Redis get error');
      throw new CacheError('get', `Failed to get key: ${key}`, error as Error);
    }
  }

  /**
   * Set a value in cache
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds (optional)
   */
  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.client.setex(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      logger.error({ error, key }, 'Redis set error');
      throw new CacheError('set', `Failed to set key: ${key}`, error as Error);
    }
  }

  /**
   * Delete a cached value by key
   * @param key - Cache key
   */
  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error({ error, key }, 'Redis del error');
      throw new CacheError('del', `Failed to delete key: ${key}`, error as Error);
    }
  }

  /**
   * Invalidate all cache entries matching a prefix
   * Uses SCAN for production safety (doesn't block Redis)
   * @param prefix - Key prefix to match
   */
  async invalidateByPrefix(prefix: string): Promise<void> {
    try {
      const stream = this.client.scanStream({
        match: `${prefix}*`,
        count: 100,
      });

      const keysToDelete: string[] = [];

      stream.on('data', (keys: string[]) => {
        keysToDelete.push(...keys);
      });

      await new Promise<void>((resolve, reject) => {
        stream.on('end', async () => {
          if (keysToDelete.length > 0) {
            // Delete in batches to avoid blocking
            const batchSize = 100;
            for (let i = 0; i < keysToDelete.length; i += batchSize) {
              const batch = keysToDelete.slice(i, i + batchSize);
              await this.client.del(...batch);
            }
            logger.info(
              { prefix, count: keysToDelete.length },
              'Cache invalidated by prefix'
            );
          }
          resolve();
        });
        stream.on('error', reject);
      });
    } catch (error) {
      logger.error({ error, prefix }, 'Redis invalidateByPrefix error');
      throw new CacheError(
        'invalidateByPrefix',
        `Failed to invalidate keys with prefix: ${prefix}`,
        error as Error
      );
    }
  }

  /**
   * Health check for the cache service
   * @returns true if cache is healthy
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error({ error }, 'Redis ping failed');
      return false;
    }
  }

  // ============================================================================
  // Additional Redis Operations (not in ICacheService)
  // ============================================================================

  /**
   * Get the raw string value (without JSON parsing)
   */
  async getRaw(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /**
   * Set a raw string value (without JSON serialization)
   */
  async setRaw(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.setex(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  // ============================================================================
  // Pub/Sub Operations
  // ============================================================================

  /**
   * Publish a message to a channel
   * @param channel - Channel name
   * @param message - Message to publish
   */
  async publish(channel: string, message: string): Promise<void> {
    await this.pubClient.publish(channel, message);
  }

  /**
   * Subscribe to a channel
   * @param channel - Channel name
   * @param handler - Message handler function
   */
  async subscribe(
    channel: string,
    handler: (message: string) => void
  ): Promise<void> {
    await this.subClient.subscribe(channel);
    this.subClient.on('message', (ch, msg) => {
      if (ch === channel) {
        handler(msg);
      }
    });
  }

  /**
   * Unsubscribe from a channel
   * @param channel - Channel name
   */
  async unsubscribe(channel: string): Promise<void> {
    await this.subClient.unsubscribe(channel);
  }

  // ============================================================================
  // Set Operations (for deduplication, membership checks)
  // ============================================================================

  /**
   * Add members to a set
   * @param key - Set key
   * @param members - Members to add
   * @returns Number of members added
   */
  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.client.sadd(key, ...members);
  }

  /**
   * Get all members of a set
   * @param key - Set key
   * @returns Array of members
   */
  async smembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  /**
   * Check if a member exists in a set
   * @param key - Set key
   * @param member - Member to check
   * @returns true if member exists
   */
  async sismember(key: string, member: string): Promise<boolean> {
    const result = await this.client.sismember(key, member);
    return result === 1;
  }

  /**
   * Remove members from a set
   * @param key - Set key
   * @param members - Members to remove
   * @returns Number of members removed
   */
  async srem(key: string, ...members: string[]): Promise<number> {
    return this.client.srem(key, ...members);
  }

  // ============================================================================
  // Sorted Set Operations (for time-series, leaderboards, ranking)
  // ============================================================================

  /**
   * Add a member to a sorted set with score
   * @param key - Sorted set key
   * @param score - Score for ranking
   * @param member - Member to add
   * @returns Number of members added
   */
  async zadd(key: string, score: number, member: string): Promise<number> {
    return this.client.zadd(key, score, member);
  }

  /**
   * Get members in a range by index
   * @param key - Sorted set key
   * @param start - Start index
   * @param stop - Stop index
   * @returns Array of members
   */
  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.zrange(key, start, stop);
  }

  /**
   * Get members in a range by score
   * @param key - Sorted set key
   * @param min - Minimum score
   * @param max - Maximum score
   * @returns Array of members
   */
  async zrangebyscore(
    key: string,
    min: number,
    max: number
  ): Promise<string[]> {
    return this.client.zrangebyscore(key, min, max);
  }

  /**
   * Remove a member from a sorted set
   * @param key - Sorted set key
   * @param member - Member to remove
   * @returns Number of members removed
   */
  async zrem(key: string, member: string): Promise<number> {
    return this.client.zrem(key, member);
  }

  // ============================================================================
  // Hash Operations (for structured data)
  // ============================================================================

  /**
   * Set a field in a hash
   * @param key - Hash key
   * @param field - Field name
   * @param value - Field value
   */
  async hset(key: string, field: string, value: string): Promise<void> {
    await this.client.hset(key, field, value);
  }

  /**
   * Get a field from a hash
   * @param key - Hash key
   * @param field - Field name
   * @returns Field value or null
   */
  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  /**
   * Get all fields and values from a hash
   * @param key - Hash key
   * @returns Object with all fields and values
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  // ============================================================================
  // Utility Operations
  // ============================================================================

  /**
   * Check if a key exists
   * @param key - Key to check
   * @returns true if key exists
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  /**
   * Set expiration on a key
   * @param key - Key to set expiration on
   * @param seconds - TTL in seconds
   */
  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }

  /**
   * Get TTL of a key
   * @param key - Key to check
   * @returns TTL in seconds, -1 if no TTL, -2 if key doesn't exist
   */
  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  /**
   * Get connection status
   */
  isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * Get the underlying Redis client for advanced operations
   * Use with caution - prefer using the abstracted methods
   */
  getClient(): Redis {
    return this.client;
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Gracefully disconnect all Redis clients
   */
  async disconnect(): Promise<void> {
    logger.info('Disconnecting Redis clients...');
    await Promise.all([
      this.client.quit(),
      this.pubClient.quit(),
      this.subClient.quit(),
    ]);
    this.isConnected = false;
    logger.info('Redis clients disconnected');
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * ARCHITECTURE: Factory function for creating new instances
 * Use this when you need a new, isolated Redis connection
 *
 * @param redisUrl - Optional Redis URL (defaults to env or localhost)
 * @returns RedisService instance
 */
export function createRedisService(redisUrl?: string): RedisService {
  const url = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
  return new RedisService(url);
}

// ============================================================================
// Singleton Management for Route Handlers
// ============================================================================

/**
 * Module-level singleton instance
 * Initialized lazily with mutex protection to prevent race conditions
 */
let singletonInstance: RedisService | null = null;
let initializationPromise: Promise<RedisService> | null = null;

/**
 * Get or create the singleton RedisService instance
 * ARCHITECTURE: Uses mutex pattern to prevent race conditions during lazy initialization
 * Multiple concurrent calls will await the same initialization promise
 *
 * @returns Promise resolving to the singleton RedisService instance
 */
export async function getRedisServiceSingleton(): Promise<RedisService> {
  // Fast path: already initialized
  if (singletonInstance) {
    return singletonInstance;
  }

  // Mutex: if initialization is in progress, wait for it
  if (initializationPromise) {
    return initializationPromise;
  }

  // Start initialization (only one caller will reach here)
  initializationPromise = (async () => {
    try {
      const url = process.env.REDIS_URL || 'redis://localhost:6379';
      singletonInstance = new RedisService(url);

      // Wait for connection to be established
      const isHealthy = await singletonInstance.ping();
      if (!isHealthy) {
        logger.warn('Redis singleton created but health check failed');
      }

      return singletonInstance;
    } catch (error) {
      // Reset on failure so next call can retry
      initializationPromise = null;
      throw error;
    }
  })();

  return initializationPromise;
}

/**
 * Synchronous getter for singleton instance
 * Returns null if not yet initialized
 * ARCHITECTURE: Use getRedisServiceSingleton() for safe initialization
 */
export function getRedisServiceSingletonSync(): RedisService | null {
  return singletonInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export async function resetRedisServiceSingleton(): Promise<void> {
  if (singletonInstance) {
    await singletonInstance.disconnect();
    singletonInstance = null;
    initializationPromise = null;
  }
}
