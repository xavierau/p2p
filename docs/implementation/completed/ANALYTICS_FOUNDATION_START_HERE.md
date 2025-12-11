# Analytics Foundation - START HERE

**Last Updated**: 2025-12-10
**Status**: Ready to Begin Implementation
**Architecture Review**: Approved with Modifications (2025-12-10)

---

## Quick Navigation

**New to this feature?** Follow this path:

1. **[Executive Summary](../../architecture/analytics-features-summary.md)** (15 min) - Business case and ROI
2. **[Architecture Diagram](../../architecture/analytics-foundation-architecture-diagram.md)** (10 min) - Visual overview
3. **[Implementation Checklist](analytics-foundation-implementation.md)** (Start here!) - Day-by-day tasks
4. **[Roadmap](analytics-foundation-roadmap.md)** (Reference) - Sprint breakdown

---

## Architecture Review Summary

> **Status**: Approved with Modifications
> **Review Date**: 2025-12-10

### Required Changes Before Implementation

| Issue | Severity | Resolution |
|-------|----------|------------|
| Follow existing DDD structure | High | Create `domain/analytics/` with entities, repositories, events |
| Singleton service anti-pattern | Medium | Use dependency injection via constructor |
| Missing Zod validation schemas | Medium | Add `schemas/analytics.schema.ts` |
| Bull job naming bug | High | Use job names properly (not just `jobId`) |
| SpendingMetric composite unique with NULLs | High | Use dimension hash column instead |
| No database transaction safety | Medium | Wrap aggregation operations in `$transaction` |
| Cache service migration path | Medium | Create `ICacheService` interface |

### Key Architectural Decisions

1. **Domain Layer**: Place analytics domain logic under `server/src/domain/analytics/` to align with existing DDD patterns (`domain/delivery/`, `domain/files/`)
2. **Dependency Injection**: Services must accept dependencies via constructor (no singletons)
3. **Cache Abstraction**: Create `ICacheService` interface to support both node-cache and Redis
4. **Separate Job Queues**: Use separate Bull queues for aggregation, pattern, and recommendation jobs

---

## What Are We Building?

The **Analytics & Intelligence Foundation** is a shared infrastructure layer that enables three advanced business features:

1. **Cross-Location Cost Control** - Price variance detection
2. **Inventory Intelligence** - Predictive stock management
3. **AI Smart Consultant** - Proactive optimization recommendations

**Why build foundation first?**
- Saves 2-5 weeks vs. building features independently
- Eliminates code duplication
- Enables parallel feature development
- Ensures architectural consistency

---

## Quick Start (5 Minutes)

```bash
# 1. Install dependencies
cd server
pnpm add ioredis bull @types/ioredis @types/bull

# 2. Start Redis
docker run -d --name redis-analytics -p 6379:6379 redis:alpine

# 3. Update .env
echo "REDIS_URL=redis://localhost:6379" >> .env
echo "ANALYTICS_ENABLED=true" >> .env
echo "ANALYTICS_JOBS_ENABLED=true" >> .env

# 4. Apply database migrations
npx prisma migrate dev --name add-analytics-foundation

# 5. Generate Prisma client
npx prisma generate

# 6. Start development
pnpm dev
```

**You're ready to start Phase 1!**

---

## Implementation Phases (4 Weeks)

### Week 1 (Days 1-5): Database, Domain Layer & Infrastructure
**Deliverable**: Redis operational, database schema deployed, domain interfaces defined

**Tasks**:
- [ ] Add 4 Prisma models (SpendingMetric, PurchasePattern, PriceSnapshot, Recommendation)
- [ ] **NEW**: Add `dimensionHash` column to SpendingMetric (replaces composite unique)
- [ ] **NEW**: Create domain layer structure (`domain/analytics/`)
- [ ] **NEW**: Define service interfaces (IAggregationService, ICacheService, etc.)
- [ ] **NEW**: Add Zod validation schemas (`schemas/analytics.schema.ts`)
- [ ] Implement RedisService (implements ICacheService)
- [ ] Implement JobQueueService
- [ ] Update PubSub events

**Files to Create**:
- `server/prisma/schema.prisma` (update)
- **NEW**: `server/src/domain/analytics/entities/SpendingMetric.ts`
- **NEW**: `server/src/domain/analytics/entities/PurchasePattern.ts`
- **NEW**: `server/src/domain/analytics/entities/Recommendation.ts`
- **NEW**: `server/src/domain/analytics/repositories/ISpendingMetricRepository.ts`
- **NEW**: `server/src/domain/analytics/repositories/IRecommendationRepository.ts`
- **NEW**: `server/src/domain/analytics/services/IAggregationService.ts`
- **NEW**: `server/src/domain/analytics/services/ICacheService.ts`
- **NEW**: `server/src/domain/analytics/events/AnalyticsEvents.ts`
- **NEW**: `server/src/schemas/analytics.schema.ts`
- `server/src/services/infrastructure/redisService.ts`
- `server/src/services/infrastructure/jobQueueService.ts`
- `server/src/config/analytics.ts`

