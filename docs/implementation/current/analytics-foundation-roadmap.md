# Analytics Foundation - Implementation Roadmap

**Document Version**: 1.1
**Date**: 2025-12-10
**Status**: Ready for Implementation (Architecture Approved with Modifications)
**Estimated Total Effort**: 6-7 weeks (Foundation + 3 Features)
**Architecture Review**: 2025-12-10 - Approved with required changes

---

## Visual Dependency Graph

```
                    ┌─────────────────────────────────────┐
                    │  ANALYTICS & INTELLIGENCE FOUNDATION │
                    │         (3-4 weeks, FIRST)           │
                    └──────────────────┬──────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
                    ▼                  ▼                  ▼
        ┌────────────────────┐ ┌────────────────┐ ┌────────────────────┐
        │  Cross-Location    │ │   Inventory    │ │  AI Smart          │
        │  Cost Control      │ │   Intelligence │ │  Consultant        │
        │  (1.5 weeks)       │ │   (2 weeks)    │ │  (2.5 weeks)       │
        └────────────────────┘ └────────────────┘ └────────────────────┘
               ↓                       ↓                     ↓
        ┌────────────────────┐ ┌────────────────┐ ┌────────────────────┐
        │ Price variance     │ │ Stock-out      │ │ Proactive          │
        │ alerts             │ │ predictions    │ │ optimization       │
        │ Network benchmarks │ │ Reorder alerts │ │ recommendations    │
        │ Volume opportun.   │ │ Pattern detect │ │ Impact tracking    │
        └────────────────────┘ └────────────────┘ └────────────────────┘
```

---

## Architecture Review Summary

> **Key Changes Required** (from 2025-12-10 review):

| Change | Impact | Phase |
|--------|--------|-------|
| Create `domain/analytics/` with DDD structure | High | Sprint 1 |
| Use dependency injection (no singletons) | High | Sprint 2 |
| Add `dimensionHash` to SpendingMetric | High | Sprint 1 |
| Use separate Bull queues (3 queues) | Medium | Sprint 3 |
| Fix Bull job naming (use job.name) | High | Sprint 3 |
| Add Zod validation schemas | Medium | Sprint 1 |
| Use PATCH for state changes (REST) | Low | Sprint 4 |
| Add error handling classes | Medium | Sprint 2 |

---

## Foundation Components Breakdown

### Component Tree (Updated)

```
Analytics & Intelligence Foundation
├── 0. Domain Layer (NEW - DDD Structure)
│   └── domain/analytics/
│       ├── entities/
│       │   ├── SpendingMetric.ts
│       │   ├── PurchasePattern.ts
│       │   └── Recommendation.ts
│       ├── value-objects/
│       │   ├── RecommendationType.ts
│       │   └── ConfidenceScore.ts
│       ├── repositories/
│       │   ├── ISpendingMetricRepository.ts
│       │   └── IRecommendationRepository.ts
│       ├── services/
│       │   ├── IAggregationService.ts
│       │   ├── IPatternRecognitionService.ts
│       │   ├── ICrossLocationService.ts
│       │   └── ICacheService.ts
│       └── events/
│           └── AnalyticsEvents.ts
│
├── 1. Data Layer
│   ├── SpendingMetric (table + dimensionHash unique key)
│   ├── PurchasePattern (table)
│   ├── PriceSnapshot (table)
│   └── Recommendation (table + enums)
│
├── 2. Infrastructure Layer
│   ├── RedisService (implements ICacheService)
│   ├── JobQueueService (Bull integration)
│   └── Distributed PubSub (event bus)
│
├── 3. Analytics Services (with DI)
│   ├── AggregationService (implements IAggregationService)
│   │   ├── computeDailySpendingMetrics()
│   │   ├── computePriceBenchmarks()
│   │   └── refreshMaterializedViews()
│   │
│   ├── PatternRecognitionService (implements IPatternRecognitionService)
│   │   ├── analyzePurchasePattern()
│   │   ├── detectOrderCycle()
│   │   ├── predictNextOrder()
│   │   └── detectAnomalies()
│   │
│   └── CrossLocationService (implements ICrossLocationService)
│       ├── getPriceVariance()
│       ├── getBenchmarkStats()
│       ├── compareSpendingByBranch()
│       └── findConsolidationOpportunities()
│
├── 4. Recommendation Framework
│   ├── RuleEngine
│   │   ├── registerRule()
│   │   ├── evaluateRules()
│   │   └── evaluateRule()
│   │
│   └── RecommendationService
│       ├── generateRecommendations()
│       ├── getPendingRecommendations()
│       ├── markViewed()
│       ├── dismiss()
│       ├── apply()
│       └── expireRecommendations()
│
├── 5. Background Jobs (3 Separate Queues)
│   ├── analytics:aggregation queue
│   │   ├── compute-spending-metrics (hourly)
│   │   └── compute-price-benchmarks (daily)
│   ├── analytics:pattern queue
│   │   ├── analyze-purchase-patterns (daily)
│   │   └── detect-anomalies (hourly)
│   └── analytics:recommendations queue
│       ├── generate-recommendations (daily)
│       └── cleanup-expired-recommendations (daily)
│
├── 6. Validation Layer (NEW)
│   └── schemas/analytics.schema.ts (Zod)
│
├── 7. Error Handling (NEW)
│   └── errors/AnalyticsError.ts
│
└── 8. API Layer (REST Conventions)
    ├── GET /api/analytics/spending-metrics
    ├── GET /api/analytics/price-variance
    ├── GET /api/analytics/purchase-patterns
    ├── GET /api/recommendations
    ├── PATCH /api/recommendations/:id/view
    ├── PATCH /api/recommendations/:id/dismiss
    └── PATCH /api/recommendations/:id/apply
```

