# Analytics Foundation - Implementation Checklist

**Project**: SME Procurement-to-Payment Management
**Feature**: Analytics & Intelligence Foundation
**Start Date**: 2025-12-10
**Target Completion**: 4 weeks
**Prerequisites**: Existing system with Invoice, Item, Vendor, Branch, PurchaseOrder models
**Architecture Review**: Approved with Modifications (2025-12-10)

---

## Architecture Review Requirements

Before starting implementation, ensure you understand these **required changes**:

### Critical Fixes (Must Address)
1. **DDD Structure**: Create `domain/analytics/` with entities, repositories, services, events
2. **No Singletons**: Use dependency injection via constructor for all services
3. **SpendingMetric Unique Key**: Use `dimensionHash` column instead of composite unique on nullable fields
4. **Bull Job Naming**: Use `job.name` for job routing, not just `jobId`
5. **Transaction Safety**: Wrap multi-step operations in `prisma.$transaction()`

### Important Additions
1. **Zod Schemas**: Add `schemas/analytics.schema.ts` for API validation
2. **ICacheService Interface**: Abstract cache to support node-cache and Redis
3. **Error Classes**: Add `errors/AnalyticsError.ts`
4. **Separate Queues**: Use 3 Bull queues (aggregation, pattern, recommendations)

---

## Quick Start

```bash
# Install dependencies
cd server && pnpm install
pnpm add ioredis bull @types/ioredis @types/bull

# Setup Redis (Docker)
docker run -d --name redis-analytics -p 6379:6379 redis:alpine

# Setup database
cd server
npx prisma db push
npx ts-node prisma/seed-analytics.ts

# Run tests
cd server && npm run test -- analytics
npm run test -- analytics/services
npm run test -- analytics/jobs

# Start development
cd server && pnpm dev    # Terminal 1
```

---

## Phase 1: Database Schema, Domain Layer & Infrastructure Setup (Week 1, Days 1-5)

### 1.1 Database Schema - Analytics Tables

- [ ] Update `server/prisma/schema.prisma`
  - [ ] Create `SpendingMetric` model
    ```prisma
    model SpendingMetric {
      id             Int      @id @default(autoincrement())

      // ARCHITECTURE FIX: Use dimension hash for uniqueness instead of composite key with NULLs
      // PostgreSQL treats NULL != NULL, so composite unique on nullable fields doesn't work properly
      dimensionHash  String   @unique // SHA256 of concatenated dimension values

      // Dimensions
      date           DateTime // Day-level granularity
      itemId         Int?
      item           Item?    @relation(fields: [itemId], references: [id])
      vendorId       Int?
      vendor         Vendor?  @relation(fields: [vendorId], references: [id])
      branchId       Int?
      branch         Branch?  @relation(fields: [branchId], references: [id])
      departmentId   Int?
      department     Department? @relation(fields: [departmentId], references: [id])
      costCenterId   Int?
      costCenter     CostCenter? @relation(fields: [costCenterId], references: [id])

      // Metrics
      totalAmount    Float
      invoiceCount   Int
      quantity       Int?
      avgUnitPrice   Float?

      // Metadata
      computedAt     DateTime @default(now())

      @@index([date, branchId, itemId])
      @@index([date, vendorId, itemId])
      @@index([itemId, branchId, date])
      @@index([vendorId, date])
      @@index([branchId, date])
      @@index([departmentId, date])
    }
    ```

    > **NOTE**: The `dimensionHash` is computed as: `SHA256(date|itemId|vendorId|branchId|departmentId|costCenterId)` where NULL values are represented as 'null' string.
  - [ ] Create `PurchasePattern` model
    ```prisma
    model PurchasePattern {
      id                  Int      @id @default(autoincrement())

      itemId              Int
      item                Item     @relation(fields: [itemId], references: [id])
      branchId            Int?
      branch              Branch?  @relation(fields: [branchId], references: [id])

      // Pattern metrics
      avgOrderCycleDays   Float    // e.g., 4.2 days
      avgOrderQuantity    Float
      avgOrderAmount      Float
      stdDevQuantity      Float    // For anomaly detection
      stdDevAmount        Float

      // Trend indicators
      isIncreasing        Boolean  @default(false)
      isDecreasing        Boolean  @default(false)
      isSeasonal          Boolean  @default(false)
      seasonalityPattern  String?  @db.Text // JSON: monthly patterns

      // Metadata
      lastOrderDate       DateTime?
      nextPredictedOrder  DateTime?
      confidenceScore     Float    @default(0.5) // 0-1

      basedOnInvoices     Int      // Sample size
      analysisStartDate   DateTime
      analysisEndDate     DateTime
      lastUpdated         DateTime @updatedAt

      @@unique([itemId, branchId])
      @@index([branchId])
      @@index([lastOrderDate])
      @@index([nextPredictedOrder])
    }
    ```
  - [ ] Create `PriceSnapshot` model
    ```prisma
    model PriceSnapshot {
      id        Int      @id @default(autoincrement())

      itemId    Int
      item      Item     @relation(fields: [itemId], references: [id])
      vendorId  Int
      vendor    Vendor   @relation(fields: [vendorId], references: [id])
      branchId  Int?
      branch    Branch?  @relation(fields: [branchId], references: [id])

      price     Float
      date      DateTime

      // Statistics (computed from network)
      networkAvgPrice      Float?
      networkMinPrice      Float?
      networkMaxPrice      Float?
      varianceFromAvg      Float?  // Percentage

      @@index([itemId, date])
      @@index([vendorId, itemId, date])
      @@index([branchId, itemId, date])
      @@index([date])
    }
    ```
  - [ ] Create `RecommendationType` enum
    ```prisma
    enum RecommendationType {
      COST_OPTIMIZATION
      VENDOR_SWITCH
      CONSOLIDATION
      WASTE_PREVENTION
      RISK_ALERT
      SEASONAL_OPPORTUNITY
      INVENTORY_REORDER
      PRICE_NEGOTIATION
    }
    ```
  - [ ] Create `RecommendationStatus` enum
    ```prisma
    enum RecommendationStatus {
      PENDING
      VIEWED
      DISMISSED
      APPLIED
      EXPIRED
    }
    ```
  - [ ] Create `Recommendation` model
    ```prisma
    model Recommendation {
      id              Int                @id @default(autoincrement())

      type            RecommendationType
      category        String             // "Cost Optimization", "Risk Alert", etc.

      title           String             // "Switch vendor for Chicken Breast"
      description     String             @db.Text
      reasoning       String             @db.Text // Why this recommendation

      // Impact estimates
      estimatedSavings   Float?
      confidenceScore    Float       @default(0.5) // 0-1
      priority           Int         @default(3)   // 1=critical, 5=low

      // Context data (JSON)
      context         String             @db.Text // Item IDs, vendor IDs, etc.

      // State
      status          RecommendationStatus @default(PENDING)
      createdBy       String             @default("SYSTEM")

      // User interaction
      viewedAt        DateTime?
      viewedBy        Int?               // User ID
      dismissedAt     DateTime?
      dismissedBy     Int?
      dismissReason   String?
      appliedAt       DateTime?
      appliedBy       Int?

      // Metadata
      createdAt       DateTime           @default(now())
      expiresAt       DateTime?

      @@index([status, priority])
      @@index([type, status])
      @@index([createdAt])
      @@index([expiresAt])
    }
    ```
  - [ ] Add relations to existing models:
    - [ ] `Item` model: Add `spendingMetrics SpendingMetric[]`
    - [ ] `Item` model: Add `purchasePatterns PurchasePattern[]`
    - [ ] `Item` model: Add `priceSnapshots PriceSnapshot[]`
    - [ ] `Vendor` model: Add `spendingMetrics SpendingMetric[]`
    - [ ] `Vendor` model: Add `priceSnapshots PriceSnapshot[]`
    - [ ] `Branch` model: Add `spendingMetrics SpendingMetric[]`
    - [ ] `Branch` model: Add `purchasePatterns PurchasePattern[]`
    - [ ] `Branch` model: Add `priceSnapshots PriceSnapshot[]`
    - [ ] `Department` model: Add `spendingMetrics SpendingMetric[]`
    - [ ] `CostCenter` model: Add `spendingMetrics SpendingMetric[]`

- [ ] Run migration: `npx prisma migrate dev --name add-analytics-foundation`
- [ ] Generate Prisma client: `npx prisma generate`
- [ ] Verify in Prisma Studio: `npx prisma studio`
  - [ ] Check all 4 new tables exist
  - [ ] Check indexes created
  - [ ] Check enums created

---

### 1.2 Redis Service Implementation

- [ ] Install Redis dependencies
  ```bash
  cd server
  pnpm add ioredis
  pnpm add -D @types/ioredis
  ```

- [ ] Create `server/src/services/infrastructure/redisService.ts`
  ```typescript
  import Redis from 'ioredis';
  import { logger } from '../../utils/logger';
  import { ICacheService } from '../../domain/analytics/services/ICacheService';

  /**
   * Redis implementation of ICacheService
   * ARCHITECTURE: Implements interface to allow swapping implementations
   */
  export class RedisService implements ICacheService {
    private client: Redis;
    private pubClient: Redis;
    private subClient: Redis;

    // ARCHITECTURE FIX: Accept dependencies via constructor (no singleton)
    constructor(redisUrl: string) {
      this.client = new Redis(redisUrl);
      this.pubClient = new Redis(redisUrl);
      this.subClient = new Redis(redisUrl);

      this.client.on('error', (err) => logger.error({ err }, 'Redis client error'));
      this.pubClient.on('error', (err) => logger.error({ err }, 'Redis pub client error'));
      this.subClient.on('error', (err) => logger.error({ err }, 'Redis sub client error'));
    }

    // Cache operations
    async get(key: string): Promise<string | null> {
      return this.client.get(key);
    }

    async set(key: string, value: string, ttl?: number): Promise<void> {
      if (ttl) {
        await this.client.setex(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
    }

    async del(key: string): Promise<void> {
      await this.client.del(key);
    }

    async invalidateByPrefix(prefix: string): Promise<void> {
      const keys = await this.client.keys(`${prefix}*`);
      if (keys.length > 0) {
        await this.client.del(...keys);
        logger.info({ prefix, count: keys.length }, 'Cache invalidated by prefix');
      }
    }

    // Pub/Sub
    async publish(channel: string, message: string): Promise<void> {
      await this.pubClient.publish(channel, message);
    }

    async subscribe(channel: string, handler: (message: string) => void): Promise<void> {
      this.subClient.subscribe(channel);
      this.subClient.on('message', (ch, msg) => {
        if (ch === channel) {
          handler(msg);
        }
      });
    }

    // Sets (for deduplication)
    async sadd(key: string, ...members: string[]): Promise<number> {
      return this.client.sadd(key, ...members);
    }

    async smembers(key: string): Promise<string[]> {
      return this.client.smembers(key);
    }

    async sismember(key: string, member: string): Promise<boolean> {
      const result = await this.client.sismember(key, member);
      return result === 1;
    }

    // Sorted Sets (for time-series, leaderboards)
    async zadd(key: string, score: number, member: string): Promise<number> {
      return this.client.zadd(key, score, member);
    }

    async zrange(key: string, start: number, stop: number): Promise<string[]> {
      return this.client.zrange(key, start, stop);
    }

    async zrangebyscore(key: string, min: number, max: number): Promise<string[]> {
      return this.client.zrangebyscore(key, min, max);
    }

    async zrem(key: string, member: string): Promise<number> {
      return this.client.zrem(key, member);
    }

    // Health check
    async ping(): Promise<boolean> {
      try {
        const result = await this.client.ping();
        return result === 'PONG';
      } catch (error) {
        logger.error({ error }, 'Redis ping failed');
        return false;
      }
    }

    // Cleanup
    async disconnect(): Promise<void> {
      await this.client.quit();
      await this.pubClient.quit();
      await this.subClient.quit();
    }
  }

  // ARCHITECTURE FIX: Factory function instead of singleton
  // Allows dependency injection and easier testing
  export function createRedisService(redisUrl?: string): RedisService {
    const url = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
    return new RedisService(url);
  }

  // For backward compatibility during migration - REMOVE after migration complete
  // export const redisService = createRedisService();
  // export default redisService;
  ```

  > **ARCHITECTURE NOTE**: Do NOT export a singleton instance. Services should be instantiated via factory function or dependency injection container.

