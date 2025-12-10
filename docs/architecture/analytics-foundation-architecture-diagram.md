# Analytics Foundation - Architecture Diagram

**Document Version**: 1.0
**Date**: 2025-12-10

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (React)                              │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │  Cross-Location  │  │    Inventory     │  │   AI Smart       │ │
│  │  Cost Control    │  │   Intelligence   │  │   Consultant     │ │
│  │  Dashboard       │  │   Dashboard      │  │   Dashboard      │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘ │
│           │                     │                      │            │
│           └─────────────────────┼──────────────────────┘            │
│                                 │                                   │
│                          Axios HTTP Client                          │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  │ HTTPS
                                  │
┌─────────────────────────────────▼───────────────────────────────────┐
│                       EXPRESS API SERVER                            │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     EXISTING LAYERS                         │   │
│  │  (Middleware, Auth, Routes, Services, PubSub)               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                  │                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │         ⭐ ANALYTICS & INTELLIGENCE FOUNDATION ⭐           │   │
│  │                    (NEW LAYER)                              │   │
│  │                                                             │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │              1. ANALYTICS SERVICES                  │   │   │
│  │  │  ┌─────────────────────────────────────────────┐    │   │   │
│  │  │  │  AggregationService                         │    │   │   │
│  │  │  │  - computeDailySpendingMetrics()            │    │   │   │
│  │  │  │  - computePriceBenchmarks()                 │    │   │   │
│  │  │  │  - refreshMaterializedViews()               │    │   │   │
│  │  │  └─────────────────────────────────────────────┘    │   │   │
│  │  │                                                      │   │   │
│  │  │  ┌─────────────────────────────────────────────┐    │   │   │
│  │  │  │  PatternRecognitionService                  │    │   │   │
│  │  │  │  - analyzePurchasePattern()                 │    │   │   │
│  │  │  │  - detectOrderCycle()                       │    │   │   │
│  │  │  │  - predictNextOrder()                       │    │   │   │
│  │  │  │  - detectAnomalies()                        │    │   │   │
│  │  │  └─────────────────────────────────────────────┘    │   │   │
│  │  │                                                      │   │   │
│  │  │  ┌─────────────────────────────────────────────┐    │   │   │
│  │  │  │  CrossLocationService                       │    │   │   │
│  │  │  │  - getPriceVariance()                       │    │   │   │
│  │  │  │  - getBenchmarkStats()                      │    │   │   │
│  │  │  │  - compareSpendingByBranch()                │    │   │   │
│  │  │  │  - findConsolidationOpportunities()         │    │   │   │
│  │  │  └─────────────────────────────────────────────┘    │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │   │
│  │                                                         │   │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │   │
│  │  │         2. RECOMMENDATION FRAMEWORK             │   │   │   │
│  │  │  ┌─────────────────────────────────────────┐    │   │   │   │
│  │  │  │  RuleEngine                             │    │   │   │   │
│  │  │  │  - registerRule()                       │    │   │   │   │
│  │  │  │  - evaluateRules()                      │    │   │   │   │
│  │  │  │  - evaluateRule()                       │    │   │   │   │
│  │  │  └─────────────────────────────────────────┘    │   │   │   │
│  │  │                                                  │   │   │   │
│  │  │  ┌─────────────────────────────────────────┐    │   │   │   │
│  │  │  │  RecommendationService                  │    │   │   │   │
│  │  │  │  - generateRecommendations()            │    │   │   │   │
│  │  │  │  - getPendingRecommendations()          │    │   │   │   │
│  │  │  │  - markViewed() / dismiss() / apply()   │    │   │   │   │
│  │  │  └─────────────────────────────────────────┘    │   │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │   │
│  │                                                         │   │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │   │
│  │  │         3. INFRASTRUCTURE LAYER                 │   │   │   │
│  │  │  ┌─────────────────────────────────────────┐    │   │   │   │
│  │  │  │  RedisService                           │    │   │   │   │
│  │  │  │  - Distributed caching                  │    │   │   │   │
│  │  │  │  - Pub/Sub messaging                    │    │   │   │   │
│  │  │  │  - Sets & Sorted Sets                   │    │   │   │   │
│  │  │  └─────────────────────────────────────────┘    │   │   │   │
│  │  │                                                  │   │   │   │
│  │  │  ┌─────────────────────────────────────────┐    │   │   │   │
│  │  │  │  JobQueueService (Bull)                 │    │   │   │   │
│  │  │  │  - createQueue()                        │    │   │   │   │
│  │  │  │  - addJob() / addRecurringJob()         │    │   │   │   │
│  │  │  │  - Job monitoring & retry               │    │   │   │   │
│  │  │  └─────────────────────────────────────────┘    │   │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │   │
│  │                                                         │   │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │   │
│  │  │         4. BACKGROUND JOBS                      │   │   │   │
│  │  │  ┌─────────────────────────────────────────┐    │   │   │   │
│  │  │  │  compute-spending-metrics (hourly)      │    │   │   │   │
│  │  │  │  compute-price-benchmarks (daily)       │    │   │   │   │
│  │  │  │  analyze-purchase-patterns (daily)      │    │   │   │   │
│  │  │  │  generate-recommendations (daily)       │    │   │   │   │
│  │  │  │  detect-anomalies (hourly)              │    │   │   │   │
│  │  │  │  cleanup-expired-recommendations (daily)│    │   │   │   │
│  │  │  └─────────────────────────────────────────┘    │   │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │   │
│  │                                                         │   │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │   │
│  │  │         5. API ENDPOINTS                        │   │   │   │
│  │  │  GET  /api/analytics/spending-metrics           │   │   │   │
│  │  │  GET  /api/analytics/price-variance             │   │   │   │
│  │  │  GET  /api/analytics/purchase-patterns          │   │   │   │
│  │  │  GET  /api/recommendations                      │   │   │   │
│  │  │  POST /api/recommendations/:id/view             │   │   │   │
│  │  │  POST /api/recommendations/:id/dismiss          │   │   │   │
│  │  │  POST /api/recommendations/:id/apply            │   │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │   │
│  └─────────────────────────────────────────────────────────┘   │   │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
                    ▼             ▼             ▼
          ┌──────────────┐ ┌────────────┐ ┌────────────┐
          │  PostgreSQL  │ │   Redis    │ │    Bull    │
          │  (Prisma)    │ │  (Cache)   │ │  Dashboard │
          │              │ │            │ │            │
          │  NEW TABLES: │ │  - Cache   │ │  - Monitor │
          │  - Spending  │ │  - PubSub  │ │  - Retry   │
          │    Metric    │ │  - Sets    │ │  - Logs    │
          │  - Purchase  │ └────────────┘ └────────────┘
          │    Pattern   │
          │  - Price     │
          │    Snapshot  │
          │  - Recommend │
          │    ation     │
          └──────────────┘
