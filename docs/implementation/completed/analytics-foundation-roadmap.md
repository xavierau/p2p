# Analytics Foundation - Implementation Roadmap

**Document Version**: 1.0
**Date**: 2025-12-10
**Status**: Ready for Implementation
**Estimated Total Effort**: 6-7 weeks (Foundation + 3 Features)

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

## Foundation Components Breakdown

### Component Tree

```
Analytics & Intelligence Foundation
├── 1. Data Layer
│   ├── SpendingMetric (table)
│   ├── PurchasePattern (table)
│   ├── PriceSnapshot (table)
│   └── Recommendation (table + enums)
│
├── 2. Infrastructure Layer
│   ├── RedisService (distributed cache)
│   ├── JobQueueService (Bull integration)
│   └── Distributed PubSub (event bus)
│
├── 3. Analytics Services
│   ├── AggregationService
│   │   ├── computeDailySpendingMetrics()
│   │   ├── computePriceBenchmarks()
│   │   └── refreshMaterializedViews()
│   │
│   ├── PatternRecognitionService
│   │   ├── analyzePurchasePattern()
│   │   ├── detectOrderCycle()
│   │   ├── predictNextOrder()
│   │   └── detectAnomalies()
│   │
│   └── CrossLocationService
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
├── 5. Background Jobs
│   ├── compute-spending-metrics (hourly)
│   ├── compute-price-benchmarks (daily)
│   ├── analyze-purchase-patterns (daily)
│   ├── generate-recommendations (daily)
│   ├── detect-anomalies (hourly)
│   └── cleanup-expired-recommendations (daily)
│
└── 6. API Layer
    ├── GET /api/analytics/spending-metrics
    ├── GET /api/analytics/price-variance
    ├── GET /api/analytics/purchase-patterns
    ├── GET /api/recommendations
    ├── POST /api/recommendations/:id/view
    ├── POST /api/recommendations/:id/dismiss
    └── POST /api/recommendations/:id/apply
```

---

## Sprint Breakdown (Foundation)

### Sprint 1: Data & Infrastructure (Week 1-2)

#### Day 1-2: Database Schema
- [ ] Define Prisma models (SpendingMetric, PurchasePattern, PriceSnapshot, Recommendation)
- [ ] Add indexes for performance
- [ ] Create migration
- [ ] Test migration on dev database
- [ ] Seed test data

**Deliverable**: Database schema deployed, seedable

---

#### Day 3-5: Redis Integration
- [ ] Install `ioredis` package
- [ ] Create `RedisService` class
- [ ] Implement cache methods (get, set, del, invalidateByPrefix)
- [ ] Implement pub/sub methods
- [ ] Implement set/sorted set methods
- [ ] Replace `node-cache` with `RedisService` in existing code
- [ ] Update cache invalidation subscribers
- [ ] Test distributed caching

**Deliverable**: Redis operational, existing analytics cached in Redis

---

#### Day 6-8: Job Queue Setup
- [ ] Install `bull` and `@types/bull`
- [ ] Create `JobQueueService` class
- [ ] Create job queue definitions (structure only)
- [ ] Create job processors (empty handlers)
- [ ] Set up Bull dashboard (monitoring)
- [ ] Configure cron schedules
- [ ] Test job scheduling

**Deliverable**: Job queue operational, jobs scheduled (empty)

---

#### Day 9-10: Integration & Testing
- [ ] Unit tests for RedisService
- [ ] Unit tests for JobQueueService
- [ ] Integration tests (Redis + jobs)
- [ ] Load testing (cache performance)
- [ ] Documentation (setup, configuration)

**Deliverable**: Sprint 1 complete, infrastructure tested

---

### Sprint 2: Core Services (Week 2-3)

#### Day 1-3: AggregationService
- [ ] Create `AggregationService` class
- [ ] Implement `computeDailySpendingMetrics()`
  - Query approved invoices for date
  - Group by dimensions (item, vendor, branch, dept)
  - Insert into SpendingMetric table
  - Handle duplicates (upsert logic)
- [ ] Implement `computePriceBenchmarks()`
  - Query item prices across branches
  - Calculate avg, min, max, std dev
  - Insert into PriceSnapshot table
- [ ] Unit tests with mocked Prisma
- [ ] Integration tests with test database

**Deliverable**: AggregationService functional, tested

---

#### Day 4-6: PatternRecognitionService
- [ ] Create `PatternRecognitionService` class
- [ ] Implement `detectOrderCycle()`
  - Calculate time between orders
  - Calculate average quantity
  - Compute standard deviations
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
- [ ] Unit tests with fixture data
- [ ] Integration tests