- [ ] Update `.env` file
  ```
  REDIS_URL=redis://localhost:6379
  ```

- [ ] Create unit tests: `server/src/services/infrastructure/__tests__/redisService.test.ts`
  - [ ] Test: `get/set` operations
  - [ ] Test: `del` operation
  - [ ] Test: `invalidateByPrefix`
  - [ ] Test: `sadd/smembers` (sets)
  - [ ] Test: `zadd/zrange` (sorted sets)
  - [ ] Test: `ping` health check

- [ ] Run tests: `npm run test -- redisService`
- [ ] Verify: All Redis tests pass

---

### 1.3 Job Queue Service Implementation

- [ ] Install Bull dependencies
  ```bash
  cd server
  pnpm add bull
  pnpm add -D @types/bull
  ```

- [ ] Create `server/src/services/infrastructure/jobQueueService.ts`
  ```typescript
  import Bull, { Queue, Job, JobOptions } from 'bull';
  import { logger } from '../../utils/logger';

  export class JobQueueService {
    private queues: Map<string, Queue> = new Map();
    private redisUrl: string;

    constructor(redisUrl: string) {
      this.redisUrl = redisUrl;
    }

    createQueue(name: string, options?: Bull.QueueOptions): Queue {
      if (this.queues.has(name)) {
        return this.queues.get(name)!;
      }

      const queue = new Bull(name, this.redisUrl, {
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100, // Keep last 100 completed jobs
          removeOnFail: 200,     // Keep last 200 failed jobs
        },
        ...options,
      });

      // Event handlers
      queue.on('error', (error) => {
        logger.error({ error, queueName: name }, 'Queue error');
      });

      queue.on('failed', (job, error) => {
        logger.error({ jobId: job.id, queueName: name, error }, 'Job failed');
      });

      queue.on('completed', (job) => {
        logger.info({ jobId: job.id, queueName: name }, 'Job completed');
      });

      this.queues.set(name, queue);
      return queue;
    }

    getQueue(name: string): Queue | undefined {
      return this.queues.get(name);
    }

    async addJob(queueName: string, data: any, options?: JobOptions): Promise<Job> {
      const queue = this.queues.get(queueName);
      if (!queue) {
        throw new Error(`Queue ${queueName} not found. Create it first with createQueue()`);
      }
      return queue.add(data, options);
    }

    async addRecurringJob(queueName: string, cronPattern: string, data: any, options?: JobOptions): Promise<Job> {
      const queue = this.queues.get(queueName);
      if (!queue) {
        throw new Error(`Queue ${queueName} not found`);
      }
      return queue.add(data, {
        repeat: { cron: cronPattern },
        ...options,
      });
    }

    registerProcessor(queueName: string, concurrency: number, processor: (job: Job) => Promise<any>): void {
      const queue = this.queues.get(queueName);
      if (!queue) {
        throw new Error(`Queue ${queueName} not found`);
      }
      queue.process(concurrency, processor);
      logger.info({ queueName, concurrency }, 'Processor registered');
    }

    async pauseQueue(queueName: string): Promise<void> {
      const queue = this.queues.get(queueName);
      if (queue) {
        await queue.pause();
        logger.info({ queueName }, 'Queue paused');
      }
    }

    async resumeQueue(queueName: string): Promise<void> {
      const queue = this.queues.get(queueName);
      if (queue) {
        await queue.resume();
        logger.info({ queueName }, 'Queue resumed');
      }
    }

    async getJobCounts(queueName: string): Promise<Bull.JobCounts> {
      const queue = this.queues.get(queueName);
      if (!queue) {
        throw new Error(`Queue ${queueName} not found`);
      }
      return queue.getJobCounts();
    }

    async cleanQueue(queueName: string, grace: number = 0): Promise<void> {
      const queue = this.queues.get(queueName);
      if (queue) {
        await queue.clean(grace, 'completed');
        await queue.clean(grace, 'failed');
        logger.info({ queueName }, 'Queue cleaned');
      }
    }

    async closeAll(): Promise<void> {
      for (const [name, queue] of this.queues) {
        await queue.close();
        logger.info({ queueName: name }, 'Queue closed');
      }
      this.queues.clear();
    }
  }

  // Singleton instance
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  export const jobQueueService = new JobQueueService(redisUrl);
  export default jobQueueService;
  ```

- [ ] Create unit tests: `server/src/services/infrastructure/__tests__/jobQueueService.test.ts`
  - [ ] Test: `createQueue` creates queue successfully
  - [ ] Test: `addJob` adds job to queue
  - [ ] Test: `addRecurringJob` schedules recurring job
  - [ ] Test: `registerProcessor` registers processor
  - [ ] Test: `getJobCounts` returns counts
  - [ ] Test: Error handling for non-existent queue

- [ ] Run tests: `npm run test -- jobQueueService`
- [ ] Verify: All job queue tests pass

---

### 1.4 Enhanced PubSub Service

- [ ] Update `server/src/services/pubsub.ts`
  - [ ] Add new analytics events:
    ```typescript
    // Analytics events
    public static readonly SPENDING_METRICS_COMPUTED = 'SPENDING_METRICS_COMPUTED';
    public static readonly PRICE_BENCHMARKS_COMPUTED = 'PRICE_BENCHMARKS_COMPUTED';
    public static readonly PATTERN_DETECTED = 'PATTERN_DETECTED';
    public static readonly ANOMALY_DETECTED = 'ANOMALY_DETECTED';
    public static readonly RECOMMENDATIONS_GENERATED = 'RECOMMENDATIONS_GENERATED';
    public static readonly RECOMMENDATION_VIEWED = 'RECOMMENDATION_VIEWED';
    public static readonly RECOMMENDATION_DISMISSED = 'RECOMMENDATION_DISMISSED';
    public static readonly RECOMMENDATION_APPLIED = 'RECOMMENDATION_APPLIED';
    ```

- [ ] No additional code changes needed (existing PubSub is sufficient)

---

### 1.5 Domain Layer Setup (NEW - Architecture Requirement)

- [ ] Create domain layer directory structure:
  ```bash
  mkdir -p server/src/domain/analytics/{entities,value-objects,repositories,services,events}
  ```

- [ ] Create `server/src/domain/analytics/services/ICacheService.ts`
  ```typescript
  /**
   * Cache service interface - allows swapping between node-cache and Redis
   * ARCHITECTURE: Abstracts caching to enable migration without code changes
   */
  export interface ICacheService {
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: unknown, ttl?: number): Promise<void>;
    del(key: string): Promise<void>;
    invalidateByPrefix(prefix: string): Promise<void>;
    ping(): Promise<boolean>;
  }
  ```

- [ ] Create `server/src/domain/analytics/services/IAggregationService.ts`
  ```typescript
  export interface IAggregationService {
    computeDailySpendingMetrics(date: Date): Promise<void>;
    computePriceBenchmarks(date: Date): Promise<void>;
    refreshMaterializedViews(): Promise<void>;
  }
  ```

- [ ] Create `server/src/domain/analytics/services/IPatternRecognitionService.ts`
  ```typescript
  import { PurchasePattern } from '@prisma/client';

  export interface IPatternRecognitionService {
    analyzePurchasePattern(itemId: number, branchId?: number): Promise<PurchasePattern | null>;
    predictNextOrder(itemId: number, branchId?: number): Promise<Date | null>;
    detectAnomalies(itemId: number, branchId?: number): Promise<Anomaly[]>;
  }

  export interface Anomaly {
    invoiceId: number;
    invoiceDate: Date;
    quantity: number;
    amount: number;
    expectedQuantity: number;
    expectedAmount: number;
    quantityDeviation: number;
    amountDeviation: number;
    type: 'QUANTITY_ANOMALY' | 'AMOUNT_ANOMALY';
  }
  ```

- [ ] Create `server/src/domain/analytics/services/ICrossLocationService.ts`
  ```typescript
  export interface ICrossLocationService {
    getPriceVariance(itemId: number, vendorId?: number): Promise<PriceVarianceResult[]>;
    getBenchmarkStats(itemId: number): Promise<BenchmarkStats | null>;
    compareSpendingByBranch(startDate: Date, endDate: Date, itemId?: number): Promise<BranchSpending[]>;
    findConsolidationOpportunities(): Promise<ConsolidationOpportunity[]>;
  }

  export interface PriceVarianceResult {
    itemId: number;
    itemName: string;
    vendorId: number;
    vendorName: string;
    branches: BranchPrice[];
    networkAvgPrice: number;
    networkMinPrice: number;
    networkMaxPrice: number;
    maxVariance: number;
  }

  export interface BranchPrice {
    branchId: number | null;
    branchName: string;
    price: number;
    varianceFromAvg: number;
  }

  export interface BenchmarkStats {
    itemId: number;
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    priceRange: number;
    branchCount: number;
  }

  export interface BranchSpending {
    branchId: number;
    branchName: string;
    totalAmount: number;
    invoiceCount: number;
  }

  export interface ConsolidationOpportunity {
    itemId: number;
    itemName: string;
    branchCount: number;
    vendorCount: number;
    totalSpending: number;
    branches: Array<{
      branchId: number | null;
      branchName: string | undefined;
      vendorId: number | null;
      vendorName: string | undefined;
      totalAmount: number;
    }>;
  }
  ```

- [ ] Create `server/src/domain/analytics/events/AnalyticsEvents.ts`
  ```typescript
  export const AnalyticsEvents = {
    SPENDING_METRICS_COMPUTED: 'analytics.spending-metrics-computed',
    PRICE_BENCHMARKS_COMPUTED: 'analytics.price-benchmarks-computed',
    PATTERN_DETECTED: 'analytics.pattern-detected',
    ANOMALY_DETECTED: 'analytics.anomaly-detected',
    RECOMMENDATIONS_GENERATED: 'analytics.recommendations-generated',
    RECOMMENDATION_VIEWED: 'analytics.recommendation-viewed',
    RECOMMENDATION_DISMISSED: 'analytics.recommendation-dismissed',
    RECOMMENDATION_APPLIED: 'analytics.recommendation-applied',
  } as const;

  export type AnalyticsEventType = typeof AnalyticsEvents[keyof typeof AnalyticsEvents];
  ```