```

---

## Foundation Data Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXISTING MODELS                              │
│  (Invoice, InvoiceItem, Item, Vendor, Branch, etc.)            │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              │ References
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│               ⭐ NEW ANALYTICS MODELS ⭐                        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  SpendingMetric                                     │       │
│  │  ┌───────────────────────────────────────────────┐  │       │
│  │  │  id, date, itemId, vendorId, branchId,        │  │       │
│  │  │  departmentId, costCenterId                   │  │       │
│  │  │  totalAmount, invoiceCount, quantity,         │  │       │
│  │  │  avgUnitPrice, computedAt                     │  │       │
│  │  └───────────────────────────────────────────────┘  │       │
│  │  Purpose: Pre-aggregated spending for fast queries │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  PurchasePattern                                    │       │
│  │  ┌───────────────────────────────────────────────┐  │       │
│  │  │  id, itemId, branchId                         │  │       │
│  │  │  avgOrderCycleDays, avgOrderQuantity,         │  │       │
│  │  │  avgOrderAmount, stdDevQuantity,              │  │       │
│  │  │  stdDevAmount                                 │  │       │
│  │  │  isIncreasing, isDecreasing, isSeasonal,      │  │       │
│  │  │  seasonalityPattern, lastOrderDate,           │  │       │
│  │  │  nextPredictedOrder, confidenceScore,         │  │       │
│  │  │  basedOnInvoices, analysisStartDate,          │  │       │
│  │  │  analysisEndDate, lastUpdated                 │  │       │
│  │  └───────────────────────────────────────────────┘  │       │
│  │  Purpose: Learned patterns for inventory prediction│       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  PriceSnapshot                                      │       │
│  │  ┌───────────────────────────────────────────────┐  │       │
│  │  │  id, itemId, vendorId, branchId, price, date │  │       │
│  │  │  networkAvgPrice, networkMinPrice,            │  │       │
│  │  │  networkMaxPrice, varianceFromAvg             │  │       │
│  │  └───────────────────────────────────────────────┘  │       │
│  │  Purpose: Cross-location price comparison data     │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  Recommendation                                     │       │
│  │  ┌───────────────────────────────────────────────┐  │       │
│  │  │  id, type, category, title, description,      │  │       │
│  │  │  reasoning, estimatedSavings, confidenceScore,│  │       │
│  │  │  priority, context, status, createdBy,        │  │       │
│  │  │  viewedAt, viewedBy, dismissedAt, dismissedBy,│  │       │
│  │  │  dismissReason, appliedAt, appliedBy,         │  │       │
│  │  │  createdAt, expiresAt                         │  │       │
│  │  └───────────────────────────────────────────────┘  │       │
│  │  Purpose: AI-generated recommendations storage     │       │
│  └─────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Feature Dependencies on Foundation

```
┌────────────────────────────────────────────────────────────────┐
│           FEATURE 1: Cross-Location Cost Control               │
├────────────────────────────────────────────────────────────────┤
│  REQUIRES:                                                     │
│  ✓ PriceSnapshot table                                         │
│  ✓ SpendingMetric table                                        │
│  ✓ CrossLocationService (getPriceVariance, getBenchmarkStats)  │
│  ✓ AggregationService (computePriceBenchmarks)                 │
│  ✓ Background jobs (compute-price-benchmarks)                  │
│  ✓ Redis caching (fast cross-location queries)                 │
│                                                                │
│  ADDS (Business Logic):                                        │
│  + Price variance alert rules                                  │
│  + Alert threshold configuration                               │
│  + Dashboard UI components                                     │
│  + Location comparison charts                                  │
│  + Volume opportunity detection                                │
│  + Export/report generation                                    │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│           FEATURE 2: Inventory Intelligence                    │
├────────────────────────────────────────────────────────────────┤
│  REQUIRES:                                                     │
│  ✓ PurchasePattern table                                       │
│  ✓ SpendingMetric table                                        │
│  ✓ PatternRecognitionService (all methods)                     │
│  ✓ AggregationService (computeDailySpendingMetrics)            │
│  ✓ Background jobs (analyze-purchase-patterns, detect-anomalies)│
│  ✓ Redis caching (pattern lookups)                             │
│                                                                │
│  ADDS (Business Logic):                                        │
│  + Stock-out prediction algorithm                              │
│  + Reorder alert logic                                         │
│  + Dashboard UI components                                     │
│  + Consumption rate charts                                     │
│  + Order cycle timeline                                        │
│  + Notification system integration                             │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│           FEATURE 3: AI Smart Consultant                       │
├────────────────────────────────────────────────────────────────┤
│  REQUIRES:                                                     │
│  ✓ Recommendation table                                        │
│  ✓ ALL analytics tables (SpendingMetric, PurchasePattern, etc.)│
│  ✓ RuleEngine (framework)                                      │
│  ✓ RecommendationService (all methods)                         │
│  ✓ CrossLocationService (consolidation opportunities)          │
│  ✓ Background jobs (generate-recommendations, cleanup)         │
│  ✓ Redis caching (recommendation queries)                      │
│                                                                │
│  ADDS (Business Logic):                                        │
│  + Business rule definitions (10+ types)                       │
│  + Rule condition logic                                        │
│  + Recommendation generators                                   │
│  + Impact estimation algorithms                                │
│  + Dashboard UI components                                     │
│  + Admin rule configuration UI                                 │
│  + Feedback/tracking mechanism                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## Job Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                      JOB QUEUE (Bull)                           │
└─────────────────────────────┬───────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│ HOURLY JOBS   │     │  DAILY JOBS   │     │ MAINTENANCE   │
├───────────────┤     ├───────────────┤     ├───────────────┤
│ - Spending    │     │ - Price       │     │ - Cleanup     │
│   Metrics     │     │   Benchmarks  │     │   Expired     │
│   (aggregate) │     │   (compute)   │     │   Recom.      │
│               │     │               │     │               │
│ - Anomaly     │     │ - Purchase    │     │ - Archive     │
│   Detection   │     │   Patterns    │     │   Old Data    │
│   (compare)   │     │   (analyze)   │     │   (optional)  │
│               │     │               │     │               │
│               │     │ - Recom.      │     │               │
│               │     │   Generation  │     │               │
│               │     │   (evaluate)  │     │               │
└───────┬───────┘     └───────┬───────┘     └───────┬───────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RESULTS STORAGE                            │
│  - SpendingMetric records inserted                              │
│  - PriceSnapshot records inserted                               │
│  - PurchasePattern records upserted                             │
│  - Recommendation records created                               │
│  - Cache invalidation events published                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Event Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER ACTION (via API)                        │
│  - Create Invoice                                               │
│  - Approve Invoice                                              │
│  - Update Item Price                                            │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   EXISTING PUBSUB EVENTS                        │
│  - invoice.created                                              │
│  - invoice.approved                                             │
│  - item.priceChanged                                            │
└─────────────────────────────┬───────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│ EXISTING      │     │  ⭐ NEW       │     │  ⭐ NEW       │
│ SUBSCRIBERS   │     │ ANALYTICS     │     │ CACHE         │
│ - Accounting  │     │ SUBSCRIBERS   │     │ INVALIDATION  │
│ - Audit (TBD) │     │               │     │               │
└───────────────┘     │ - Trigger job │     │ - Invalidate  │
                      │   (metrics)   │     │   analytics:* │
                      │ - Update      │     │ - Invalidate  │
                      │   snapshots   │     │   patterns:*  │
                      └───────────────┘     └───────────────┘
