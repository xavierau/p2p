# Analytics Infrastructure Foundation - Phase 1 Analysis

**Document Version**: 1.0
**Date**: 2025-12-10
**Status**: Analysis Complete
**Purpose**: Identify shared infrastructure required for Cross-Location Cost Control, Inventory Intelligence, and AI Smart Consultant features

---

## Executive Summary

This document analyzes three advanced analytics features to identify the **minimal shared infrastructure** that must be built FIRST as a foundational feature. The analysis follows the principle of **mutual exclusivity** - each business feature should be independent, sharing only the common infrastructure layer.

### Three Features Under Analysis

1. **Cross-Location Cost Control** - Real-time price variance alerts and branch benchmarking
2. **Invoice-Based Inventory Intelligence** - Derive stock levels from purchase patterns
3. **AI Smart Consultant** - Proactive optimization recommendations

### Key Finding

All three features require a **unified analytics foundation** comprising:
- Time-series data storage and aggregation
- Pattern recognition engine
- Metrics collection pipeline
- Background job processing
- Recommendation framework

**Recommendation**: Build "Analytics & Intelligence Foundation" feature BEFORE implementing any of the three business features.

---

## Current System Analysis

### Existing Infrastructure

#### 1. Analytics Service (`server/src/services/analyticsService.ts`)
**Current Capabilities**:
- Dashboard totals (invoices, vendors, spending)
- Spending breakdown by vendor/item/department/branch
- Trend analysis (weekly/monthly/quarterly)
- Price change analytics

**Limitations for New Features**:
- No time-series optimization (uses aggregate queries each time)
- No cross-location comparison logic
- No pattern detection
- No prediction capabilities
- No recommendation engine
- Cache-only performance strategy (not scalable for complex analytics)

#### 2. Cache Service (`server/src/services/cacheService.ts`)
**Current Capabilities**:
- In-memory caching via node-cache
- TTL-based expiration
- Prefix-based invalidation
- Cache statistics

**Limitations**:
- Single-node only (not distributed)
- No support for complex data structures (sets, sorted sets)
- No pub/sub for cache invalidation across instances

#### 3. PubSub Service (`server/src/services/pubsub.ts`)
**Current Capabilities**:
- In-process event bus using EventEmitter
- Synchronous event handling
- Invoice/PO/Delivery Note/File events

**Limitations**:
- Single-process only (no distributed support)
- No job queue (background processing)
- No retry/failure handling
- No scheduled tasks

#### 4. Metrics Service (`server/src/services/metricsService.ts`)
**Current Capabilities**:
- Prometheus metrics (HTTP, business events, cache)
- Counter, Histogram, Gauge primitives

**Limitations**:
- No custom analytics metrics
- No time-series storage (Prometheus is external)
- No complex metric aggregation

#### 5. Database Schema (Prisma)
**Current Capabilities**:
- Transactional models (Invoice, PurchaseOrder, Item, Vendor)
- Price history tracking (`ItemPriceHistory`)
- Organizational hierarchy (Branch, Department, CostCenter)
- Audit logging schema

**Limitations**:
- No dedicated analytics tables
- No pre-aggregated metrics
- No time-series optimized storage
- No pattern/recommendation storage

---

## Shared Requirements Analysis

### Feature 1: Cross-Location Cost Control

#### Data Requirements
- **Historical price data per item per vendor per location** (time-series)
- **Aggregated spending metrics by location-item-vendor** (pre-computed)
- **Real-time price variance calculations** (cross-location queries)
- **Benchmark statistics** (network averages, percentiles)

#### Service Requirements
- **Cross-location query service** (compare prices across branches)
- **Variance calculation engine** (detect anomalies)
- **Alert generation service** (threshold-based notifications)
- **Benchmark computation service** (statistical aggregations)

#### Infrastructure Requirements
- **Time-series data store** (efficient temporal queries)
- **Aggregated metrics tables** (avoid expensive runtime calculations)
- **Background job processor** (periodic benchmark updates)
- **Alert queue** (async notification delivery)

---