- [ ] Create `server/src/errors/AnalyticsError.ts`
  ```typescript
  export class AnalyticsError extends Error {
    constructor(
      public readonly operation: string,
      message: string,
      public readonly cause?: Error
    ) {
      super(`Analytics computation failed [${operation}]: ${message}`);
      this.name = 'AnalyticsError';
    }
  }

  export class AggregationError extends AnalyticsError {
    constructor(operation: string, cause?: Error) {
      super(operation, 'Aggregation failed', cause);
      this.name = 'AggregationError';
    }
  }

  export class PatternRecognitionError extends AnalyticsError {
    constructor(operation: string, cause?: Error) {
      super(operation, 'Pattern recognition failed', cause);
      this.name = 'PatternRecognitionError';
    }
  }
  ```

- [ ] Create `server/src/schemas/analytics.schema.ts`
  ```typescript
  import { z } from 'zod';

  export const SpendingMetricQuerySchema = z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    itemId: z.coerce.number().int().positive().optional(),
    vendorId: z.coerce.number().int().positive().optional(),
    branchId: z.coerce.number().int().positive().optional(),
    departmentId: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  });

  export const PriceVarianceQuerySchema = z.object({
    itemId: z.coerce.number().int().positive(),
    vendorId: z.coerce.number().int().positive().optional(),
  });

  export const PurchasePatternQuerySchema = z.object({
    itemId: z.coerce.number().int().positive().optional(),
    branchId: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  });

  export const RecommendationDismissSchema = z.object({
    reason: z.string().max(500).optional(),
  });

  export type SpendingMetricQuery = z.infer<typeof SpendingMetricQuerySchema>;
  export type PriceVarianceQuery = z.infer<typeof PriceVarianceQuerySchema>;
  export type PurchasePatternQuery = z.infer<typeof PurchasePatternQuerySchema>;
  export type RecommendationDismiss = z.infer<typeof RecommendationDismissSchema>;
  ```

- [ ] Verify: All interfaces compile without errors
- [ ] Verify: Domain layer follows existing pattern in `domain/delivery/` and `domain/files/`

---

### 1.6 Configuration Updates

- [ ] Update `server/src/config/analytics.ts` (create new file)
  ```typescript
  export const AnalyticsConfig = {
    // Job schedules (cron expressions)
    SCHEDULES: {
      COMPUTE_SPENDING_METRICS: '0 * * * *',     // Every hour
      COMPUTE_PRICE_BENCHMARKS: '0 2 * * *',     // Daily at 2 AM
      ANALYZE_PURCHASE_PATTERNS: '0 3 * * *',    // Daily at 3 AM
      GENERATE_RECOMMENDATIONS: '0 4 * * *',     // Daily at 4 AM
      DETECT_ANOMALIES: '0 */6 * * *',           // Every 6 hours
      CLEANUP_EXPIRED_RECOMMENDATIONS: '0 1 * * *', // Daily at 1 AM
    },

    // ARCHITECTURE FIX: Use separate queues for independent job types
    // This prevents sequential blocking and allows parallel processing
    QUEUES: {
      AGGREGATION: 'analytics:aggregation',        // spending-metrics, price-benchmarks
      PATTERN: 'analytics:pattern',                // purchase-patterns, anomalies
      RECOMMENDATIONS: 'analytics:recommendations', // generate, cleanup
    },

    // Job names - ARCHITECTURE FIX: These are used as job.name, NOT jobId
    JOBS: {
      COMPUTE_SPENDING_METRICS: 'compute-spending-metrics',
      COMPUTE_PRICE_BENCHMARKS: 'compute-price-benchmarks',
      ANALYZE_PURCHASE_PATTERNS: 'analyze-purchase-patterns',
      GENERATE_RECOMMENDATIONS: 'generate-recommendations',
      DETECT_ANOMALIES: 'detect-anomalies',
      CLEANUP_EXPIRED_RECOMMENDATIONS: 'cleanup-expired-recommendations',
    },

    // ARCHITECTURE FIX: Job-specific timeouts (ms)
    JOB_TIMEOUTS: {
      COMPUTE_SPENDING_METRICS: 120000,    // 2 minutes
      COMPUTE_PRICE_BENCHMARKS: 300000,    // 5 minutes (heavy job)
      ANALYZE_PURCHASE_PATTERNS: 300000,   // 5 minutes (heavy job)
      GENERATE_RECOMMENDATIONS: 180000,    // 3 minutes
      DETECT_ANOMALIES: 120000,            // 2 minutes
      CLEANUP_EXPIRED_RECOMMENDATIONS: 60000, // 1 minute
    },

    // Cache TTLs (seconds)
    CACHE_TTL: {
      SPENDING_METRICS: 300,       // 5 minutes
      PRICE_VARIANCE: 600,         // 10 minutes
      PURCHASE_PATTERNS: 3600,     // 1 hour
      RECOMMENDATIONS: 300,        // 5 minutes
      BENCHMARKS: 86400,           // 1 day
    },
  };
  ```

- [ ] Update `.env` file
  - [ ] Add `REDIS_URL=redis://localhost:6379`
  - [ ] Add `ANALYTICS_ENABLED=true`
  - [ ] Add `ANALYTICS_JOBS_ENABLED=true`

---

### 1.6 Database Seed for Analytics

- [ ] Create `server/prisma/seed-analytics.ts`
  ```typescript
  import { PrismaClient } from '@prisma/client';

  const prisma = new PrismaClient();

  async function seedAnalytics() {
    console.log('Seeding analytics data...');

    // Seed will be populated by background jobs
    // This seed file can create initial test data if needed

    console.log('Analytics seed complete');
  }

  seedAnalytics()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
  ```

- [ ] Run seed: `npx ts-node prisma/seed-analytics.ts`

---

### 1.7 Phase 1 Verification

- [ ] Run: `npm run build` - TypeScript compiles successfully
- [ ] Run: `npx prisma generate` - Prisma client updated
- [ ] Run: `npx prisma studio` - Verify all 4 new tables visible
- [ ] Run: `npm run test -- infrastructure` - All infrastructure tests pass
- [ ] Start Redis: `docker ps` shows Redis running
- [ ] Test Redis connection: `redis-cli ping` returns PONG
- [ ] Commit: "feat: add analytics foundation database schema and infrastructure services"

---

## Phase 2: Analytics Services (Week 1-2, Days 6-10)

### 2.1 AggregationService

- [ ] Create `server/src/services/analytics/aggregationService.ts`
  ```typescript
  import { PrismaClient } from '@prisma/client';
  import { createHash } from 'crypto';
  import { logger } from '../../utils/logger';
  import { ICacheService } from '../../domain/analytics/services/ICacheService';
  import { IAggregationService } from '../../domain/analytics/services/IAggregationService';
  import { AggregationError } from '../../errors/AnalyticsError';
  import pubsub from '../pubsub';

  /**
   * ARCHITECTURE FIX: Implements interface, accepts dependencies via constructor
   */
  export class AggregationService implements IAggregationService {
    constructor(
      private readonly prisma: PrismaClient,
      private readonly cache: ICacheService,
      private readonly pubsub: typeof pubsub
    ) {}
    /**
     * Compute daily spending metrics for a specific date
     * Groups by all dimensions: item, vendor, branch, department, cost center
     */
    async computeDailySpendingMetrics(date: Date): Promise<void> {
      logger.info({ date }, 'Computing daily spending metrics');

      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // ARCHITECTURE FIX: Use cursor-based batching for large datasets
      // Fetch approved invoices for the date
      const invoices = await this.prisma.invoice.findMany({
        where: {
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
          status: 'APPROVED',
          deletedAt: null,
        },
        include: {
          items: {
            include: {
              item: {
                include: {
                  vendor: true,
                },
              },
            },
          },
          branch: true,
          department: true,
          costCenter: true,
        },
      });

      logger.info({ invoiceCount: invoices.length }, 'Fetched invoices for aggregation');

      // Group by dimensions
      const metrics = new Map<string, any>();

      for (const invoice of invoices) {
        for (const lineItem of invoice.items) {
          // ARCHITECTURE FIX: Use item.vendor.id instead of item.vendorId
          const vendorId = lineItem.item.vendor?.id || null;
          const key = `${date.toISOString().split('T')[0]}-${lineItem.itemId}-${vendorId}-${invoice.branchId || 'null'}-${invoice.departmentId || 'null'}-${invoice.costCenterId || 'null'}`;

          if (!metrics.has(key)) {
            metrics.set(key, {
              date: startOfDay,
              itemId: lineItem.itemId,
              vendorId: vendorId,
              branchId: invoice.branchId,
              departmentId: invoice.departmentId,
              costCenterId: invoice.costCenterId,
              totalAmount: 0,
              invoiceCount: 0,
              quantity: 0,
              avgUnitPrice: 0,
            });
          }

          const metric = metrics.get(key);
          metric.totalAmount += lineItem.price * lineItem.quantity;
          metric.invoiceCount += 1;
          metric.quantity += lineItem.quantity;
        }
      }

      // ARCHITECTURE FIX: Helper function to compute dimension hash
      const computeDimensionHash = (metric: any): string => {
        const hashInput = [
          metric.date.toISOString(),
          metric.itemId ?? 'null',
          metric.vendorId ?? 'null',
          metric.branchId ?? 'null',
          metric.departmentId ?? 'null',
          metric.costCenterId ?? 'null',
        ].join('|');
        return createHash('sha256').update(hashInput).digest('hex');
      };

      // ARCHITECTURE FIX: Wrap in transaction for data integrity
      await this.prisma.$transaction(async (tx) => {
        // Delete existing metrics for this date (idempotent)
        await tx.spendingMetric.deleteMany({
          where: { date: startOfDay },
        });

        // Insert new metrics with dimension hash
        const metricsToCreate = Array.from(metrics.values()).map((metric) => {
          metric.avgUnitPrice = metric.quantity > 0 ? metric.totalAmount / metric.quantity : 0;
          metric.dimensionHash = computeDimensionHash(metric);
          return metric;
        });

        await tx.spendingMetric.createMany({
          data: metricsToCreate,
        });
      });

      logger.info({ metricCount: metrics.size }, 'Daily spending metrics computed');

      // Invalidate cache
      await this.cache.invalidateByPrefix('analytics:spending-metrics');

      // Publish event
      this.pubsub.publish(this.pubsub.SPENDING_METRICS_COMPUTED, { date });
    }

    /**
     * Compute price benchmarks for all items
     * Calculates network averages, min, max for cross-location comparison
     */
    async computePriceBenchmarks(date: Date): Promise<void> {
      logger.info({ date }, 'Computing price benchmarks');

      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Get all recent invoice items (last 30 days for better average)
      const thirtyDaysAgo = new Date(date);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const invoiceItems = await prisma.invoiceItem.findMany({
        where: {
          invoice: {
            date: {
              gte: thirtyDaysAgo,
              lte: endOfDay,
            },
            status: 'APPROVED',
            deletedAt: null,
          },
        },
        include: {
          item: {
            include: {
              vendor: true,
            },
          },
          invoice: {
            include: {
              branch: true,
            },
          },
        },
      });

      // Group by item-vendor-branch
      const priceGroups = new Map<string, { prices: number[], itemId: number, vendorId: number, branchId: number | null }>();

      for (const lineItem of invoiceItems) {
        const key = `${lineItem.itemId}-${lineItem.item.vendorId}-${lineItem.invoice.branchId || 'null'}`;
        if (!priceGroups.has(key)) {
          priceGroups.set(key, {
            prices: [],
            itemId: lineItem.itemId,
            vendorId: lineItem.item.vendorId,
            branchId: lineItem.invoice.branchId,
          });
        }
        priceGroups.get(key)!.prices.push(lineItem.price);
      }

      // Calculate network statistics for each item
      const itemStats = new Map<number, { prices: number[], avgPrice: number, minPrice: number, maxPrice: number }>();

      for (const [key, group] of priceGroups) {
        if (!itemStats.has(group.itemId)) {
          const allPrices = Array.from(priceGroups.values())
            .filter(g => g.itemId === group.itemId)
            .flatMap(g => g.prices);

          itemStats.set(group.itemId, {
            prices: allPrices,
            avgPrice: allPrices.reduce((a, b) => a + b, 0) / allPrices.length,
            minPrice: Math.min(...allPrices),
            maxPrice: Math.max(...allPrices),
          });
        }
      }

      // Create price snapshots with network stats
      const snapshotPromises = Array.from(priceGroups.entries()).map(([key, group]) => {
        const avgPrice = group.prices.reduce((a, b) => a + b, 0) / group.prices.length;
        const stats = itemStats.get(group.itemId)!;
        const varianceFromAvg = ((avgPrice - stats.avgPrice) / stats.avgPrice) * 100;

        return prisma.priceSnapshot.create({
          data: {
            itemId: group.itemId,
            vendorId: group.vendorId,
            branchId: group.branchId,
            price: avgPrice,
            date: startOfDay,
            networkAvgPrice: stats.avgPrice,
            networkMinPrice: stats.minPrice,
            networkMaxPrice: stats.maxPrice,
            varianceFromAvg,
          },
        });
      });

      await Promise.all(snapshotPromises);

      logger.info({ snapshotCount: snapshotPromises.length }, 'Price benchmarks computed');

      // Invalidate cache
      await redisService.invalidateByPrefix('analytics:price-variance');
      await redisService.invalidateByPrefix('benchmarks:');

      // Publish event
      pubsub.publish(pubsub.PRICE_BENCHMARKS_COMPUTED, { date });
    }

    /**
     * Refresh materialized views (if using DB-level optimization)
     * Currently a placeholder for future optimization
     */
    async refreshMaterializedViews(): Promise<void> {
      logger.info('Refreshing materialized views');
      // Placeholder for future DB optimization
      // e.g., REFRESH MATERIALIZED VIEW spending_summary;
    }
  }

  // ARCHITECTURE FIX: Factory function for dependency injection
  export function createAggregationService(
    prisma: PrismaClient,
    cache: ICacheService,
    pubsubService: typeof pubsub
  ): AggregationService {
    return new AggregationService(prisma, cache, pubsubService);
  }
  ```

  > **ARCHITECTURE NOTE**: The `dimensionHash` column replaces the composite unique constraint on nullable fields. See Phase 1 schema update.