```

---

## Caching Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                         REDIS CACHE                             │
├─────────────────────────────────────────────────────────────────┤
│  KEY PATTERN                  │  TTL    │  INVALIDATED ON       │
├───────────────────────────────┼─────────┼───────────────────────┤
│  analytics:spending-metrics:* │  5 min  │  invoice.approved     │
│  analytics:price-variance:*   │  10 min │  item.priceChanged    │
│  analytics:purchase-patterns:*│  1 hour │  invoice.created      │
│  recommendations:pending:*    │  5 min  │  recom.dismissed/applied│
│  benchmarks:item:*            │  1 day  │  compute-benchmarks   │
└─────────────────────────────────────────────────────────────────┘

CACHE FLOW:
┌─────────────┐
│ API Request │
└──────┬──────┘
       │
       ▼
┌─────────────┐     Hit    ┌─────────────┐
│ Check Cache ├────────────>│ Return Data │
└──────┬──────┘             └─────────────┘
       │ Miss
       ▼
┌─────────────┐
│ Query DB    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Store Cache │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Return Data │
└─────────────┘
```

---

## Scalability Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    LOAD BALANCER                                │
└─────────────────────────────┬───────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  API Server 1 │     │  API Server 2 │     │  API Server 3 │
│  (Stateless)  │     │  (Stateless)  │     │  (Stateless)  │
└───────┬───────┘     └───────┬───────┘     └───────┬───────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│ Redis Cluster │     │ PostgreSQL    │     │  Bull Queue   │
│ (Distributed) │     │ Primary +     │     │  Workers      │
│               │     │ Read Replica  │     │  (Scalable)   │
└───────────────┘     └───────────────┘     └───────────────┘