### Feature 2: Invoice-Based Inventory Intelligence

#### Data Requirements
- **Purchase history per item per location** (time-series)
- **Consumption rate calculations** (derived metrics)
- **Order cycle patterns** (frequency, quantity, trend)
- **Stock-out predictions** (forecasts based on patterns)

#### Service Requirements
- **Pattern recognition engine** (detect order cycles)
- **Consumption rate calculator** (derive from invoices)
- **Stock-out predictor** (forecast based on trends)
- **Deviation detector** (flag unusual patterns)

#### Infrastructure Requirements
- **Time-series data store** (purchase history tracking)
- **Pattern storage** (learned cycles and trends)
- **Background job processor** (periodic pattern analysis)
- **Metrics aggregation pipeline** (compute derived metrics)

---

### Feature 3: AI Smart Consultant (Recommendations Engine)

#### Data Requirements
- **Historical transaction data** (invoices, POs, vendors, items)
- **Computed analytics** (spending, price changes, patterns)
- **Recommendation history** (track suggestions and outcomes)
- **Rule definitions** (configurable recommendation logic)

#### Service Requirements
- **Rule engine** (evaluate conditions and generate suggestions)
- **Recommendation generator** (business logic for suggestions)
- **Recommendation scorer** (prioritize by impact/confidence)
- **Feedback tracker** (learn from user actions on recommendations)

#### Infrastructure Requirements
- **Recommendation storage** (persist suggestions)
- **Rule definition system** (configurable business rules)
- **Background job processor** (periodic recommendation generation)
- **Analytics data warehouse** (consolidated data for analysis)

---

## Shared Infrastructure Identification

### Category 1: Data Storage

#### 1.1 Time-Series Optimized Tables

**Purpose**: Store temporal analytics data efficiently

**New Prisma Models Required**:

```prisma
// Aggregated spending metrics (pre-computed for performance)
model SpendingMetric {
  id             Int      @id @default(autoincrement())

  // Dimensions
  date           DateTime // Day-level granularity
  itemId         Int?
  vendorId       Int?
  branchId       Int?
  departmentId   Int?
  costCenterId   Int?

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
}

// Purchase patterns (learned from invoices)
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
}

// Cross-location price comparisons (snapshot data)
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
}
```

#### 1.2 Recommendation Storage

```prisma
// Recommendations generated by AI/rules engine
model Recommendation {
  id              Int                @id @default(autoincrement())

  type            RecommendationType // COST_OPT, VENDOR_SWITCH, WASTE_PREVENT, etc.
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
}

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

enum RecommendationStatus {
  PENDING
  VIEWED
  DISMISSED
  APPLIED
  EXPIRED
}
```

---

### Category 2: Background Processing

#### 2.1 Job Queue System

**Current Gap**: No background job processing (PubSub is sync-only)

**Solution**: Integrate **Bull** (Redis-based job queue)

**Jobs Needed**:
- `compute-spending-metrics` (hourly) - Aggregate invoice data
- `analyze-purchase-patterns` (daily) - Detect order cycles
- `generate-recommendations` (daily) - Run rules engine
- `compute-price-benchmarks` (daily) - Calculate network averages
- `detect-anomalies` (hourly) - Flag unusual patterns
- `cleanup-expired-recommendations` (daily)

**New Service**:

```typescript
// server/src/services/jobQueueService.ts
import Bull from 'bull';

export class JobQueueService {
  private queues: Map<string, Bull.Queue> = new Map();

  constructor(private redisUrl: string) {}

  createQueue(name: string, options?: Bull.QueueOptions): Bull.Queue {
    const queue = new Bull(name, this.redisUrl, options);
    this.queues.set(name, queue);
    return queue;
  }

  async addJob(queueName: string, data: any, options?: Bull.JobOptions) {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`Queue ${queueName} not found`);
    return queue.add(data, options);
  }

  async addRecurringJob(queueName: string, cronPattern: string, data: any) {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`Queue ${queueName} not found`);
    return queue.add(data, { repeat: { cron: cronPattern } });
  }
}
```

---