**Verification**:
- ✅ `npx prisma studio` shows 4 new tables with correct indexes
- ✅ `redis-cli ping` returns PONG
- ✅ Domain interfaces compile without errors
- ✅ Tests pass: `npm run test -- infrastructure`

---

### Week 1-2 (Days 6-10): Analytics Services
**Deliverable**: All 4 analytics services functional with dependency injection

**Tasks**:
- [ ] Implement AggregationService (with DI, implements IAggregationService)
- [ ] Implement PatternRecognitionService (with DI)
- [ ] Implement CrossLocationService (with DI)
- [ ] Implement RecommendationService (skeleton, with DI)
- [ ] Implement RuleEngine (framework)
- [ ] **NEW**: Wrap database operations in transactions
- [ ] **NEW**: Add cursor-based batching for large datasets
- [ ] **NEW**: Add statistical edge case guards (division by zero, etc.)

**Files to Create**:
- `server/src/services/analytics/aggregationService.ts`
- `server/src/services/analytics/patternRecognitionService.ts`
- `server/src/services/analytics/crossLocationService.ts`
- `server/src/services/recommendations/recommendationService.ts`
- `server/src/services/recommendations/ruleEngine.ts`
- **NEW**: `server/src/errors/AnalyticsError.ts`

**Verification**:
- ✅ Tests pass: `npm run test -- analytics/services`
- ✅ All services have 80%+ test coverage
- ✅ No TypeScript errors
- ✅ **NEW**: Services accept dependencies via constructor (no singletons)

---

### Week 2-3 (Days 11-15): Background Jobs
**Deliverable**: 6 background jobs running on schedule across separate queues

**Tasks**:
- [ ] Implement 6 job handlers
- [ ] **NEW**: Set up 3 separate Bull queues (aggregation, pattern, recommendations)
- [ ] **NEW**: Use named jobs properly (job names, not just jobId)
- [ ] **NEW**: Configure job-specific timeouts (5 min for heavy jobs)
- [ ] Schedule recurring jobs
- [ ] Set up Bull Board dashboard

**Files to Create**:
- `server/src/jobs/analytics/computeSpendingMetricsJob.ts`
- `server/src/jobs/analytics/computePriceBenchmarksJob.ts`
- `server/src/jobs/analytics/analyzePurchasePatternsJob.ts`
- `server/src/jobs/analytics/generateRecommendationsJob.ts`
- `server/src/jobs/analytics/detectAnomaliesJob.ts`
- `server/src/jobs/analytics/cleanupExpiredRecommendationsJob.ts`
- `server/src/jobs/analytics/index.ts`

**Verification**:
- ✅ Bull Board accessible at `/admin/queues`
- ✅ Jobs scheduled and executing on correct queues
- ✅ Data populating in analytics tables
- ✅ Logs show job progress
- ✅ **NEW**: Job names visible in Bull Board (not just jobId)

---

### Week 3-4 (Days 16-20): API Endpoints
**Deliverable**: REST API complete and documented with Zod validation

**Tasks**:
- [ ] Create analytics foundation routes
- [ ] Create recommendations routes
- [ ] **NEW**: Use PATCH for state changes (view, dismiss, apply) per REST conventions
- [ ] **NEW**: Validate all inputs with Zod schemas
- [ ] Add permissions
- [ ] **NEW**: Extend health check endpoint for Redis/job queue status
- [ ] Write API tests
- [ ] Document endpoints

**Files to Create**:
- `server/src/routes/analytics/foundation.ts`
- `server/src/routes/recommendations.ts`
- `server/src/tests/api/analytics-foundation.test.ts`
- `server/src/tests/api/recommendations.test.ts`

**Verification**:
- ✅ All API tests pass
- ✅ Postman collection created
- ✅ Permissions enforced correctly
- ✅ API documentation complete
- ✅ **NEW**: Health endpoint includes Redis and job queue status

---

## File Structure Overview

After implementation, your directory structure will look like this:

```
server/
├── prisma/
│   ├── schema.prisma (updated with 4 new models)
│   └── seed-analytics.ts (new)
│
├── src/
│   ├── config/
│   │   └── analytics.ts (new)
│   │
│   ├── domain/                              # NEW: DDD Domain Layer
│   │   └── analytics/
│   │       ├── entities/
│   │       │   ├── SpendingMetric.ts (new)
│   │       │   ├── PurchasePattern.ts (new)
│   │       │   ├── PriceSnapshot.ts (new)
│   │       │   └── Recommendation.ts (new)
│   │       ├── value-objects/
│   │       │   ├── RecommendationType.ts (new)
│   │       │   ├── RecommendationStatus.ts (new)
│   │       │   └── ConfidenceScore.ts (new)
│   │       ├── repositories/
│   │       │   ├── ISpendingMetricRepository.ts (new)
│   │       │   └── IRecommendationRepository.ts (new)
│   │       ├── services/
│   │       │   ├── IAggregationService.ts (new)
│   │       │   ├── IPatternRecognitionService.ts (new)
│   │       │   ├── ICrossLocationService.ts (new)
│   │       │   └── ICacheService.ts (new)
│   │       └── events/
│   │           ├── SpendingMetricsComputedEvent.ts (new)
│   │           └── RecommendationGeneratedEvent.ts (new)
│   │
│   ├── schemas/
│   │   └── analytics.schema.ts (new)         # NEW: Zod validation
│   │
│   ├── errors/
│   │   └── AnalyticsError.ts (new)           # NEW: Error handling
│   │
│   ├── services/
│   │   ├── infrastructure/
│   │   │   ├── redisService.ts (new)         # Implements ICacheService
│   │   │   └── jobQueueService.ts (new)
│   │   │
│   │   ├── analytics/
│   │   │   ├── aggregationService.ts (new)   # Implements IAggregationService
│   │   │   ├── patternRecognitionService.ts (new)
│   │   │   └── crossLocationService.ts (new)
│   │   │
│   │   └── recommendations/
│   │       ├── ruleEngine.ts (new)
│   │       └── recommendationService.ts (new)
│   │
│   ├── jobs/
│   │   └── analytics/
│   │       ├── computeSpendingMetricsJob.ts (new)
│   │       ├── computePriceBenchmarksJob.ts (new)
│   │       ├── analyzePurchasePatternsJob.ts (new)
│   │       ├── generateRecommendationsJob.ts (new)
│   │       ├── detectAnomaliesJob.ts (new)
│   │       ├── cleanupExpiredRecommendationsJob.ts (new)
│   │       └── index.ts (new)
│   │
│   ├── routes/
│   │   ├── analytics/
│   │   │   └── foundation.ts (new)
│   │   ├── recommendations.ts (new)
│   │   └── admin/
│   │       └── jobs.ts (new)
│   │
│   └── tests/
│       ├── services/
│       │   └── analytics/ (new tests)
│       └── api/
│           └── analytics-foundation.test.ts (new)
```

**Total New Files**: ~35 files (increased due to DDD structure)
**Total Lines of Code**: ~4000-5000 lines

---

## Key Dependencies

### New npm Packages
```json
{
  "dependencies": {
    "ioredis": "^5.x",
    "bull": "^4.x"
  },
  "devDependencies": {
    "@types/ioredis": "^5.x",
    "@types/bull": "^4.x"
  }
}
```

### Infrastructure Requirements
- **Redis**: Docker container or managed service (AWS ElastiCache)
- **PostgreSQL**: Existing (new tables will be added)
- **Node.js**: 18+ (existing)

---

## Environment Variables

Add these to your `.env` file:

```bash
# Redis
REDIS_URL=redis://localhost:6379

# Analytics
ANALYTICS_ENABLED=true
ANALYTICS_JOBS_ENABLED=true

# Optional: Custom job schedules (cron format)
# SCHEDULE_SPENDING_METRICS=0 * * * *
# SCHEDULE_PRICE_BENCHMARKS=0 2 * * *
# SCHEDULE_PURCHASE_PATTERNS=0 3 * * *
# SCHEDULE_RECOMMENDATIONS=0 4 * * *
# SCHEDULE_ANOMALIES=0 */6 * * *
# SCHEDULE_CLEANUP=0 1 * * *
```

---

## Testing Strategy

### Unit Tests (Week 1-2)
- Services isolated with mocked dependencies
- Focus on business logic correctness
- Target: 80%+ coverage

### Integration Tests (Week 2-3)
- Jobs execute with test database
- End-to-end job pipeline
- Data integrity validation

### API Tests (Week 3-4)
- REST endpoints
- Authentication/authorization
- Input validation
- Response format