- [ ] Create unit tests: `server/src/services/analytics/__tests__/aggregationService.test.ts`
  - [ ] Test: `computeDailySpendingMetrics` aggregates correctly
  - [ ] Test: `computePriceBenchmarks` calculates stats correctly
  - [ ] Test: Handles empty invoice list
  - [ ] Test: Invalidates cache after computation

- [ ] Run tests: `npm run test -- aggregationService`

---

### 2.2 PatternRecognitionService

- [ ] Create `server/src/services/analytics/patternRecognitionService.ts`
  ```typescript
  import prisma from '../../prisma';
  import { logger } from '../../utils/logger';
  import redisService from '../infrastructure/redisService';
  import pubsub from '../pubsub';

  interface OrderCycleResult {
    avgCycleDays: number;
    avgQuantity: number;
    avgAmount: number;
    stdDevQuantity: number;
    stdDevAmount: number;
    isIncreasing: boolean;
    isDecreasing: boolean;
    confidenceScore: number;
  }

  export class PatternRecognitionService {
    /**
     * Analyze purchase pattern for an item at a specific location (or all locations)
     */
    async analyzePurchasePattern(itemId: number, branchId?: number): Promise<any> {
      logger.info({ itemId, branchId }, 'Analyzing purchase pattern');

      // Fetch historical invoices (last 180 days)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);

      const invoiceItems = await prisma.invoiceItem.findMany({
        where: {
          itemId,
          invoice: {
            branchId: branchId || undefined,
            date: { gte: sixMonthsAgo },
            status: 'APPROVED',
            deletedAt: null,
          },
        },
        include: {
          invoice: {
            select: {
              date: true,
              branchId: true,
            },
          },
        },
        orderBy: {
          invoice: {
            date: 'asc',
          },
        },
      });

      if (invoiceItems.length < 3) {
        logger.info({ itemId, branchId, count: invoiceItems.length }, 'Insufficient data for pattern analysis');
        return null;
      }

      const cycle = this.detectOrderCycle(invoiceItems);

      // Calculate next predicted order
      const lastOrderDate = invoiceItems[invoiceItems.length - 1].invoice.date;
      const nextPredictedOrder = new Date(lastOrderDate);
      nextPredictedOrder.setDate(nextPredictedOrder.getDate() + Math.round(cycle.avgCycleDays));

      // Store pattern
      const pattern = await prisma.purchasePattern.upsert({
        where: {
          itemId_branchId: {
            itemId,
            branchId: branchId || null,
          },
        },
        update: {
          avgOrderCycleDays: cycle.avgCycleDays,
          avgOrderQuantity: cycle.avgQuantity,
          avgOrderAmount: cycle.avgAmount,
          stdDevQuantity: cycle.stdDevQuantity,
          stdDevAmount: cycle.stdDevAmount,
          isIncreasing: cycle.isIncreasing,
          isDecreasing: cycle.isDecreasing,
          lastOrderDate,
          nextPredictedOrder,
          confidenceScore: cycle.confidenceScore,
          basedOnInvoices: invoiceItems.length,
          analysisStartDate: sixMonthsAgo,
          analysisEndDate: new Date(),
        },
        create: {
          itemId,
          branchId: branchId || null,
          avgOrderCycleDays: cycle.avgCycleDays,
          avgOrderQuantity: cycle.avgQuantity,
          avgOrderAmount: cycle.avgAmount,
          stdDevQuantity: cycle.stdDevQuantity,
          stdDevAmount: cycle.stdDevAmount,
          isIncreasing: cycle.isIncreasing,
          isDecreasing: cycle.isDecreasing,
          lastOrderDate,
          nextPredictedOrder,
          confidenceScore: cycle.confidenceScore,
          basedOnInvoices: invoiceItems.length,
          analysisStartDate: sixMonthsAgo,
          analysisEndDate: new Date(),
        },
      });

      logger.info({ itemId, branchId, pattern }, 'Purchase pattern analyzed');

      // Invalidate cache
      await redisService.invalidateByPrefix('analytics:purchase-patterns');

      // Publish event
      pubsub.publish(pubsub.PATTERN_DETECTED, { itemId, branchId, pattern });

      return pattern;
    }

    /**
     * Detect order cycle from historical invoice items
     * ARCHITECTURE FIX: Guard against division by zero and edge cases
     */
    detectOrderCycle(invoiceItems: any[]): OrderCycleResult {
      // Calculate time between orders
      const orderDates = invoiceItems.map(item => new Date(item.invoice.date));
      const cycleDays: number[] = [];

      for (let i = 1; i < orderDates.length; i++) {
        const daysDiff = (orderDates[i].getTime() - orderDates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
        cycleDays.push(daysDiff);
      }

      // ARCHITECTURE FIX: Guard against empty arrays and division by zero
      const avgCycleDays = cycleDays.length > 0
        ? cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length
        : 0;

      // Calculate quantity and amount stats
      const quantities = invoiceItems.map(item => item.quantity);
      const amounts = invoiceItems.map(item => item.price * item.quantity);

      // ARCHITECTURE FIX: Guard against empty arrays
      const avgQuantity = quantities.length > 0
        ? quantities.reduce((a, b) => a + b, 0) / quantities.length
        : 0;
      const avgAmount = amounts.length > 0
        ? amounts.reduce((a, b) => a + b, 0) / amounts.length
        : 0;

      const stdDevQuantity = quantities.length > 0
        ? Math.sqrt(
            quantities.reduce((sum, q) => sum + Math.pow(q - avgQuantity, 2), 0) / quantities.length
          )
        : 0;

      const stdDevAmount = amounts.length > 0
        ? Math.sqrt(
            amounts.reduce((sum, a) => sum + Math.pow(a - avgAmount, 2), 0) / amounts.length
          )
        : 0;

      // Detect trend (increasing/decreasing)
      const recentQuantities = quantities.slice(-5);
      const olderQuantities = quantities.slice(0, Math.min(5, quantities.length - 5));

      const recentAvg = recentQuantities.reduce((a, b) => a + b, 0) / recentQuantities.length;
      const olderAvg = olderQuantities.length > 0
        ? olderQuantities.reduce((a, b) => a + b, 0) / olderQuantities.length
        : recentAvg;

      const isIncreasing = recentAvg > olderAvg * 1.1; // 10% increase
      const isDecreasing = recentAvg < olderAvg * 0.9; // 10% decrease

      // Confidence score based on consistency
      // ARCHITECTURE FIX: Guard against division by zero in coefficient of variation
      const cycleDaysStdDev = cycleDays.length > 0
        ? Math.sqrt(
            cycleDays.reduce((sum, c) => sum + Math.pow(c - avgCycleDays, 2), 0) / cycleDays.length
          )
        : 0;
      const cycleDaysCV = avgCycleDays > 0 ? cycleDaysStdDev / avgCycleDays : 1; // Coefficient of variation
      const confidenceScore = Math.max(0, Math.min(1, 1 - cycleDaysCV)); // 0-1 scale

      return {
        avgCycleDays,
        avgQuantity,
        avgAmount,
        stdDevQuantity,
        stdDevAmount,
        isIncreasing,
        isDecreasing,
        confidenceScore,
      };
    }

    /**
     * Predict next order date for an item
     */
    async predictNextOrder(itemId: number, branchId?: number): Promise<Date | null> {
      const pattern = await prisma.purchasePattern.findUnique({
        where: {
          itemId_branchId: {
            itemId,
            branchId: branchId || null,
          },
        },
      });

      return pattern?.nextPredictedOrder || null;
    }

    /**
     * Detect anomalies in recent orders compared to pattern
     */
    async detectAnomalies(itemId: number, branchId?: number): Promise<any[]> {
      logger.info({ itemId, branchId }, 'Detecting anomalies');

      const pattern = await prisma.purchasePattern.findUnique({
        where: {
          itemId_branchId: {
            itemId,
            branchId: branchId || null,
          },
        },
      });

      if (!pattern) {
        return [];
      }

      // Get recent invoice items (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentInvoiceItems = await prisma.invoiceItem.findMany({
        where: {
          itemId,
          invoice: {
            branchId: branchId || undefined,
            date: { gte: thirtyDaysAgo },
            status: 'APPROVED',
            deletedAt: null,
          },
        },
        include: {
          invoice: true,
        },
      });

      const anomalies: any[] = [];

      for (const item of recentInvoiceItems) {
        const quantityDeviation = Math.abs(item.quantity - pattern.avgOrderQuantity) / pattern.stdDevQuantity;
        const amountDeviation = Math.abs((item.price * item.quantity) - pattern.avgOrderAmount) / pattern.stdDevAmount;

        // Flag if >2 standard deviations from mean
        if (quantityDeviation > 2 || amountDeviation > 2) {
          anomalies.push({
            invoiceId: item.invoiceId,
            invoiceDate: item.invoice.date,
            quantity: item.quantity,
            amount: item.price * item.quantity,
            expectedQuantity: pattern.avgOrderQuantity,
            expectedAmount: pattern.avgOrderAmount,
            quantityDeviation,
            amountDeviation,
            type: quantityDeviation > 2 ? 'QUANTITY_ANOMALY' : 'AMOUNT_ANOMALY',
          });

          logger.info({ itemId, branchId, anomaly: anomalies[anomalies.length - 1] }, 'Anomaly detected');

          // Publish event
          pubsub.publish(pubsub.ANOMALY_DETECTED, { itemId, branchId, anomaly: anomalies[anomalies.length - 1] });
        }
      }

      return anomalies;
    }
  }

  export const patternRecognitionService = new PatternRecognitionService();
  export default patternRecognitionService;
  ```