---

## Sprint Breakdown (Foundation)

### Sprint 1: Data, Domain Layer & Infrastructure (Week 1-2)

> **UPDATED**: Added Domain Layer setup (Days 3-4) per architecture review

#### Day 1-2: Database Schema
- [ ] Define Prisma models (SpendingMetric, PurchasePattern, PriceSnapshot, Recommendation)
- [ ] **NEW**: Add `dimensionHash` unique column to SpendingMetric (replaces composite unique on nullable fields)
- [ ] Add indexes for performance
- [ ] Create migration
- [ ] Test migration on dev database
- [ ] Seed test data

**Deliverable**: Database schema deployed, seedable

---

#### Day 3-4: Domain Layer Setup (NEW)
- [ ] Create `domain/analytics/` directory structure
- [ ] Define service interfaces:
  - `ICacheService` - cache abstraction
  - `IAggregationService` - aggregation contract
  - `IPatternRecognitionService` - pattern detection contract
  - `ICrossLocationService` - cross-location analysis contract
- [ ] Define analytics events (`AnalyticsEvents.ts`)
- [ ] Create error classes (`errors/AnalyticsError.ts`)
- [ ] Create Zod validation schemas (`schemas/analytics.schema.ts`)

**Deliverable**: Domain layer interfaces defined, validation schemas ready

---

#### Day 5-7: Redis Integration
- [ ] Install `ioredis` package
- [ ] Create `RedisService` class **implementing ICacheService**
- [ ] Implement cache methods (get, set, del, invalidateByPrefix)
- [ ] Implement pub/sub methods
- [ ] Implement set/sorted set methods
- [ ] **NEW**: Use factory function instead of singleton export
- [ ] Update cache invalidation subscribers
- [ ] Test distributed caching

**Deliverable**: Redis operational, implements ICacheService interface

---

#### Day 8-9: Job Queue Setup
- [ ] Install `bull` and `@types/bull`
- [ ] Create `JobQueueService` class
- [ ] **NEW**: Create 3 separate queues (aggregation, pattern, recommendations)
- [ ] Create job processors (empty handlers)
- [ ] Set up Bull dashboard (monitoring)
- [ ] **NEW**: Configure job-specific timeouts
- [ ] Test job scheduling

**Deliverable**: Job queues operational (3 queues), jobs scheduled (empty)

---

#### Day 10: Integration & Testing
- [ ] Unit tests for RedisService (with ICacheService contract tests)
- [ ] Unit tests for JobQueueService
- [ ] Integration tests (Redis + jobs)
- [ ] Load testing (cache performance)
- [ ] Documentation (setup, configuration)

**Deliverable**: Sprint 1 complete, infrastructure tested

---

### Sprint 2: Core Services (Week 2-3)

> **UPDATED**: Services must implement interfaces and use dependency injection

#### Day 1-3: AggregationService
- [ ] Create `AggregationService` class **implementing IAggregationService**
- [ ] **NEW**: Accept dependencies via constructor (PrismaClient, ICacheService, PubSub)
- [ ] Implement `computeDailySpendingMetrics()`
  - Query approved invoices for date
  - Group by dimensions (item, vendor, branch, dept)
  - **NEW**: Compute `dimensionHash` for uniqueness
  - **NEW**: Wrap in `prisma.$transaction()` for data integrity
  - Insert into SpendingMetric table