**Run All Tests**:
```bash
npm run test -- analytics
npm run test:coverage
```

---

## Common Issues & Solutions

### Issue: Redis connection fails
**Solution**: Ensure Docker container running
```bash
docker ps | grep redis-analytics
docker start redis-analytics
```

### Issue: Jobs not executing
**Solution**: Check `ANALYTICS_JOBS_ENABLED=true` in `.env`

### Issue: Prisma client outdated
**Solution**: Regenerate after schema changes
```bash
npx prisma generate
```

### Issue: Performance slow
**Solution**: Check indexes created
```bash
npx prisma studio
# Verify indexes in database
```

---

## Daily Checklist

Start each day with:

- [ ] Pull latest from main branch
- [ ] Check Redis running: `docker ps`
- [ ] Check database up: `npx prisma studio`
- [ ] Run existing tests: `npm run test`
- [ ] Review today's tasks in [Implementation Checklist](analytics-foundation-implementation.md)

End each day with:

- [ ] Run tests for new code
- [ ] Commit with descriptive message
- [ ] Update checklist (check off completed tasks)
- [ ] Document any blockers or questions

---

## Communication

### Daily Standup Questions
1. What phase/task did I complete yesterday?
2. What phase/task am I working on today?
3. Any blockers or questions?

### Definition of Done (each task)
- [ ] Code written and reviewed
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] No console errors or warnings
- [ ] Committed with descriptive message

### Commit Message Format
```
feat(analytics): add aggregation service

- Implemented computeDailySpendingMetrics
- Added tests with 85% coverage
- Documented service interface
```

---

## Resources

### Documentation
- [Executive Summary](../../architecture/analytics-features-summary.md) - Business case
- [Technical Analysis](../../architecture/2025-12-10-analytics-infrastructure-foundation.md) - Deep dive
- [Architecture Diagram](../../architecture/analytics-foundation-architecture-diagram.md) - Visual reference
- [Implementation Checklist](analytics-foundation-implementation.md) - Day-by-day tasks (USE THIS)
- [Roadmap](analytics-foundation-roadmap.md) - Sprint breakdown

### External Resources
- [Prisma Docs](https://www.prisma.io/docs)
- [Redis Docs](https://redis.io/docs)
- [Bull Docs](https://github.com/OptimalBits/bull)
- [ioredis Docs](https://github.com/redis/ioredis)

---

## Success Criteria

Foundation is complete when:

1. ✅ All Prisma models deployed
2. ✅ Redis operational (cache hit rate > 80%)
3. ✅ Job queue running reliably (success rate > 99%)
4. ✅ All 4 analytics services functional
5. ✅ All 6 background jobs scheduled and executing
6. ✅ API endpoints functional and tested
7. ✅ Test coverage >80%
8. ✅ Metrics data populated (7+ days)
9. ✅ Documentation complete
10. ✅ Bull Board accessible

**When these are done, features can be built independently!**

---

## What Happens After Foundation?

Once foundation is complete (Week 4), three feature teams can work **in parallel**:

### Feature 1: Cross-Location Cost Control (1.5 weeks)
**Developer A** implements:
- Price variance detection UI
- Alert configuration
- Dashboard components
- Uses: PriceSnapshot table, CrossLocationService

### Feature 2: Inventory Intelligence (2 weeks)
**Developer B** implements:
- Pattern detection UI
- Stock-out prediction
- Reorder alerts
- Uses: PurchasePattern table, PatternRecognitionService

### Feature 3: AI Smart Consultant (2.5 weeks)
**Developer C** implements:
- Business rule definitions
- Recommendation generators
- Admin configuration UI
- Uses: Recommendation table, RuleEngine, RecommendationService

**Total Time**: Week 5-7 (parallel development)

---

## Getting Help

**Have questions?**
- Review [Technical Analysis](../../architecture/2025-12-10-analytics-infrastructure-foundation.md)
- Check [Architecture Diagram](../../architecture/analytics-foundation-architecture-diagram.md)
- Review [Implementation Checklist](analytics-foundation-implementation.md)
- Ask in team standup
- Create issue in repository

**Found a bug or blocker?**
- Document in issue tracker
- Add to daily standup notes
- Adjust timeline if needed

---

## Let's Build!

**Ready to start?**

Open **[Implementation Checklist](analytics-foundation-implementation.md)** and begin with Phase 1, Task 1.1.

**Remember**:
- Take it one task at a time
- Test frequently
- Commit often
- Ask questions early
- **NEW**: Follow DDD patterns - interfaces before implementations
- **NEW**: Use dependency injection - no singletons

---

**Document End**