- [ ] Create unit tests: `server/src/services/analytics/__tests__/patternRecognitionService.test.ts`
  - [ ] Test: `detectOrderCycle` calculates correctly
  - [ ] Test: `analyzePurchasePattern` stores pattern
  - [ ] Test: `predictNextOrder` returns date
  - [ ] Test: `detectAnomalies` flags outliers

- [ ] Run tests: `npm run test -- patternRecognitionService`

---

### 2.3 CrossLocationService

- [ ] Create `server/src/services/analytics/crossLocationService.ts`
  ```typescript
  import prisma from '../../prisma';
  import { logger } from '../../utils/logger';
  import redisService from '../infrastructure/redisService';
  import { AnalyticsConfig } from '../../config/analytics';

  export interface PriceVarianceResult {
    itemId: number;
    itemName: string;
    vendorId: number;
    vendorName: string;
    branches: {
      branchId: number | null;
      branchName: string;
      price: number;
      varianceFromAvg: number; // Percentage
    }[];
    networkAvgPrice: number;
    networkMinPrice: number;
    networkMaxPrice: number;
    maxVariance: number; // Highest variance across branches
  }

  export interface BenchmarkStats {
    itemId: number;
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    priceRange: number;
    branchCount: number;
  }

  export class CrossLocationService {
    /**
     * Get price variance for an item across all branches
     */
    async getPriceVariance(itemId: number, vendorId?: number): Promise<PriceVarianceResult[]> {
      const cacheKey = `analytics:price-variance:${itemId}-${vendorId || 'all'}`;
      const cached = await redisService.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      logger.info({ itemId, vendorId }, 'Getting price variance');

      // Get latest price snapshots
      const snapshots = await prisma.priceSnapshot.findMany({
        where: {
          itemId,
          vendorId: vendorId || undefined,
          date: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
        include: {
          item: true,
          vendor: true,
          branch: true,
        },
        orderBy: {
          date: 'desc',
        },
      });

      // Group by item-vendor
      const groups = new Map<string, PriceVarianceResult>();

      for (const snapshot of snapshots) {
        const key = `${snapshot.itemId}-${snapshot.vendorId}`;

        if (!groups.has(key)) {
          groups.set(key, {
            itemId: snapshot.itemId,
            itemName: snapshot.item.name,
            vendorId: snapshot.vendorId,
            vendorName: snapshot.vendor.name,
            branches: [],
            networkAvgPrice: snapshot.networkAvgPrice || 0,
            networkMinPrice: snapshot.networkMinPrice || 0,
            networkMaxPrice: snapshot.networkMaxPrice || 0,
            maxVariance: 0,
          });
        }

        const group = groups.get(key)!;

        // Add branch data (avoid duplicates for same branch)
        const existingBranch = group.branches.find(b => b.branchId === snapshot.branchId);
        if (!existingBranch) {
          group.branches.push({
            branchId: snapshot.branchId,
            branchName: snapshot.branch?.name || 'Unassigned',
            price: snapshot.price,
            varianceFromAvg: snapshot.varianceFromAvg || 0,
          });

          // Update max variance
          if (Math.abs(snapshot.varianceFromAvg || 0) > Math.abs(group.maxVariance)) {
            group.maxVariance = snapshot.varianceFromAvg || 0;
          }
        }
      }

      const results = Array.from(groups.values());

      // Cache result
      await redisService.set(cacheKey, JSON.stringify(results), AnalyticsConfig.CACHE_TTL.PRICE_VARIANCE);

      logger.info({ resultCount: results.length }, 'Price variance retrieved');

      return results;
    }

    /**
     * Get benchmark statistics for an item
     */
    async getBenchmarkStats(itemId: number): Promise<BenchmarkStats | null> {
      const cacheKey = `benchmarks:item:${itemId}`;
      const cached = await redisService.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      logger.info({ itemId }, 'Getting benchmark stats');

      // Get latest snapshots for this item
      const snapshots = await prisma.priceSnapshot.findMany({
        where: {
          itemId,
          date: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: {
          date: 'desc',
        },
      });

      if (snapshots.length === 0) {
        return null;
      }

      const prices = snapshots.map(s => s.price);
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const priceRange = maxPrice - minPrice;
      const branchCount = new Set(snapshots.map(s => s.branchId)).size;

      const stats: BenchmarkStats = {
        itemId,
        avgPrice,
        minPrice,
        maxPrice,
        priceRange,
        branchCount,
      };

      // Cache result
      await redisService.set(cacheKey, JSON.stringify(stats), AnalyticsConfig.CACHE_TTL.BENCHMARKS);

      return stats;
    }

    /**
     * Compare spending across branches for a time period
     */
    async compareSpendingByBranch(startDate: Date, endDate: Date, itemId?: number): Promise<any[]> {
      logger.info({ startDate, endDate, itemId }, 'Comparing spending by branch');

      const metrics = await prisma.spendingMetric.findMany({
        where: {
          date: {
            gte: startDate,
            lte: endDate,
          },
          itemId: itemId || undefined,
          branchId: {
            not: null,
          },
        },
        include: {
          branch: true,
          item: true,
        },
      });

      // Group by branch
      const branchTotals = new Map<number, { branchId: number, branchName: string, totalAmount: number, invoiceCount: number }>();

      for (const metric of metrics) {
        if (!branchTotals.has(metric.branchId!)) {
          branchTotals.set(metric.branchId!, {
            branchId: metric.branchId!,
            branchName: metric.branch!.name,
            totalAmount: 0,
            invoiceCount: 0,
          });
        }

        const total = branchTotals.get(metric.branchId!)!;
        total.totalAmount += metric.totalAmount;
        total.invoiceCount += metric.invoiceCount;
      }

      return Array.from(branchTotals.values()).sort((a, b) => b.totalAmount - a.totalAmount);
    }

    /**
     * Find consolidation opportunities (items purchased by multiple branches from different vendors)
     */
    async findConsolidationOpportunities(): Promise<any[]> {
      logger.info('Finding consolidation opportunities');

      // Get items purchased by 2+ branches from different vendors
      const items = await prisma.spendingMetric.groupBy({
        by: ['itemId'],
        where: {
          branchId: {
            not: null,
          },
          date: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
        having: {
          branchId: {
            _count: {
              gte: 2,
            },
          },
        },
        _sum: {
          totalAmount: true,
        },
        _count: {
          branchId: true,
        },
      });

      const opportunities: any[] = [];

      for (const item of items) {
        // Check if different branches use different vendors
        const metrics = await prisma.spendingMetric.findMany({
          where: {
            itemId: item.itemId,
            date: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
          include: {
            item: true,
            vendor: true,
            branch: true,
          },
        });

        const vendors = new Set(metrics.map(m => m.vendorId));

        if (vendors.size > 1) {
          // Consolidation opportunity found
          opportunities.push({
            itemId: item.itemId,
            itemName: metrics[0].item.name,
            branchCount: item._count.branchId,
            vendorCount: vendors.size,
            totalSpending: item._sum.totalAmount,
            branches: metrics.map(m => ({
              branchId: m.branchId,
              branchName: m.branch?.name,
              vendorId: m.vendorId,
              vendorName: m.vendor?.name,
              totalAmount: m.totalAmount,
            })),
          });
        }
      }

      logger.info({ opportunityCount: opportunities.length }, 'Consolidation opportunities found');

      return opportunities.sort((a, b) => b.totalSpending - a.totalSpending);
    }
  }

  export const crossLocationService = new CrossLocationService();
  export default crossLocationService;
  ```

- [ ] Create unit tests: `server/src/services/analytics/__tests__/crossLocationService.test.ts`
  - [ ] Test: `getPriceVariance` returns correct data
  - [ ] Test: `getBenchmarkStats` calculates correctly
  - [ ] Test: `compareSpendingByBranch` groups correctly
  - [ ] Test: `findConsolidationOpportunities` identifies candidates
  - [ ] Test: Cache hit/miss behavior

- [ ] Run tests: `npm run test -- crossLocationService`

---

### 2.4 RecommendationService & RuleEngine (Skeleton)

- [ ] Create `server/src/services/recommendations/ruleEngine.ts`
  ```typescript
  import { logger } from '../../utils/logger';
  import { RecommendationType } from '@prisma/client';

  export interface Rule {
    id: string;
    name: string;
    type: RecommendationType;
    priority: number;
    enabled: boolean;

    // Condition function (return true if rule applies)
    condition: (context: AnalyticsContext) => Promise<boolean>;

    // Recommendation generator
    generateRecommendation: (context: AnalyticsContext) => Promise<RecommendationData>;
  }

  export interface AnalyticsContext {
    date: Date;
    spendingMetrics?: any[];
    priceSnapshots?: any[];
    purchasePatterns?: any[];
    [key: string]: any;
  }

  export interface RecommendationData {
    type: RecommendationType;
    category: string;
    title: string;
    description: string;
    reasoning: string;
    estimatedSavings?: number;
    confidenceScore: number;
    priority: number;
    context: any;
    expiresAt?: Date;
  }

  export class RuleEngine {
    private rules: Map<string, Rule> = new Map();

    registerRule(rule: Rule): void {
      this.rules.set(rule.id, rule);
      logger.info({ ruleId: rule.id, ruleName: rule.name }, 'Rule registered');
    }

    async evaluateRules(context: AnalyticsContext): Promise<RecommendationData[]> {
      logger.info({ ruleCount: this.rules.size }, 'Evaluating rules');

      const recommendations: RecommendationData[] = [];

      for (const rule of this.rules.values()) {
        if (!rule.enabled) {
          continue;
        }

        try {
          const applies = await rule.condition(context);
          if (applies) {
            const recommendation = await rule.generateRecommendation(context);
            recommendations.push(recommendation);
            logger.info({ ruleId: rule.id, recommendation }, 'Rule generated recommendation');
          }
        } catch (error) {
          logger.error({ error, ruleId: rule.id }, 'Rule evaluation failed');
        }
      }

      logger.info({ recommendationCount: recommendations.length }, 'Rules evaluated');

      return recommendations;
    }

    async evaluateRule(ruleId: string, context: AnalyticsContext): Promise<RecommendationData | null> {
      const rule = this.rules.get(ruleId);
      if (!rule || !rule.enabled) {
        return null;
      }

      try {
        const applies = await rule.condition(context);
        if (applies) {
          return await rule.generateRecommendation(context);
        }
      } catch (error) {
        logger.error({ error, ruleId }, 'Rule evaluation failed');
      }

      return null;
    }

    getRules(): Rule[] {
      return Array.from(this.rules.values());
    }

    getRule(ruleId: string): Rule | undefined {
      return this.rules.get(ruleId);
    }
  }

  export const ruleEngine = new RuleEngine();
  export default ruleEngine;
  ```