### Category 3: Analytics Engine

#### 3.1 Aggregation Service

**Purpose**: Pre-compute metrics to avoid expensive runtime queries

**New Service**:

```typescript
// server/src/services/analytics/aggregationService.ts
export class AggregationService {
  // Compute daily spending metrics by all dimensions
  async computeDailySpendingMetrics(date: Date): Promise<void>;

  // Compute price benchmarks across locations
  async computePriceBenchmarks(date: Date): Promise<void>;

  // Refresh materialized views (if using DB-level optimization)
  async refreshMaterializedViews(): Promise<void>;
}
```

#### 3.2 Pattern Recognition Service

**Purpose**: Detect recurring patterns in purchase behavior

**New Service**:

```typescript
// server/src/services/analytics/patternRecognitionService.ts
export class PatternRecognitionService {
  // Analyze purchase patterns for an item at a location
  async analyzePurchasePattern(itemId: number, branchId?: number): Promise<PurchasePattern>;

  // Detect order cycles (frequency, quantity)
  detectOrderCycle(invoices: Invoice[]): OrderCycleResult;

  // Predict next order date
  predictNextOrder(pattern: PurchasePattern): Date;

  // Detect anomalies (deviations from normal)
  detectAnomalies(pattern: PurchasePattern, recentInvoices: Invoice[]): Anomaly[];
}
```

#### 3.3 Cross-Location Query Service

**Purpose**: Efficiently query and compare data across branches

**New Service**:

```typescript
// server/src/services/analytics/crossLocationService.ts
export class CrossLocationService {
  // Get price variance for an item across all branches
  async getPriceVariance(itemId: number, vendorId?: number): Promise<PriceVarianceResult>;

  // Get benchmark statistics for an item (network avg, min, max)
  async getBenchmarkStats(itemId: number): Promise<BenchmarkStats>;

  // Compare spending across branches for a category
  async compareSpendingByBranch(filter: SpendingFilter): Promise<BranchComparison[]>;

  // Identify consolidation opportunities
  async findConsolidationOpportunities(): Promise<ConsolidationOpportunity[]>;
}
```

---

### Category 4: Recommendation Framework

#### 4.1 Rule Engine

**Purpose**: Evaluate business rules and generate recommendations

**New Service**:

```typescript
// server/src/services/recommendations/ruleEngine.ts
export class RuleEngine {
  private rules: Rule[] = [];

  // Register a rule
  registerRule(rule: Rule): void;

  // Evaluate all rules and generate recommendations
  async evaluateRules(context: AnalyticsContext): Promise<Recommendation[]>;

  // Evaluate a single rule
  evaluateRule(rule: Rule, context: AnalyticsContext): Recommendation | null;
}

export interface Rule {
  id: string;
  name: string;
  type: RecommendationType;
  priority: number;

  // Condition function (return true if rule applies)
  condition: (context: AnalyticsContext) => boolean;

  // Recommendation generator
  generateRecommendation: (context: AnalyticsContext) => Recommendation;
}
```

#### 4.2 Recommendation Service

**Purpose**: Generate, store, and manage recommendations

**New Service**:

```typescript
// server/src/services/recommendations/recommendationService.ts
export class RecommendationService {
  // Generate all recommendations (called by background job)
  async generateRecommendations(): Promise<Recommendation[]>;

  // Get pending recommendations for dashboard
  async getPendingRecommendations(limit?: number): Promise<Recommendation[]>;

  // Mark recommendation as viewed
  async markViewed(id: number, userId: number): Promise<void>;

  // Dismiss recommendation
  async dismiss(id: number, userId: number, reason?: string): Promise<void>;

  // Apply recommendation (mark as implemented)
  async apply(id: number, userId: number): Promise<void>;

  // Expire old recommendations
  async expireRecommendations(): Promise<void>;
}
```

---

### Category 5: Distributed Infrastructure

#### 5.1 Redis Upgrade

**Current**: node-cache (in-memory, single-process)
**Required**: Redis (distributed, persistent)