- [ ] Implement `computePriceBenchmarks()`
  - Query item prices across branches
  - Calculate avg, min, max, std dev
  - Insert into PriceSnapshot table
- [ ] **NEW**: Add cursor-based batching for large datasets
- [ ] Unit tests with mocked dependencies
- [ ] Integration tests with test database

**Deliverable**: AggregationService functional, tested, uses DI

---

#### Day 4-6: PatternRecognitionService
- [ ] Create `PatternRecognitionService` class **implementing IPatternRecognitionService**
- [ ] **NEW**: Accept dependencies via constructor
- [ ] Implement `detectOrderCycle()`
  - Calculate time between orders
  - Calculate average quantity
  - Compute standard deviations
  - **NEW**: Guard against division by zero (empty arrays)
- [ ] Implement `analyzePurchasePattern()`
  - Fetch historical invoices
  - Detect cycles
  - Identify trends (increasing/decreasing)
  - Store in PurchasePattern table
- [ ] Implement `predictNextOrder()`
  - Use cycle + last order date
- [ ] Implement `detectAnomalies()`
  - Compare recent orders to pattern
  - Flag outliers (>2 std dev)
- [ ] Unit tests with fixture data (including edge cases)
- [ ] Integration tests

**Deliverable**: PatternRecognitionService functional, tested, handles edge cases

---

#### Day 7-9: CrossLocationService
- [ ] Create `CrossLocationService` class **implementing ICrossLocationService**
- [ ] **NEW**: Accept dependencies via constructor
- [ ] Implement `getPriceVariance()`
  - Query PriceSnapshot for item
  - Compare across branches
  - Calculate variance percentages
  - **NEW**: Use structured cache keys (`analytics:price-variance:item:{id}:vendor:{id}`)
- [ ] Implement `getBenchmarkStats()`
  - Return network avg, min, max from PriceSnapshot
- [ ] Implement `compareSpendingByBranch()`
  - Query SpendingMetric grouped by branch
- [ ] Implement `findConsolidationOpportunities()`
  - Identify items purchased by multiple branches
  - Suggest vendor consolidation
- [ ] Unit tests
- [ ] Integration tests

**Deliverable**: CrossLocationService functional, tested

---

#### Day 10: RecommendationService & RuleEngine (Skeleton)
- [ ] Create `RecommendationService` class
- [ ] **NEW**: Accept dependencies via constructor
- [ ] Implement CRUD methods (generateRecommendations stub)
- [ ] Implement user interaction methods (view, dismiss, apply)
- [ ] Create `RuleEngine` class
- [ ] Define Rule interface
- [ ] Implement `registerRule()` and `evaluateRules()` framework
- [ ] Unit tests

**Deliverable**: Recommendation framework structure ready

---

### Sprint 3: Background Jobs (Week 3-4)

> **UPDATED**: Jobs run on 3 separate queues with proper job naming

#### Day 1-2: Spending Metrics Job (analytics:aggregation queue)
- [ ] Implement `compute-spending-metrics` job handler
- [ ] Call `AggregationService.computeDailySpendingMetrics()`
- [ ] Handle errors and retries
- [ ] Log progress and results
- [ ] **NEW**: Use job name (not jobId) for Bull routing
- [ ] **NEW**: Configure 2-minute timeout
- [ ] Schedule hourly execution
- [ ] Test job execution
- [ ] Monitor job dashboard

**Deliverable**: Spending metrics computed automatically

---

#### Day 3-4: Price Benchmarks Job (analytics:aggregation queue)
- [ ] Implement `compute-price-benchmarks` job handler
- [ ] Call `AggregationService.computePriceBenchmarks()`
- [ ] Handle errors and retries
- [ ] **NEW**: Configure 5-minute timeout (heavy job)
- [ ] Schedule daily execution
- [ ] Test job execution

**Deliverable**: Price benchmarks computed automatically

---

#### Day 5-6: Purchase Patterns Job (analytics:pattern queue)
- [ ] Implement `analyze-purchase-patterns` job handler
- [ ] Iterate over all items (or per branch)
- [ ] Call `PatternRecognitionService.analyzePurchasePattern()`
- [ ] **NEW**: Implement incremental updates (only items with new invoices)
- [ ] Store results in PurchasePattern table
- [ ] Handle errors and retries
- [ ] **NEW**: Configure 5-minute timeout (heavy job)
- [ ] Schedule daily execution
- [ ] Test job execution

