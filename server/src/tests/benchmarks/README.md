# Invoice Validation Performance Benchmarks

Comprehensive performance testing suite for the invoice validation feature.

## Overview

This directory contains automated benchmarks to verify that the invoice validation system meets production performance requirements:

- ✅ **Load Time:** <500ms for 100 invoices (P95)
- ✅ **Validation Speed:** <200ms per invoice (P95)
- ✅ **Query Efficiency:** <10 database queries
- ✅ **Consistency:** 100% deterministic results

## Quick Start

```bash
# Run all benchmarks
pnpm run benchmark

# Generate full performance report
pnpm run benchmark:report

# Query efficiency analysis
npx ts-node src/tests/benchmarks/measure-queries.ts
```

## Files

### `validation-performance.benchmark.ts`
Main benchmark suite with automated test data setup and cleanup.

**Benchmarks:**
1. Load 100 flagged invoices with pagination
2. Load with severity filter
3. Validate single invoice
4. Validation consistency check

**Features:**
- Automatic test data creation (100 invoices with validations)
- Performance metrics: avg, min, max, P95
- Pass/fail status against targets
- Automatic cleanup

**Output:**
```
📊 Benchmark Results:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Load 100 Flagged Invoices    6.93ms   <500ms   ✅ PASS
Validate Single Invoice       4.87ms   <200ms   ✅ PASS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Overall: ALL BENCHMARKS PASSED
```

### `generate-report.ts`
Generates comprehensive markdown performance report.

**Sections:**
- Executive summary with key metrics
- Detailed benchmark results
- Query analysis and N+1 prevention
- Validation consistency
- Recommendations for optimization

**Output:** `docs/performance/validation-benchmark-report.md`

### `measure-queries.ts`
Query efficiency analysis and N+1 prevention verification.

**Analysis:**
- Query count (3 queries total)
- N+1 prevention strategies
- Performance characteristics (O(1) regardless of dataset size)

### `query-counter.ts`
Utility for counting and analyzing Prisma queries.

**Features:**
- Query logging with timing
- Query count tracking
- Detailed query breakdown
- Summary statistics

### `test-query-count.ts`
Standalone test for query count verification.

## Benchmark Results

### Current Performance (as of 2025-12-11)

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| 100 Invoice Load (P95) | <500ms | ~10ms | ✅ PASS (98% better) |
| Single Validation (P95) | <200ms | ~5ms | ✅ PASS (97.5% better) |
| Query Count | <10 | 3 | ✅ PASS (70% under) |
| Consistency | 100% | 100% | ✅ PASS |

**Summary:** All performance targets exceeded. System is production-ready.

## Performance Optimizations Implemented

### 1. N+1 Query Prevention

**Problem:** Original implementation would execute N+1 queries for N invoices.

**Solution:**
```typescript
// ❌ BAD: N+1 queries
for (const invoice of invoices) {
  invoice.items = await prisma.invoiceItem.findMany({
    where: { invoiceId: invoice.id }
  });
}

// ✅ GOOD: Single batch query
const invoiceIds = invoices.map(i => i.id);
const allItems = await prisma.invoiceItem.findMany({
  where: { invoiceId: { in: invoiceIds } }
});
```

**Result:** Reduced from N+2 queries to exactly 3 queries.

### 2. SELECT Optimization

**Problem:** Deep `include` relationships fetch unnecessary data.

**Solution:**
```typescript
// ✅ Use select to fetch only needed fields
select: {
  id: true,
  invoiceNumber: true,
  totalAmount: true,
  // ... only necessary fields
}
```

**Result:** Reduced data transfer and query execution time.

### 3. Transaction Batching

**Problem:** Multiple sequential queries increase latency.

**Solution:**
```typescript
const [validations, total] = await prisma.$transaction([
  prisma.invoiceValidation.findMany({ ... }),
  prisma.invoiceValidation.count({ ... })
]);
```

**Result:** Parallel execution, reduced round trips.

## Query Count Breakdown

### getFlaggedInvoices(limit: 100)

```
Query 1: prisma.invoiceValidation.findMany()
  Purpose: Fetch validation records with invoice data
  Optimization: Uses SELECT instead of include

Query 2: prisma.invoiceValidation.count()
  Purpose: Get total count for pagination
  Optimization: Executed in same transaction

Query 3: prisma.invoiceItem.findMany()
  Purpose: Batch fetch all invoice items
  Optimization: Single WHERE IN query

Total: 3 queries (constant regardless of dataset size)
```

## Cache Strategy

### Current Implementation

```typescript
// Instance-scoped cache (per validateInvoice call)
const ruleCache = new ValidationRuleCache(ruleRepository);
```

**Characteristics:**
- ✅ Ensures fresh validation on each call
- ✅ Simple implementation
- ✅ No cache invalidation complexity
- ⚠️  Creates new cache per validation

### Production Consideration

For high-throughput scenarios, consider application-level singleton cache:

```typescript
// Singleton cache (shared across all validations)
const globalRuleCache = ValidationRuleCache.getInstance();
```

**Trade-offs:**
- ✅ Better performance (reduced DB queries)
- ✅ Shared cache across all validations
- ⚠️  Requires cache invalidation on rule updates
- ⚠️  Potential stale data if TTL too long

## Running in CI/CD

Add to your CI pipeline:

```yaml
# .github/workflows/performance.yml
- name: Performance Benchmarks
  run: |
    cd server
    pnpm run benchmark
    pnpm run benchmark:report
```

**Exit codes:**
- `0`: All benchmarks passed
- `1`: One or more benchmarks failed

## Monitoring in Production

Recommended metrics to track:

```typescript
// Performance monitoring
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.includes('/validation')) {
      metrics.histogram('validation.latency', duration);
    }
  });
  next();
});
```

**Alert thresholds:**
- P95 latency > 500ms
- Error rate > 1%
- Query count > 10 per request

## Troubleshooting

### Benchmark Fails

1. **Check database connection**
   ```bash
   npx prisma db push
   ```

2. **Verify test data cleanup**
   - Benchmarks auto-cleanup, but check for orphaned records:
   ```sql
   SELECT * FROM Invoice WHERE invoiceNumber LIKE 'BENCH-%';
   ```

3. **Database performance**
   - Ensure indexes are present
   - Run `ANALYZE` on tables

### Slow Performance

1. **Check query execution plans**
   ```sql
   EXPLAIN ANALYZE SELECT * FROM InvoiceValidation ...
   ```

2. **Verify indexes**
   ```sql
   SHOW INDEXES FROM InvoiceValidation;
   ```

3. **Database resources**
   - Check connection pool size
   - Monitor database CPU/memory

## Future Enhancements

- [ ] Load testing with concurrent requests
- [ ] Stress testing with 10,000+ invoices
- [ ] Memory profiling
- [ ] Database connection pool optimization
- [ ] Cache hit rate monitoring
- [ ] Performance regression tests in CI

## References

- Production Readiness Plan: `docs/implementation/current/invoice-validation-checklist.md`
- Implementation Guide: `docs/implementation/current/invoice-validation-index.md`
- Service Code: `src/services/invoiceValidationService.ts`
- Performance Report: `docs/performance/validation-benchmark-report.md`