**Benefits**:
- Distributed caching across multiple API instances
- Pub/sub for cache invalidation
- Job queue backing store
- Session storage for horizontal scaling

**New Service**:

```typescript
// server/src/services/redisService.ts
import Redis from 'ioredis';

export class RedisService {
  private client: Redis;
  private pubClient: Redis;
  private subClient: Redis;

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl);
    this.pubClient = new Redis(redisUrl);
    this.subClient = new Redis(redisUrl);
  }

  // Cache operations
  async get(key: string): Promise<string | null>;
  async set(key: string, value: string, ttl?: number): Promise<void>;
  async del(key: string): Promise<void>;
  async invalidateByPrefix(prefix: string): Promise<void>;

  // Pub/Sub
  async publish(channel: string, message: string): Promise<void>;
  async subscribe(channel: string, handler: (message: string) => void): Promise<void>;

  // Sets (for deduplication)
  async sadd(key: string, ...members: string[]): Promise<number>;
  async smembers(key: string): Promise<string[]>;

  // Sorted Sets (for leaderboards, time-series)
  async zadd(key: string, score: number, member: string): Promise<number>;
  async zrange(key: string, start: number, stop: number): Promise<string[]>;
  async zrangebyscore(key: string, min: number, max: number): Promise<string[]>;
}
```

#### 5.2 Event-Driven Architecture Enhancement

**Current**: PubSub (in-process EventEmitter)
**Required**: Distributed event bus

**New Events Needed**:
- `analytics.spending-metrics-computed`
- `analytics.pattern-detected`
- `analytics.anomaly-detected`
- `recommendations.generated`
- `recommendations.applied`

---

## Dependency Graph

### Foundation Feature (Build FIRST)

**"Analytics & Intelligence Foundation"**

Components:
1. Database schema additions (SpendingMetric, PurchasePattern, PriceSnapshot, Recommendation)
2. Redis integration (RedisService, distributed cache)
3. Job queue system (JobQueueService, Bull integration)
4. Aggregation service (compute daily metrics)
5. Pattern recognition service (detect cycles)
6. Cross-location query service (price variance, benchmarks)
7. Recommendation framework (RuleEngine, RecommendationService)
8. Background jobs setup (cron schedules)
9. API endpoints (recommendations, analytics extensions)

**Estimated Effort**: 3-4 weeks (1 developer)

---

### Business Features (Build AFTER Foundation)

#### Feature 1: Cross-Location Cost Control
**Dependencies**:
- SpendingMetric, PriceSnapshot tables
- CrossLocationService
- AggregationService (price benchmarks)
- Background jobs (compute-price-benchmarks)

**Additional Work**:
- Price variance dashboard UI
- Alert configuration UI
- Location comparison charts
- Volume opportunity detector

**Estimated Effort**: 1.5 weeks

---

#### Feature 2: Inventory Intelligence
**Dependencies**:
- PurchasePattern table
- PatternRecognitionService
- Background jobs (analyze-purchase-patterns)

**Additional Work**:
- Inventory dashboard UI
- Stock-out prediction display
- Reorder alerts
- Consumption rate charts

**Estimated Effort**: 2 weeks

---

#### Feature 3: AI Smart Consultant
**Dependencies**:
- Recommendation table
- RuleEngine
- RecommendationService
- All analytics data (SpendingMetric, PurchasePattern, PriceSnapshot)
- Background jobs (generate-recommendations)

**Additional Work**:
- Recommendation dashboard UI
- Rule configuration UI (admin)
- Feedback mechanism
- Impact tracking

**Estimated Effort**: 2.5 weeks

---

## Mutual Exclusivity Validation

### Shared Components Matrix

| Component | Feature 1 | Feature 2 | Feature 3 |
|-----------|-----------|-----------|-----------|
| SpendingMetric table | ✓ | ✓ | ✓ |
| PurchasePattern table | - | ✓ | ✓ |
| PriceSnapshot table | ✓ | - | ✓ |
| Recommendation table | - | - | ✓ |
| RedisService | ✓ | ✓ | ✓ |
| JobQueueService | ✓ | ✓ | ✓ |
| AggregationService | ✓ | ✓ | ✓ |
| PatternRecognitionService | - | ✓ | ✓ |
| CrossLocationService | ✓ | - | ✓ |
| RuleEngine | - | - | ✓ |
| RecommendationService | - | - | ✓ |