**Deliverable**: Purchase patterns analyzed automatically

---

#### Day 7-8: Recommendations Job (analytics:recommendations queue)
- [ ] Implement `generate-recommendations` job handler
- [ ] Call `RuleEngine.evaluateRules()` (no rules yet)
- [ ] Store recommendations
- [ ] Handle errors and retries
- [ ] **NEW**: Configure 3-minute timeout
- [ ] Schedule daily execution
- [ ] Test job execution

**Deliverable**: Recommendation generation pipeline ready

---

#### Day 9: Anomaly Detection Job (analytics:pattern queue)
- [ ] Implement `detect-anomalies` job handler
- [ ] Fetch recent invoices
- [ ] Call `PatternRecognitionService.detectAnomalies()`
- [ ] Optionally create recommendations for anomalies
- [ ] **NEW**: Configure 2-minute timeout
- [ ] Schedule hourly execution

**Deliverable**: Anomalies detected automatically

---

#### Day 10: Cleanup Job (analytics:recommendations queue)
- [ ] Implement `cleanup-expired-recommendations` job handler
- [ ] Call `RecommendationService.expireRecommendations()`
- [ ] Archive old data (optional)
- [ ] **NEW**: Configure 1-minute timeout
- [ ] Schedule daily execution

**Deliverable**: Old recommendations cleaned up

---

### Sprint 4: API & Integration (Week 4)

> **UPDATED**: Use PATCH for state changes, validate with Zod

#### Day 1-3: API Endpoints
- [ ] Create route `/api/analytics/spending-metrics` (GET)
- [ ] Create route `/api/analytics/price-variance` (GET)
- [ ] Create route `/api/analytics/purchase-patterns` (GET)
- [ ] Create route `/api/recommendations` (GET)
- [ ] **NEW**: Create route `/api/recommendations/:id/view` (PATCH - not POST)
- [ ] **NEW**: Create route `/api/recommendations/:id/dismiss` (PATCH - not POST)
- [ ] **NEW**: Create route `/api/recommendations/:id/apply` (PATCH - not POST)
- [ ] **NEW**: Apply Zod validation to all endpoints (using schemas from Sprint 1)
- [ ] Add RBAC middleware (ANALYTICS_READ, RECOMMENDATION_READ)
- [ ] **NEW**: Extend `/health` endpoint with Redis and job queue status
- [ ] Unit tests for routes

**Deliverable**: API endpoints functional, documented, REST-compliant

---

#### Day 4-5: Event Bus Integration
- [ ] Define new PubSub events (from `AnalyticsEvents.ts`):
  - `analytics.spending-metrics-computed`
  - `analytics.pattern-detected`
  - `analytics.anomaly-detected`
  - `recommendations.generated`
  - `recommendations.applied`
- [ ] Emit events from services
- [ ] Create subscribers (e.g., cache invalidation)
- [ ] Test event flow

**Deliverable**: Events published and handled

---

#### Day 6-7: Testing & Bug Fixes
- [ ] Integration tests (end-to-end)
- [ ] Load testing (job queue under load)
- [ ] Performance testing (query optimization)
- [ ] Fix bugs
- [ ] Refactor as needed

**Deliverable**: Foundation stable and tested

---

#### Day 8-10: Documentation & Handoff
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Service documentation (JSDoc)
- [ ] Job queue documentation (schedules, monitoring)
- [ ] Deployment guide (Redis setup, Bull dashboard)
- [ ] Troubleshooting guide
- [ ] Create demo data
- [ ] Record demo video (optional)

**Deliverable**: Foundation documented and ready for feature teams

---

## Business Features Roadmap (After Foundation)

### Feature 1: Cross-Location Cost Control (1.5 weeks)

**Dependencies**: Foundation complete

**Sprint Plan**:

**Week 1 (Day 1-5)**:
- [ ] Price variance detection algorithm refinement
- [ ] Alert threshold configuration (admin UI)
- [ ] Alert generation rules (integrate with RuleEngine)
- [ ] Dashboard UI: Price variance heatmap
- [ ] Dashboard UI: Top opportunities list
- [ ] Dashboard UI: Location leaderboard

**Week 2 (Day 1-2)**:
- [ ] Notification system integration (email alerts)
- [ ] Export reports (CSV, PDF)
- [ ] Testing and bug fixes
- [ ] Documentation