**Deliverable**: PatternRecognitionService functional, tested

---

#### Day 7-9: CrossLocationService
- [ ] Create `CrossLocationService` class
- [ ] Implement `getPriceVariance()`
  - Query PriceSnapshot for item
  - Compare across branches
  - Calculate variance percentages
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
- [ ] Implement CRUD methods (generateRecommendations stub)
- [ ] Implement user interaction methods (view, dismiss, apply)
- [ ] Create `RuleEngine` class
- [ ] Define Rule interface
- [ ] Implement `registerRule()` and `evaluateRules()` framework
- [ ] Unit tests

**Deliverable**: Recommendation framework structure ready

---

### Sprint 3: Background Jobs (Week 3-4)

#### Day 1-2: Spending Metrics Job
- [ ] Implement `compute-spending-metrics` job handler
- [ ] Call `AggregationService.computeDailySpendingMetrics()`
- [ ] Handle errors and retries
- [ ] Log progress and results
- [ ] Schedule hourly execution
- [ ] Test job execution
- [ ] Monitor job dashboard

**Deliverable**: Spending metrics computed automatically

---

#### Day 3-4: Price Benchmarks Job
- [ ] Implement `compute-price-benchmarks` job handler
- [ ] Call `AggregationService.computePriceBenchmarks()`
- [ ] Handle errors and retries
- [ ] Schedule daily execution
- [ ] Test job execution

**Deliverable**: Price benchmarks computed automatically

---

#### Day 5-6: Purchase Patterns Job
- [ ] Implement `analyze-purchase-patterns` job handler
- [ ] Iterate over all items (or per branch)
- [ ] Call `PatternRecognitionService.analyzePurchasePattern()`
- [ ] Store results in PurchasePattern table
- [ ] Handle errors and retries
- [ ] Schedule daily execution
- [ ] Test job execution

**Deliverable**: Purchase patterns analyzed automatically

---

#### Day 7-8: Recommendations Job (Skeleton)
- [ ] Implement `generate-recommendations` job handler
- [ ] Call `RuleEngine.evaluateRules()` (no rules yet)
- [ ] Store recommendations
- [ ] Handle errors and retries
- [ ] Schedule daily execution
- [ ] Test job execution

**Deliverable**: Recommendation generation pipeline ready

---

#### Day 9: Anomaly Detection Job
- [ ] Implement `detect-anomalies` job handler
- [ ] Fetch recent invoices
- [ ] Call `PatternRecognitionService.detectAnomalies()`
- [ ] Optionally create recommendations for anomalies
- [ ] Schedule hourly execution

**Deliverable**: Anomalies detected automatically

---

#### Day 10: Cleanup Job
- [ ] Implement `cleanup-expired-recommendations` job handler
- [ ] Call `RecommendationService.expireRecommendations()`
- [ ] Archive old data (optional)
- [ ] Schedule daily execution

**Deliverable**: Old recommendations cleaned up

---

### Sprint 4: API & Integration (Week 4)

#### Day 1-3: API Endpoints
- [ ] Create route `/api/analytics/spending-metrics`
- [ ] Create route `/api/analytics/price-variance`
- [ ] Create route `/api/analytics/purchase-patterns`
- [ ] Create route `/api/recommendations` (CRUD)
- [ ] Create route `/api/recommendations/:id/view` (POST)
- [ ] Create route `/api/recommendations/:id/dismiss` (POST)
- [ ] Create route `/api/recommendations/:id/apply` (POST)
- [ ] Add Zod validation schemas
- [ ] Add RBAC middleware (ANALYTICS_READ, RECOMMENDATION_READ)
- [ ] Unit tests for routes

**Deliverable**: API endpoints functional, documented

---

#### Day 4-5: Event Bus Integration
- [ ] Define new PubSub events
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
- Fallback: Revert to node-cache temporarily, plan upgrade path

**Risk: Job failures undetected**
- Mitigation: Set up Bull dashboard, monitoring, PagerDuty alerts
- Fallback: Manual job execution via admin endpoint

**Risk: Analytics queries timeout**
- Mitigation: Aggressive caching, query optimization, database indexes
- Fallback: Limit date ranges, paginate results

**Risk: Pattern detection inaccurate**
- Mitigation: Start with simple rules, validate with sample data, iterate
- Fallback: Manual review, user feedback loop

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
1. Approve roadmap
2. Assign team to Foundation sprint
3. Set up infrastructure (Redis, Bull dashboard)
4. Begin Sprint 1 (Data & Infrastructure)

---

**Document End**