**Analysis**:
- All features share data models and core infrastructure
- Feature-specific business logic is isolated
- No circular dependencies between features
- Features can be built independently after foundation

---

## Implementation Strategy

### Phase 0: Foundation (MUST DO FIRST)

**Sprint 1: Data & Infrastructure (Week 1-2)**
1. Add Prisma models (SpendingMetric, PurchasePattern, PriceSnapshot, Recommendation)
2. Database migration
3. Redis integration (replace node-cache)
4. Bull job queue setup
5. Basic job definitions (structure only)

**Sprint 2: Core Services (Week 2-3)**
1. AggregationService implementation
2. PatternRecognitionService (basic cycle detection)
3. CrossLocationService (price variance queries)
4. RecommendationService (CRUD only)
5. RuleEngine framework (no rules yet)

**Sprint 3: Background Jobs (Week 3-4)**
1. compute-spending-metrics job
2. compute-price-benchmarks job
3. analyze-purchase-patterns job
4. generate-recommendations job (skeleton)
5. Job scheduling and monitoring

**Sprint 4: API & Integration (Week 4)**
1. API endpoints for recommendations
2. Analytics API extensions
3. Event bus integration
4. Testing and documentation

---

### Phase 1: Feature Implementation (After Foundation)

**Can be done in PARALLEL** by different developers:

1. **Cross-Location Cost Control** (Developer A)
   - Price variance detection
   - Alert rules
   - Dashboard UI
   - Reports

2. **Inventory Intelligence** (Developer B)
   - Pattern detection refinement
   - Stock-out prediction
   - Reorder logic
   - Dashboard UI

3. **AI Smart Consultant** (Developer C)
   - Business rules definition
   - Recommendation generators
   - Feedback mechanism
   - Dashboard UI

---

## Risk Assessment

### Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Redis adds complexity | Medium | Use managed Redis (AWS ElastiCache) |
| Job failures undetected | High | Bull dashboard, monitoring, alerts |
| Analytics queries slow | High | Pre-aggregation, indexes, caching |
| Pattern detection inaccurate | Medium | Start with simple rules, refine iteratively |
| Data volume growth | Medium | Partition old data, archive strategy |

### Dependency Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Foundation delays block features | High | Strict sprint discipline, timeboxing |
| Breaking changes in foundation | Medium | Versioned APIs, feature flags |
| Insufficient test coverage | Medium | Unit + integration tests required |

---

## Success Criteria

### Foundation Feature Complete When:

1. ✅ All Prisma models deployed to production
2. ✅ Redis operational and caching working
3. ✅ Job queue running scheduled jobs
4. ✅ AggregationService computing daily metrics
5. ✅ PatternRecognitionService detecting basic cycles
6. ✅ CrossLocationService querying price variance
7. ✅ RecommendationService API functional
8. ✅ Background jobs monitored and alerting
9. ✅ 80%+ test coverage on all services
10. ✅ API documentation updated

### Business Features Unblocked When:

- Foundation deployed to production
- Metrics data populated (at least 7 days)
- Job queue processing reliably
- API endpoints stable and documented

---

## Conclusion

The **Analytics & Intelligence Foundation** is a critical shared layer that must be built BEFORE any of the three business features. This approach:

1. **Avoids duplication** - No repeated infrastructure work across features
2. **Enables parallelization** - Features can be built simultaneously after foundation
3. **Ensures consistency** - Shared data models and services
4. **Reduces risk** - Foundation tested independently before business logic
5. **Maintains clean architecture** - Clear separation of concerns

**Next Steps**:
1. Review and approve this analysis
2. Create detailed implementation plan for Foundation feature
3. Assign sprint team to Foundation work
4. Create separate implementation plans for each business feature
5. Schedule feature work after Foundation completion

---

**Document End**