**Deliverable**: Cross-location cost control feature complete

---

### Feature 2: Inventory Intelligence (2 weeks)

**Dependencies**: Foundation complete

**Sprint Plan**:

**Week 1 (Day 1-5)**:
- [ ] Pattern detection refinement (seasonal detection)
- [ ] Stock-out prediction algorithm
- [ ] Reorder alert logic
- [ ] Dashboard UI: Inventory status overview
- [ ] Dashboard UI: Stock-out predictions list

**Week 2 (Day 1-5)**:
- [ ] Dashboard UI: Consumption rate charts
- [ ] Dashboard UI: Order cycle timeline
- [ ] Reorder notification system
- [ ] Testing and bug fixes
- [ ] Documentation

**Deliverable**: Inventory intelligence feature complete

---

### Feature 3: AI Smart Consultant (2.5 weeks)

**Dependencies**: Foundation complete

**Sprint Plan**:

**Week 1 (Day 1-5)**:
- [ ] Define business rules (cost optimization, vendor switch, etc.)
- [ ] Implement rule generators
- [ ] Recommendation prioritization algorithm
- [ ] Recommendation impact estimation
- [ ] Testing rule engine with real data

**Week 2 (Day 1-5)**:
- [ ] Dashboard UI: Recommendations feed
- [ ] Dashboard UI: Recommendation details modal
- [ ] Dashboard UI: Apply/dismiss actions
- [ ] Dashboard UI: Impact tracking

**Week 3 (Day 1-2)**:
- [ ] Admin UI: Rule configuration
- [ ] Feedback mechanism (track applied recommendations)
- [ ] Testing and bug fixes
- [ ] Documentation

**Deliverable**: AI Smart Consultant feature complete

---

## Parallel Execution Strategy

After Foundation is complete, features can be built **in parallel**:

```
Timeline:

Week 1-4:  Foundation (Team: 2-3 developers)
           └─> Single team focus, critical path

Week 5-6:  Feature 1 (Dev A) + Feature 2 (Dev B) + Feature 3 (Dev C)
           └─> Parallel development, no dependencies

Week 7:    Integration, bug fixes, QA (All devs)
           └─> Merge all features, final testing

Week 8:    Production deployment, monitoring
           └─> Deploy to production, observe metrics
```

**Total Duration**: 8 weeks (with parallelization)

**Comparison Without Foundation**:
- Each feature would need 3-4 weeks (implementing infrastructure independently)
- Total: 9-12 weeks (sequential) or 4-5 weeks (parallel but with duplication)
- Risk of inconsistent implementations

---

## Resource Requirements

### Infrastructure
- Redis instance (AWS ElastiCache recommended)
- Bull dashboard hosting (optional: separate service)
- Additional database storage (analytics tables)
- Monitoring tools (Grafana for job metrics)

### Development Team
- **Foundation Phase**: 2-3 senior developers (full-time, 4 weeks)
- **Feature Phase**: 3 developers (1 per feature, 2-2.5 weeks each)
- **QA**: 1 QA engineer (continuous, part-time)
- **DevOps**: 1 DevOps engineer (setup Redis, Bull dashboard, monitoring)

---

## Success Metrics

### Foundation Completion Metrics
- [ ] All background jobs running on schedule
- [ ] Job success rate > 99%
- [ ] SpendingMetric table populated with 7+ days of data
- [ ] PurchasePattern table has patterns for 80%+ items
- [ ] PriceSnapshot table updated daily
- [ ] Redis cache hit rate > 80% for analytics queries
- [ ] API response time < 200ms (95th percentile)

### Feature Completion Metrics

**Feature 1: Cross-Location Cost Control**
- [ ] Price variance detected for 100% of items with multi-location purchases
- [ ] Alerts generated for variances > 10%
- [ ] Dashboard loads in < 2 seconds

**Feature 2: Inventory Intelligence**
- [ ] Purchase patterns identified for 80%+ items
- [ ] Stock-out predictions made for high-value items
- [ ] Prediction accuracy > 70% (measured over 30 days)

**Feature 3: AI Smart Consultant**
- [ ] 10+ recommendation types implemented
- [ ] 20+ recommendations generated daily (initially)
- [ ] User engagement > 50% (viewed recommendations)
- [ ] 10%+ recommendations applied within 30 days

---

## Risk Mitigation

### Technical Risks