- [ ] Create `server/src/services/recommendations/recommendationService.ts`
  ```typescript
  import prisma from '../../prisma';
  import { logger } from '../../utils/logger';
  import { RecommendationStatus } from '@prisma/client';
  import ruleEngine, { RecommendationData } from './ruleEngine';
  import pubsub from '../pubsub';

  export class RecommendationService {
    /**
     * Generate all recommendations (called by background job)
     */
    async generateRecommendations(): Promise<any[]> {
      logger.info('Generating recommendations');

      // Build analytics context
      const context = {
        date: new Date(),
        // Additional context will be added later when business rules are implemented
      };

      // Evaluate all rules
      const recommendationData = await ruleEngine.evaluateRules(context);

      // Store recommendations
      const recommendations = await Promise.all(
        recommendationData.map((data) =>
          prisma.recommendation.create({
            data: {
              type: data.type,
              category: data.category,
              title: data.title,
              description: data.description,
              reasoning: data.reasoning,
              estimatedSavings: data.estimatedSavings,
              confidenceScore: data.confidenceScore,
              priority: data.priority,
              context: JSON.stringify(data.context),
              status: RecommendationStatus.PENDING,
              expiresAt: data.expiresAt,
            },
          })
        )
      );

      logger.info({ count: recommendations.length }, 'Recommendations generated');

      // Publish event
      pubsub.publish(pubsub.RECOMMENDATIONS_GENERATED, { count: recommendations.length });

      return recommendations;
    }

    /**
     * Get pending recommendations for dashboard
     */
    async getPendingRecommendations(limit: number = 20): Promise<any[]> {
      return prisma.recommendation.findMany({
        where: {
          status: RecommendationStatus.PENDING,
          expiresAt: {
            gte: new Date(),
          },
        },
        orderBy: [
          { priority: 'asc' },
          { estimatedSavings: 'desc' },
          { createdAt: 'desc' },
        ],
        take: limit,
      });
    }

    /**
     * Mark recommendation as viewed
     */
    async markViewed(id: number, userId: number): Promise<any> {
      const recommendation = await prisma.recommendation.update({
        where: { id },
        data: {
          status: RecommendationStatus.VIEWED,
          viewedAt: new Date(),
          viewedBy: userId,
        },
      });

      pubsub.publish(pubsub.RECOMMENDATION_VIEWED, { id, userId });

      return recommendation;
    }

    /**
     * Dismiss recommendation
     */
    async dismiss(id: number, userId: number, reason?: string): Promise<any> {
      const recommendation = await prisma.recommendation.update({
        where: { id },
        data: {
          status: RecommendationStatus.DISMISSED,
          dismissedAt: new Date(),
          dismissedBy: userId,
          dismissReason: reason,
        },
      });

      pubsub.publish(pubsub.RECOMMENDATION_DISMISSED, { id, userId, reason });

      return recommendation;
    }

    /**
     * Apply recommendation (mark as implemented)
     */
    async apply(id: number, userId: number): Promise<any> {
      const recommendation = await prisma.recommendation.update({
        where: { id },
        data: {
          status: RecommendationStatus.APPLIED,
          appliedAt: new Date(),
          appliedBy: userId,
        },
      });

      pubsub.publish(pubsub.RECOMMENDATION_APPLIED, { id, userId });

      return recommendation;
    }

    /**
     * Expire old recommendations
     */
    async expireRecommendations(): Promise<number> {
      const result = await prisma.recommendation.updateMany({
        where: {
          status: {
            in: [RecommendationStatus.PENDING, RecommendationStatus.VIEWED],
          },
          expiresAt: {
            lt: new Date(),
          },
        },
        data: {
          status: RecommendationStatus.EXPIRED,
        },
      });

      logger.info({ count: result.count }, 'Recommendations expired');

      return result.count;
    }
  }

  export const recommendationService = new RecommendationService();
  export default recommendationService;
  ```

- [ ] Create unit tests: `server/src/services/recommendations/__tests__/recommendationService.test.ts`
  - [ ] Test: `getPendingRecommendations` returns correct data
  - [ ] Test: `markViewed` updates status
  - [ ] Test: `dismiss` updates status and reason
  - [ ] Test: `apply` updates status
  - [ ] Test: `expireRecommendations` expires old recommendations

- [ ] Run tests: `npm run test -- recommendationService`

---

### 2.5 Phase 2 Verification

- [ ] Run: `npm run test -- analytics/services` - All service tests pass
- [ ] Run: `npm run build` - TypeScript compiles successfully
- [ ] Verify: No ESLint errors
- [ ] Commit: "feat: implement analytics services (aggregation, pattern, cross-location, recommendation)"

---

## Phase 3: Background Jobs Implementation (Week 2-3, Days 11-15)

### 3.1 Job Definitions

- [ ] Create `server/src/jobs/analytics/computeSpendingMetricsJob.ts`
  ```typescript
  import { Job } from 'bull';
  import { logger } from '../../utils/logger';
  import aggregationService from '../../services/analytics/aggregationService';

  export async function computeSpendingMetricsJob(job: Job): Promise<void> {
    logger.info({ jobId: job.id }, 'Starting compute-spending-metrics job');

    try {
      // Compute for yesterday (data should be complete)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      await aggregationService.computeDailySpendingMetrics(yesterday);

      logger.info({ jobId: job.id, date: yesterday }, 'Compute-spending-metrics job completed');
    } catch (error) {
      logger.error({ jobId: job.id, error }, 'Compute-spending-metrics job failed');
      throw error; // Re-throw to mark job as failed
    }
  }
  ```

- [ ] Create `server/src/jobs/analytics/computePriceBenchmarksJob.ts`
  ```typescript
  import { Job } from 'bull';
  import { logger } from '../../utils/logger';
  import aggregationService from '../../services/analytics/aggregationService';

  export async function computePriceBenchmarksJob(job: Job): Promise<void> {
    logger.info({ jobId: job.id }, 'Starting compute-price-benchmarks job');

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await aggregationService.computePriceBenchmarks(today);

      logger.info({ jobId: job.id, date: today }, 'Compute-price-benchmarks job completed');
    } catch (error) {
      logger.error({ jobId: job.id, error }, 'Compute-price-benchmarks job failed');
      throw error;
    }
  }
  ```

- [ ] Create `server/src/jobs/analytics/analyzePurchasePatternsJob.ts`
  ```typescript
  import { Job } from 'bull';
  import { logger } from '../../utils/logger';
  import prisma from '../../prisma';
  import patternRecognitionService from '../../services/analytics/patternRecognitionService';

  export async function analyzePurchasePatternsJob(job: Job): Promise<void> {
    logger.info({ jobId: job.id }, 'Starting analyze-purchase-patterns job');

    try {
      // Get all items that have been ordered in last 180 days
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);

      const itemsWithOrders = await prisma.invoiceItem.groupBy({
        by: ['itemId'],
        where: {
          invoice: {
            date: { gte: sixMonthsAgo },
            status: 'APPROVED',
            deletedAt: null,
          },
        },
        _count: {
          itemId: true,
        },
        having: {
          itemId: {
            _count: {
              gte: 3, // Minimum 3 orders for pattern analysis
            },
          },
        },
      });

      logger.info({ itemCount: itemsWithOrders.length }, 'Items to analyze for patterns');

      // Analyze patterns for each item (per branch)
      const analysisPromises: Promise<any>[] = [];

      for (const item of itemsWithOrders) {
        // Analyze for all branches combined
        analysisPromises.push(
          patternRecognitionService.analyzePurchasePattern(item.itemId)
        );

        // Analyze per branch (get branches that order this item)
        const branchOrders = await prisma.invoiceItem.groupBy({
          by: ['itemId'],
          where: {
            itemId: item.itemId,
            invoice: {
              date: { gte: sixMonthsAgo },
              status: 'APPROVED',
              deletedAt: null,
              branchId: { not: null },
            },
          },
          _count: {
            itemId: true,
          },
        });

        for (const branchOrder of branchOrders) {
          const branchInvoices = await prisma.invoiceItem.findMany({
            where: {
              itemId: item.itemId,
              invoice: {
                branchId: branchOrder.itemId, // This is actually branchId due to groupBy
                date: { gte: sixMonthsAgo },
                status: 'APPROVED',
                deletedAt: null,
              },
            },
            select: {
              invoice: {
                select: {
                  branchId: true,
                },
              },
            },
          });

          const branchId = branchInvoices[0]?.invoice.branchId;
          if (branchId) {
            analysisPromises.push(
              patternRecognitionService.analyzePurchasePattern(item.itemId, branchId)
            );
          }
        }
      }

      // Execute all analyses in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < analysisPromises.length; i += batchSize) {
        const batch = analysisPromises.slice(i, i + batchSize);
        await Promise.all(batch);
        logger.info({ progress: `${i + batch.length}/${analysisPromises.length}` }, 'Pattern analysis progress');
      }

      logger.info({ jobId: job.id, patternCount: analysisPromises.length }, 'Analyze-purchase-patterns job completed');
    } catch (error) {
      logger.error({ jobId: job.id, error }, 'Analyze-purchase-patterns job failed');
      throw error;
    }
  }
  ```

- [ ] Create `server/src/jobs/analytics/generateRecommendationsJob.ts`
  ```typescript
  import { Job } from 'bull';
  import { logger } from '../../utils/logger';
  import recommendationService from '../../services/recommendations/recommendationService';

  export async function generateRecommendationsJob(job: Job): Promise<void> {
    logger.info({ jobId: job.id }, 'Starting generate-recommendations job');

    try {
      const recommendations = await recommendationService.generateRecommendations();

      logger.info({ jobId: job.id, count: recommendations.length }, 'Generate-recommendations job completed');
    } catch (error) {
      logger.error({ jobId: job.id, error }, 'Generate-recommendations job failed');
      throw error;
    }
  }
  ```