KEY POINTS:
- API servers are stateless (can scale horizontally)
- Redis cluster handles distributed caching/sessions
- PostgreSQL read replica for analytics queries (optional)
- Bull workers can scale independently
- Load balancer distributes traffic evenly
```

---

## Development Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                  FOUNDATION DEVELOPMENT                         │
│                     (Weeks 1-4)                                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  Sprint 1     │     │  Sprint 2     │     │  Sprint 3-4   │
│  Data &       │────>│  Core         │────>│  Jobs &       │
│  Infra        │     │  Services     │     │  API          │
└───────────────┘     └───────────────┘     └───────────────┘
                                                    │
                                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│              FOUNDATION COMPLETE & DEPLOYED                     │
└─────────────────────────────┬───────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  Feature 1    │     │  Feature 2    │     │  Feature 3    │
│  (Dev A)      │     │  (Dev B)      │     │  (Dev C)      │
│  1.5 weeks    │     │  2 weeks      │     │  2.5 weeks    │
└───────┬───────┘     └───────┬───────┘     └───────┬───────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│            INTEGRATION, QA, PRODUCTION DEPLOYMENT               │
│                         (Week 8)                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Monitoring Dashboard (Conceptual)

```
┌─────────────────────────────────────────────────────────────────┐
│                   ANALYTICS FOUNDATION DASHBOARD                │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ JOB QUEUE STATUS (Bull Dashboard)                      │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  Job Name                   │ Status  │ Last Run │ Next │   │
│  ├─────────────────────────────┼─────────┼──────────┼──────┤   │
│  │ compute-spending-metrics    │ ✓ OK    │ 10:00 AM │ 11:00│   │
│  │ compute-price-benchmarks    │ ✓ OK    │ 08:00 AM │ Tmrw │   │
│  │ analyze-purchase-patterns   │ ✓ OK    │ 08:15 AM │ Tmrw │   │
│  │ generate-recommendations    │ ✓ OK    │ 09:00 AM │ Tmrw │   │
│  │ detect-anomalies            │ ✓ OK    │ 10:15 AM │ 11:15│   │
│  └─────────────────────────────┴─────────┴──────────┴──────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ CACHE METRICS                                           │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  Hit Rate:  87%      │  Keys:  1,234   │  Memory: 45MB │   │
│  │  Hits:      12,345   │  Evictions: 23  │  Uptime: 7d   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ DATA FRESHNESS                                          │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  SpendingMetric:     Updated 15 min ago                 │   │
│  │  PriceSnapshot:      Updated 2 hours ago                │   │
│  │  PurchasePattern:    Updated 12 hours ago               │   │
│  │  Recommendation:     Updated 18 hours ago               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ API PERFORMANCE (95th percentile)                       │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  /analytics/spending-metrics:     145ms                 │   │
│  │  /analytics/price-variance:       178ms                 │   │
│  │  /analytics/purchase-patterns:    132ms                 │   │
│  │  /recommendations:                98ms                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Summary

This architecture diagram shows how the **Analytics & Intelligence Foundation** serves as a unified platform for three business features. Key highlights:

1. **Layered Architecture** - Foundation sits between existing services and new features
2. **Shared Services** - Analytics, Pattern, CrossLocation, Recommendation services
3. **Distributed Infrastructure** - Redis, Bull, scalable job processing
4. **Background Processing** - Automated metric computation
5. **Clean Separation** - Foundation is independent, features depend on it
6. **Scalable Design** - Horizontal scaling supported

**Result**: A robust, maintainable, and scalable analytics platform that enables rapid business feature development.

---

**Document End**