**Risk: Redis performance issues**
- Mitigation: Use AWS ElastiCache with appropriate instance size
- Fallback: Revert to node-cache temporarily (ICacheService abstraction enables this)

**Risk: Job failures undetected**
- Mitigation: Set up Bull dashboard, monitoring, PagerDuty alerts
- Fallback: Manual job execution via admin endpoint

**Risk: Analytics queries timeout**
- Mitigation: Aggressive caching, query optimization, database indexes
- Fallback: Limit date ranges, paginate results

**Risk: Pattern detection inaccurate**
- Mitigation: Start with simple rules, validate with sample data, iterate
- Fallback: Manual review, user feedback loop

**Risk: SpendingMetric duplicate aggregations (NEW)**
- Mitigation: Use `dimensionHash` unique column instead of composite key on nullable fields
- Fallback: Add database constraint check triggers

**Risk: Memory pressure on large datasets (NEW)**
- Mitigation: Implement cursor-based batching in AggregationService
- Fallback: Process in smaller date chunks

---

## Rollout Plan

### Phase 1: Foundation (Internal Testing)
- Deploy to staging
- Populate analytics tables with historical data
- Verify job execution
- Performance testing
- Internal demo to stakeholders

### Phase 2: Feature 1 (Limited Beta)
- Deploy Feature 1 to production
- Enable for 1-2 branches
- Collect feedback
- Iterate based on feedback
- Full rollout after 2 weeks

### Phase 3: Feature 2 (Limited Beta)
- Deploy Feature 2 to production
- Enable for specific items/branches
- Validate predictions
- Full rollout after validation

### Phase 4: Feature 3 (Gradual Rollout)
- Deploy Feature 3 to production
- Start with low-priority recommendations
- Monitor user engagement
- Add more rules gradually
- Full rollout after 4 weeks

---

## Maintenance Plan

### Ongoing Tasks
- Monitor job execution daily
- Review failed jobs weekly
- Optimize slow queries monthly
- Refine pattern detection algorithms quarterly
- Add new recommendation rules as needed
- Archive old analytics data (6 months+)

### Performance Tuning
- Add database indexes as needed
- Adjust cache TTLs based on usage
- Optimize job schedules based on load
- Scale Redis if cache hit rate drops

---

## Conclusion

This roadmap provides a clear path from foundation to business features:

1. **Foundation First** (3-4 weeks): Build shared infrastructure
2. **Parallel Features** (2-2.5 weeks): Implement business logic independently
3. **Integration & QA** (1 week): Merge and test
4. **Gradual Rollout** (4 weeks): Staged production deployment

**Total Time**: 8 weeks (foundation + features + rollout)

**Benefits**:
- No duplication of infrastructure work
- Clean separation of concerns
- Parallel development after foundation
- Testable, maintainable, scalable architecture

**Next Steps**:
1. ~~Approve roadmap~~ **DONE** - Architecture review approved with modifications
2. Review and understand architecture changes (this document)
3. Assign team to Foundation sprint
4. Set up infrastructure (Redis, Bull dashboard)
5. Begin Sprint 1 (Data, Domain Layer & Infrastructure)

---

## Appendix: Architecture Review Changes Checklist

Use this checklist to verify all architecture review requirements have been addressed:

- [ ] **Sprint 1 Changes**
  - [ ] Created `domain/analytics/` directory structure
  - [ ] Defined all service interfaces (ICacheService, IAggregationService, etc.)
  - [ ] Added `dimensionHash` column to SpendingMetric model
  - [ ] Created `errors/AnalyticsError.ts`
  - [ ] Created `schemas/analytics.schema.ts`
  - [ ] RedisService implements ICacheService
  - [ ] Created 3 separate Bull queues

- [ ] **Sprint 2 Changes**
  - [ ] AggregationService implements IAggregationService
  - [ ] All services accept dependencies via constructor
  - [ ] No singleton exports (use factory functions)
  - [ ] Transaction safety in aggregation operations
  - [ ] Statistical edge case guards (division by zero)
  - [ ] Cursor-based batching for large datasets

- [ ] **Sprint 3 Changes**
  - [ ] Jobs use job names (not just jobId)
  - [ ] Jobs assigned to correct queues
  - [ ] Job-specific timeouts configured

- [ ] **Sprint 4 Changes**
  - [ ] State change endpoints use PATCH
  - [ ] Zod validation on all endpoints
  - [ ] Health endpoint includes Redis/job queue status

---

**Document End**