- [ ] Create `server/src/jobs/analytics/detectAnomaliesJob.ts`
  ```typescript
  import { Job } from 'bull';
  import { logger } from '../../utils/logger';
  import prisma from '../../prisma';
  import patternRecognitionService from '../../services/analytics/patternRecognitionService';

  export async function detectAnomaliesJob(job: Job): Promise<void> {
    logger.info({ jobId: job.id }, 'Starting detect-anomalies job');

    try {
      // Get all patterns
      const patterns = await prisma.purchasePattern.findMany();

      logger.info({ patternCount: patterns.length }, 'Patterns to check for anomalies');

      let totalAnomalies = 0;

      for (const pattern of patterns) {
        const anomalies = await patternRecognitionService.detectAnomalies(
          pattern.itemId,
          pattern.branchId || undefined
        );

        totalAnomalies += anomalies.length;
      }

      logger.info({ jobId: job.id, anomalyCount: totalAnomalies }, 'Detect-anomalies job completed');
    } catch (error) {
      logger.error({ jobId: job.id, error }, 'Detect-anomalies job failed');
      throw error;
    }
  }
  ```

- [ ] Create `server/src/jobs/analytics/cleanupExpiredRecommendationsJob.ts`
  ```typescript
  import { Job } from 'bull';
  import { logger } from '../../utils/logger';
  import recommendationService from '../../services/recommendations/recommendationService';

  export async function cleanupExpiredRecommendationsJob(job: Job): Promise<void> {
    logger.info({ jobId: job.id }, 'Starting cleanup-expired-recommendations job');

    try {
      const expiredCount = await recommendationService.expireRecommendations();

      logger.info({ jobId: job.id, expiredCount }, 'Cleanup-expired-recommendations job completed');
    } catch (error) {
      logger.error({ jobId: job.id, error }, 'Cleanup-expired-recommendations job failed');
      throw error;
    }
  }
  ```

---

### 3.2 Job Queue Setup

- [ ] Create `server/src/jobs/analytics/index.ts`
  ```typescript
  import jobQueueService from '../../services/infrastructure/jobQueueService';
  import { AnalyticsConfig } from '../../config/analytics';
  import { computeSpendingMetricsJob } from './computeSpendingMetricsJob';
  import { computePriceBenchmarksJob } from './computePriceBenchmarksJob';
  import { analyzePurchasePatternsJob } from './analyzePurchasePatternsJob';
  import { generateRecommendationsJob } from './generateRecommendationsJob';
  import { detectAnomaliesJob } from './detectAnomaliesJob';
  import { cleanupExpiredRecommendationsJob } from './cleanupExpiredRecommendationsJob';
  import { logger } from '../../utils/logger';

  export function setupAnalyticsJobs(): void {
    logger.info('Setting up analytics job queues');

    // ARCHITECTURE FIX: Create separate queues for independent job types
    const aggregationQueue = jobQueueService.createQueue(AnalyticsConfig.QUEUES.AGGREGATION);
    const patternQueue = jobQueueService.createQueue(AnalyticsConfig.QUEUES.PATTERN);
    const recommendationsQueue = jobQueueService.createQueue(AnalyticsConfig.QUEUES.RECOMMENDATIONS);

    // Register processors for aggregation queue
    // ARCHITECTURE FIX: Use job name for routing (not jobId)
    aggregationQueue.process(
      AnalyticsConfig.JOBS.COMPUTE_SPENDING_METRICS,
      1, // Concurrency
      computeSpendingMetricsJob
    );
    aggregationQueue.process(
      AnalyticsConfig.JOBS.COMPUTE_PRICE_BENCHMARKS,
      1,
      computePriceBenchmarksJob
    );

    // Register processors for pattern queue
    patternQueue.process(
      AnalyticsConfig.JOBS.ANALYZE_PURCHASE_PATTERNS,
      1,
      analyzePurchasePatternsJob
    );
    patternQueue.process(
      AnalyticsConfig.JOBS.DETECT_ANOMALIES,
      1,
      detectAnomaliesJob
    );

    // Register processors for recommendations queue
    recommendationsQueue.process(
      AnalyticsConfig.JOBS.GENERATE_RECOMMENDATIONS,
      1,
      generateRecommendationsJob
    );
    recommendationsQueue.process(
      AnalyticsConfig.JOBS.CLEANUP_EXPIRED_RECOMMENDATIONS,
      1,
      cleanupExpiredRecommendationsJob
    );

    // Schedule recurring jobs
    if (process.env.ANALYTICS_JOBS_ENABLED === 'true') {
      // ARCHITECTURE FIX: Use job name as first argument to queue.add()
      // The job name is what appears in Bull Board and is used for routing

      // Aggregation jobs
      aggregationQueue.add(
        AnalyticsConfig.JOBS.COMPUTE_SPENDING_METRICS, // job name
        {}, // data
        {
          repeat: { cron: AnalyticsConfig.SCHEDULES.COMPUTE_SPENDING_METRICS },
          timeout: AnalyticsConfig.JOB_TIMEOUTS.COMPUTE_SPENDING_METRICS,
        }
      );

      aggregationQueue.add(
        AnalyticsConfig.JOBS.COMPUTE_PRICE_BENCHMARKS,
        {},
        {
          repeat: { cron: AnalyticsConfig.SCHEDULES.COMPUTE_PRICE_BENCHMARKS },
          timeout: AnalyticsConfig.JOB_TIMEOUTS.COMPUTE_PRICE_BENCHMARKS,
        }
      );

      // Pattern jobs
      patternQueue.add(
        AnalyticsConfig.JOBS.ANALYZE_PURCHASE_PATTERNS,
        {},
        {
          repeat: { cron: AnalyticsConfig.SCHEDULES.ANALYZE_PURCHASE_PATTERNS },
          timeout: AnalyticsConfig.JOB_TIMEOUTS.ANALYZE_PURCHASE_PATTERNS,
        }
      );

      patternQueue.add(
        AnalyticsConfig.JOBS.DETECT_ANOMALIES,
        {},
        {
          repeat: { cron: AnalyticsConfig.SCHEDULES.DETECT_ANOMALIES },
          timeout: AnalyticsConfig.JOB_TIMEOUTS.DETECT_ANOMALIES,
        }
      );

      // Recommendation jobs
      recommendationsQueue.add(
        AnalyticsConfig.JOBS.GENERATE_RECOMMENDATIONS,
        {},
        {
          repeat: { cron: AnalyticsConfig.SCHEDULES.GENERATE_RECOMMENDATIONS },
          timeout: AnalyticsConfig.JOB_TIMEOUTS.GENERATE_RECOMMENDATIONS,
        }
      );

      recommendationsQueue.add(
        AnalyticsConfig.JOBS.CLEANUP_EXPIRED_RECOMMENDATIONS,
        {},
        {
          repeat: { cron: AnalyticsConfig.SCHEDULES.CLEANUP_EXPIRED_RECOMMENDATIONS },
          timeout: AnalyticsConfig.JOB_TIMEOUTS.CLEANUP_EXPIRED_RECOMMENDATIONS,
        }
      );

      logger.info('Analytics recurring jobs scheduled on 3 separate queues');
    } else {
      logger.warn('Analytics jobs disabled (ANALYTICS_JOBS_ENABLED=false)');
    }

    logger.info('Analytics job queue setup complete');
  }
  ```

- [ ] Update `server/src/index.ts` to initialize jobs:
  ```typescript
  import { setupAnalyticsJobs } from './jobs/analytics';

  // ... existing code ...

  // Setup analytics jobs (after Express app setup)
  if (process.env.ANALYTICS_ENABLED === 'true') {
    setupAnalyticsJobs();
    logger.info('Analytics jobs initialized');
  }
  ```

---

### 3.3 Bull Dashboard (Optional but Recommended)

- [ ] Install Bull Board for monitoring:
  ```bash
  pnpm add @bull-board/express @bull-board/api
  ```

- [ ] Create `server/src/middleware/bullBoard.ts`:
  ```typescript
  import { createBullBoard } from '@bull-board/api';
  import { BullAdapter } from '@bull-board/api/bullAdapter';
  import { ExpressAdapter } from '@bull-board/express';
  import jobQueueService from '../services/infrastructure/jobQueueService';
  import { AnalyticsConfig } from '../config/analytics';

  export function setupBullBoard() {
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    const queue = jobQueueService.getQueue(AnalyticsConfig.QUEUES.ANALYTICS);

    if (queue) {
      createBullBoard({
        queues: [new BullAdapter(queue)],
        serverAdapter,
      });
    }

    return serverAdapter.getRouter();
  }
  ```

- [ ] Update `server/src/index.ts`:
  ```typescript
  import { setupBullBoard } from './middleware/bullBoard';

  // ... existing code ...

  // Bull Board (admin only)
  if (process.env.NODE_ENV !== 'production') {
    app.use('/admin/queues', setupBullBoard());
    logger.info('Bull Board available at /admin/queues');
  }
  ```

- [ ] Access Bull Board: `http://localhost:3000/admin/queues`

---

### 3.4 Manual Job Trigger Endpoints (for testing)

- [ ] Create `server/src/routes/admin/jobs.ts`:
  ```typescript
  import express from 'express';
  import { authenticateToken } from '../../middleware/auth';
  import { authorize } from '../../middleware/authorize';
  import { Permission } from '../../constants/permissions';
  import jobQueueService from '../../services/infrastructure/jobQueueService';
  import { AnalyticsConfig } from '../../config/analytics';

  const router = express.Router();

  router.use(authenticateToken);
  router.use(authorize(Permission.ADMIN)); // ADMIN only

  // Trigger spending metrics job
  router.post('/trigger/spending-metrics', async (req, res) => {
    try {
      await jobQueueService.addJob(
        AnalyticsConfig.QUEUES.ANALYTICS,
        {},
        { jobId: AnalyticsConfig.JOBS.COMPUTE_SPENDING_METRICS }
      );
      res.json({ message: 'Spending metrics job triggered' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to trigger job' });
    }
  });

  // Trigger price benchmarks job
  router.post('/trigger/price-benchmarks', async (req, res) => {
    try {
      await jobQueueService.addJob(
        AnalyticsConfig.QUEUES.ANALYTICS,
        {},
        { jobId: AnalyticsConfig.JOBS.COMPUTE_PRICE_BENCHMARKS }
      );
      res.json({ message: 'Price benchmarks job triggered' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to trigger job' });
    }
  });

  // ... similar endpoints for other jobs ...

  export default router;
  ```

- [ ] Register routes in `server/src/index.ts`:
  ```typescript
  import adminJobsRouter from './routes/admin/jobs';
  app.use('/api/admin/jobs', adminJobsRouter);
  ```

---

### 3.5 Phase 3 Verification

- [ ] Start Redis: `docker ps` shows Redis running
- [ ] Start server: `pnpm dev`
- [ ] Check logs: Jobs scheduled successfully
- [ ] Access Bull Board: `http://localhost:3000/admin/queues`
- [ ] Trigger manual job: `POST /api/admin/jobs/trigger/spending-metrics`
- [ ] Verify job executes: Check Bull Board and logs
- [ ] Verify data populated: Check Prisma Studio for SpendingMetric records
- [ ] Commit: "feat: implement analytics background jobs with Bull queue"

---

## Phase 4: API Endpoints (Week 3-4, Days 16-20)

### 4.1 Analytics API Routes

- [ ] Create `server/src/routes/analytics/foundation.ts`:
  ```typescript
  import express from 'express';
  import { authenticateToken } from '../../middleware/auth';
  import { authorize } from '../../middleware/authorize';
  import { Permission } from '../../constants/permissions';
  import prisma from '../../prisma';
  import crossLocationService from '../../services/analytics/crossLocationService';
  import { logger } from '../../utils/logger';

  const router = express.Router();

  router.use(authenticateToken);

  // GET /api/analytics/foundation/spending-metrics
  router.get('/spending-metrics', authorize(Permission.ANALYTICS_READ), async (req, res) => {
    try {
      const { startDate, endDate, itemId, vendorId, branchId, departmentId, page = '1', limit = '20' } = req.query;

      const pageNum = Math.max(1, parseInt(page as string));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};

      if (startDate) {
        where.date = { ...where.date, gte: new Date(startDate as string) };
      }
      if (endDate) {
        where.date = { ...where.date, lte: new Date(endDate as string) };
      }
      if (itemId) {
        where.itemId = parseInt(itemId as string);
      }
      if (vendorId) {
        where.vendorId = parseInt(vendorId as string);
      }
      if (branchId) {
        where.branchId = parseInt(branchId as string);
      }
      if (departmentId) {
        where.departmentId = parseInt(departmentId as string);
      }

      const [metrics, total] = await Promise.all([
        prisma.spendingMetric.findMany({
          where,
          include: {
            item: true,
            vendor: true,
            branch: true,
            department: true,
          },
          orderBy: { date: 'desc' },
          skip,
          take: limitNum,
        }),
        prisma.spendingMetric.count({ where }),
      ]);

      res.json({
        data: metrics,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to retrieve spending metrics');
      res.status(500).json({ error: 'Failed to retrieve spending metrics' });
    }
  });

  // GET /api/analytics/foundation/price-variance
  router.get('/price-variance', authorize(Permission.ANALYTICS_READ), async (req, res) => {
    try {
      const { itemId, vendorId } = req.query;

      if (!itemId) {
        return res.status(400).json({ error: 'itemId is required' });
      }

      const results = await crossLocationService.getPriceVariance(
        parseInt(itemId as string),
        vendorId ? parseInt(vendorId as string) : undefined
      );

      res.json(results);
    } catch (error) {
      logger.error({ error }, 'Failed to retrieve price variance');
      res.status(500).json({ error: 'Failed to retrieve price variance' });
    }
  });

  // GET /api/analytics/foundation/purchase-patterns
  router.get('/purchase-patterns', authorize(Permission.ANALYTICS_READ), async (req, res) => {
    try {
      const { itemId, branchId, page = '1', limit = '20' } = req.query;

      const pageNum = Math.max(1, parseInt(page as string));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};

      if (itemId) {
        where.itemId = parseInt(itemId as string);
      }
      if (branchId) {
        where.branchId = parseInt(branchId as string);
      }

      const [patterns, total] = await Promise.all([
        prisma.purchasePattern.findMany({
          where,
          include: {
            item: true,
            branch: true,
          },
          orderBy: { lastUpdated: 'desc' },
          skip,
          take: limitNum,
        }),
        prisma.purchasePattern.count({ where }),
      ]);

      res.json({
        data: patterns,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to retrieve purchase patterns');
      res.status(500).json({ error: 'Failed to retrieve purchase patterns' });
    }
  });

  // GET /api/analytics/foundation/benchmarks/:itemId
  router.get('/benchmarks/:itemId', authorize(Permission.ANALYTICS_READ), async (req, res) => {
    try {
      const { itemId } = req.params;

      const stats = await crossLocationService.getBenchmarkStats(parseInt(itemId));

      if (!stats) {
        return res.status(404).json({ error: 'No benchmark data found for this item' });
      }

      res.json(stats);
    } catch (error) {
      logger.error({ error }, 'Failed to retrieve benchmark stats');
      res.status(500).json({ error: 'Failed to retrieve benchmark stats' });
    }
  });

  // GET /api/analytics/foundation/consolidation-opportunities
  router.get('/consolidation-opportunities', authorize(Permission.ANALYTICS_READ), async (req, res) => {
    try {
      const opportunities = await crossLocationService.findConsolidationOpportunities();

      res.json(opportunities);
    } catch (error) {
      logger.error({ error }, 'Failed to retrieve consolidation opportunities');
      res.status(500).json({ error: 'Failed to retrieve consolidation opportunities' });
    }
  });

  export default router;
  ```

---

### 4.2 Recommendations API Routes

- [ ] Create `server/src/routes/recommendations.ts`:
  ```typescript
  import express from 'express';
  import { authenticateToken } from '../middleware/auth';
  import { authorize } from '../middleware/authorize';
  import { Permission } from '../constants/permissions';
  import recommendationService from '../services/recommendations/recommendationService';
  import { logger } from '../utils/logger';

  const router = express.Router();

  router.use(authenticateToken);

  // GET /api/recommendations
  router.get('/', authorize(Permission.ANALYTICS_READ), async (req, res) => {
    try {
      const { limit = '20' } = req.query;
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));

      const recommendations = await recommendationService.getPendingRecommendations(limitNum);

      res.json(recommendations);
    } catch (error) {
      logger.error({ error }, 'Failed to retrieve recommendations');
      res.status(500).json({ error: 'Failed to retrieve recommendations' });
    }
  });

  // ARCHITECTURE FIX: Use PATCH for state changes per REST conventions
  // PATCH /api/recommendations/:id/view
  router.patch('/:id/view', authorize(Permission.ANALYTICS_READ), async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;

      const recommendation = await recommendationService.markViewed(parseInt(id), userId);

      res.json(recommendation);
    } catch (error) {
      logger.error({ error }, 'Failed to mark recommendation as viewed');
      res.status(500).json({ error: 'Failed to mark recommendation as viewed' });
    }
  });

  // PATCH /api/recommendations/:id/dismiss
  router.patch('/:id/dismiss', authorize(Permission.ANALYTICS_READ), async (req, res) => {
    try {
      const { id } = req.params;
      // ARCHITECTURE FIX: Validate input with Zod
      const { reason } = RecommendationDismissSchema.parse(req.body);
      const userId = (req as any).user.id;

      const recommendation = await recommendationService.dismiss(parseInt(id), userId, reason);

      res.json(recommendation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      logger.error({ error }, 'Failed to dismiss recommendation');
      res.status(500).json({ error: 'Failed to dismiss recommendation' });
    }
  });

  // PATCH /api/recommendations/:id/apply
  router.patch('/:id/apply', authorize(Permission.ANALYTICS_READ), async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;

      const recommendation = await recommendationService.apply(parseInt(id), userId);

      res.json(recommendation);
    } catch (error) {
      logger.error({ error }, 'Failed to apply recommendation');
      res.status(500).json({ error: 'Failed to apply recommendation' });
    }
  });

  export default router;
  ```

  > **ARCHITECTURE NOTE**: State change endpoints use PATCH instead of POST per REST conventions. Add Zod validation imports: `import { z } from 'zod'; import { RecommendationDismissSchema } from '../schemas/analytics.schema';`

---

### 4.3 Register Routes

- [ ] Update `server/src/index.ts`:
  ```typescript
  import analyticsFoundationRouter from './routes/analytics/foundation';
  import recommendationsRouter from './routes/recommendations';

  // ... existing code ...

  // Analytics Foundation routes
  app.use('/api/analytics/foundation', analyticsFoundationRouter);

  // Recommendations routes
  app.use('/api/recommendations', recommendationsRouter);
  ```

---

### 4.4 Permissions Setup

- [ ] Update `server/src/constants/permissions.ts`:
  ```typescript
  // Add analytics permissions
  export const Permission = {
    // ... existing permissions ...

    ANALYTICS_READ: 'analytics:read',
    ANALYTICS_WRITE: 'analytics:write',
  };
  ```

- [ ] Update role mappings in authorization middleware (if needed)

---

### 4.5 API Testing

- [ ] Create `server/src/tests/api/analytics-foundation.test.ts`:
  - [ ] Test GET /spending-metrics with filters
  - [ ] Test GET /price-variance
  - [ ] Test GET /purchase-patterns
  - [ ] Test GET /benchmarks/:itemId
  - [ ] Test GET /consolidation-opportunities

- [ ] Create `server/src/tests/api/recommendations.test.ts`:
  - [ ] Test GET /recommendations
  - [ ] Test POST /:id/view
  - [ ] Test POST /:id/dismiss
  - [ ] Test POST /:id/apply

- [ ] Run: `npm run test:api -- analytics`

---

### 4.6 Phase 4 Verification

- [ ] All API tests pass
- [ ] Test with Postman/Insomnia
- [ ] Verify permissions enforced
- [ ] Commit: "feat: add REST API endpoints for analytics foundation"

---

## Final Verification Checklist

### Database
- [ ] All Prisma migrations applied successfully
- [ ] All 4 analytics tables exist in database
- [ ] Indexes created correctly
- [ ] Enums created correctly
- [ ] Relations established correctly
- [ ] Seed data runs successfully

### Infrastructure Services
- [ ] Redis running and connectable
- [ ] RedisService: All methods functional
- [ ] JobQueueService: Queue creation works
- [ ] JobQueueService: Job scheduling works
- [ ] Bull Board accessible and showing jobs
- [ ] PubSub events firing correctly

### Analytics Services
- [ ] AggregationService: Computes metrics correctly
- [ ] PatternRecognitionService: Detects patterns
- [ ] CrossLocationService: Returns price variance
- [ ] RecommendationService: CRUD operations work
- [ ] RuleEngine: Framework functional

### Background Jobs
- [ ] All 6 jobs scheduled
- [ ] Jobs execute successfully
- [ ] Jobs handle errors and retry
- [ ] Jobs log progress
- [ ] Data populating in tables
- [ ] Cache invalidation working

### API Endpoints
- [ ] All endpoints registered
- [ ] Authentication required
- [ ] Authorization enforced
- [ ] Input validation working
- [ ] Responses correct format
- [ ] Error handling proper
- [ ] Cache headers set

### Testing
- [ ] Unit test coverage >80%
- [ ] Integration tests pass
- [ ] API tests pass
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Performance acceptable (<500ms for most queries)

### Documentation
- [ ] API endpoints documented
- [ ] Service interfaces documented
- [ ] Job schedules documented
- [ ] Configuration options documented
- [ ] README updated

### Deployment Readiness
- [ ] Environment variables documented
- [ ] Docker Compose updated (if used)
- [ ] Migration scripts tested
- [ ] Rollback plan documented
- [ ] Monitoring configured
- [ ] Health checks implemented

---

## Post-Implementation Tasks

### Week 4: Polish & Optimization
- [ ] Performance profiling
- [ ] Query optimization
- [ ] Index tuning
- [ ] Cache tuning (TTLs)
- [ ] Error handling improvements
- [ ] Logging improvements

### Week 5: Feature Integration
- [ ] Ready for Feature 1 (Cross-Location Cost Control)
- [ ] Ready for Feature 2 (Inventory Intelligence)
- [ ] Ready for Feature 3 (AI Smart Consultant)

---

## Notes

**Definition of Done** (for each task):
- Code written and reviewed
- Tests written and passing
- Documentation updated
- No console errors or warnings
- Committed with descriptive message

**Commit Message Format**:
```
type(scope): subject

body (optional)

footer (optional)
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Branch Strategy**:
- Feature branch: `feature/analytics-foundation`
- Sub-branches if needed: `feature/analytics-foundation/phase-1-database`
- Merge to `main` when phase complete and tested

---

**Document End**
