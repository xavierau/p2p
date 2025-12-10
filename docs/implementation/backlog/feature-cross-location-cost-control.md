# Feature 1: Cross-Location Cost Control - Implementation Plan

**Document Version**: 1.0
**Date**: 2025-12-10
**Status**: Ready for Implementation
**Estimated Effort**: 11 days (1 developer)

---

## Table of Contents

1. [Feature Overview](#feature-overview)
2. [Dependencies](#dependencies)
3. [Domain Model](#domain-model)
4. [Service Layer](#service-layer)
5. [API Endpoints](#api-endpoints)
6. [Frontend Components](#frontend-components)
7. [Implementation Phases](#implementation-phases)
8. [Testing Strategy](#testing-strategy)
9. [Acceptance Criteria](#acceptance-criteria)
10. [Implementation Checklist](#implementation-checklist)

---

## Feature Overview

### Business Value

Cross-Location Cost Control enables SME procurement managers to:

1. **Identify price discrepancies** across branches for the same items from the same vendors
2. **Detect overpaying locations** by comparing to network averages
3. **Find consolidation opportunities** where volume buying could reduce costs
4. **Track cost trends** over time to measure negotiation effectiveness
5. **Leaderboard visibility** to encourage cost-conscious purchasing

**ROI Example**: If Location A pays $4.50/lb for chicken while Location B pays $3.20/lb, and Location A orders 1000 lbs/month, switching vendors could save $1,300/month ($15,600/year).

### User Personas

| Persona | Use Case | Key Features |
|---------|----------|--------------|
| **CFO/Owner** | Strategic cost oversight | Network benchmarks, top savings opportunities, trend analysis |
| **Procurement Manager** | Tactical vendor negotiation | Price variance alerts, vendor consistency checks, consolidation opportunities |
| **Branch Manager** | Location performance tracking | Branch vs network comparison, location leaderboard |
| **Finance Analyst** | Cost reporting | Historical trends, variance reports, export capabilities |

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Cost savings identified | $50K+ in first quarter | Sum of opportunity amounts |
| Price variance reduction | 15% decrease in 90 days | Avg variance before/after |
| User engagement | 80% weekly active users (managers) | Dashboard visits |
| Decision speed | 50% faster vendor decisions | Time from alert to action |

---

## Dependencies

### Foundation Infrastructure (MUST BE DEPLOYED FIRST)

This feature depends on the **Analytics & Intelligence Foundation** being fully operational:

**Required Models** (from Prisma schema):
- `SpendingMetric` - Pre-aggregated spending by dimensions
- `PriceSnapshot` - Cross-location price comparison data

**Required Services** (from foundation):
- `AggregationService` - Computes daily spending metrics
- `CrossLocationService` - Price variance, benchmarks, consolidation opportunities
- `RedisService` - Distributed caching
- `JobQueueService` - Background job processing

**Required Background Jobs**:
- `compute-spending-metrics` (hourly) - Populates SpendingMetric table
- `compute-price-benchmarks` (daily) - Populates PriceSnapshot table with network stats

**Verification**:
```bash
# Confirm foundation is deployed
npx prisma db pull | grep -E "SpendingMetric|PriceSnapshot"

# Confirm services exist
ls server/src/services/analytics/aggregationService.ts
ls server/src/services/analytics/crossLocationService.ts

# Confirm jobs are scheduled
# Check Bull dashboard or job queue logs
```

### Existing Models Used

| Model | Usage |
|-------|-------|
| `Invoice` | Historical purchase data, status, branch/department |
| `InvoiceItem` | Item-level prices and quantities |
| `Item` | Item details, current price |
| `Vendor` | Vendor information |
| `Branch` | Location details |
| `Department` | Department spending context |

### External Dependencies

None. This feature is purely internal analytics.

---

## Domain Model

### Existing Foundation Models

**SpendingMetric** (already exists from foundation):
```prisma
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
```

**PriceSnapshot** (already exists from foundation):
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
}
```

### Value Objects

**PriceVariance** (TypeScript type):
```typescript
export interface PriceVariance {
  itemId: number;
  itemName: string;
  vendorId: number;
  vendorName: string;

  // Branch-level prices
  branches: {
    branchId: number;
    branchName: string;
    currentPrice: number;
    lastPurchaseDate: Date;
    monthlyVolume: number; // units
  }[];

  // Network statistics
  networkAvgPrice: number;
  networkMinPrice: number;
  networkMaxPrice: number;

  // Variance metrics
  maxVariance: number;        // $ amount
  maxVariancePercent: number; // %
  highestPayingBranch: string;
  lowestPayingBranch: string;

  // Opportunity
  potentialSavings: number;   // If all branches paid lowest price
}
```

**ConsolidationOpportunity** (TypeScript type):
```typescript
export interface ConsolidationOpportunity {
  itemId: number;
  itemName: string;
  vendorId: number;
  vendorName: string;

  // Current state
  branchCount: number;
  currentNetworkSpend: number;
  avgPricePerBranch: number;

  // Consolidation scenario
  lowestPrice: number;
  potentialSavings: number;
  savingsPercent: number;

  // Action items
  branchesToConsolidate: {
    branchId: number;
    branchName: string;
    currentPrice: number;
    monthlySavings: number;
  }[];
}
```

**BenchmarkResult** (TypeScript type):
```typescript
export interface BenchmarkResult {
  branchId: number;
  branchName: string;

  // Performance metrics
  totalSpending: number;
  avgPriceVsNetwork: number; // % above/below network avg
  itemsAboveAvg: number;
  itemsBelowAvg: number;

  // Ranking
  rank: number;
  totalBranches: number;

  // Opportunity
  potentialSavings: number; // If all items at network avg
}
```

### Business Rules

| Rule | Description | Enforcement |
|------|-------------|-------------|
| **Minimum variance threshold** | Only flag variances > 10% or $5 | Service layer filtering |
| **Approved invoices only** | Only analyze approved invoices | Query WHERE clause |
| **Recent data priority** | Weight last 30 days highest | Date-based scoring |
| **Minimum volume threshold** | Only analyze items with 3+ purchases in period | Aggregation filter |
| **Soft-deleted exclusions** | Ignore deleted vendors/items | Query WHERE deletedAt IS NULL |

---

## Service Layer

### CostControlService

**Location**: `server/src/services/analytics/costControlService.ts`

**Purpose**: Business logic for cross-location cost analysis

**Dependencies**:
- `CrossLocationService` (from foundation)
- `AggregationService` (from foundation)
- `RedisService` (for caching)
- Prisma client

**Interface**:

```typescript
export interface ICostControlService {
  /**
   * Get price variances across all branches
   * @param options Filter and pagination options
   * @returns Array of price variances with opportunity amounts
   */
  getPriceVariances(options: PriceVarianceOptions): Promise<PaginatedResult<PriceVariance>>;

  /**
   * Get network benchmark for all branches
   * @param period Time period for analysis
   * @returns Benchmark results with rankings
   */
  getNetworkBenchmark(period: TimePeriod): Promise<BenchmarkResult[]>;

  /**
   * Find consolidation opportunities
   * @param minSavings Minimum savings threshold (default: $100/month)
   * @returns Array of consolidation opportunities sorted by savings
   */
  getConsolidationOpportunities(minSavings?: number): Promise<ConsolidationOpportunity[]>;

  /**
   * Get cost trend for a specific branch or network
   * @param branchId Branch ID (null for network-wide)
   * @param period Time period
   * @returns Time-series cost data
   */
  getCostTrend(branchId: number | null, period: TimePeriod): Promise<TrendData>;

  /**
   * Get top cost-saving opportunities across all analysis types
   * @param limit Number of results (default: 10)
   * @returns Mixed array of opportunities sorted by potential savings
   */
  getTopOpportunities(limit?: number): Promise<Opportunity[]>;
}
```

**Implementation Details**:

```typescript
// server/src/services/analytics/costControlService.ts
import { CrossLocationService } from './crossLocationService';
import { RedisService } from '../redisService';
import prisma from '../../prisma';

export class CostControlService implements ICostControlService {
  constructor(
    private crossLocationService: CrossLocationService,
    private redisService: RedisService
  ) {}

  async getPriceVariances(options: PriceVarianceOptions): Promise<PaginatedResult<PriceVariance>> {
    const cacheKey = `cost-control:variances:${JSON.stringify(options)}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Get raw price variance data from CrossLocationService
    const rawVariances = await this.crossLocationService.getPriceVariance(
      options.itemId,
      options.vendorId
    );

    // Filter by minimum variance threshold (10% or $5)
    const significantVariances = rawVariances.filter(v =>
      v.maxVariancePercent >= 10 || v.maxVariance >= 5
    );

    // Calculate potential savings
    const enrichedVariances = significantVariances.map(v => ({
      ...v,
      potentialSavings: this.calculatePotentialSavings(v),
    }));

    // Sort by potential savings (highest first)
    enrichedVariances.sort((a, b) => b.potentialSavings - a.potentialSavings);

    // Apply pagination
    const total = enrichedVariances.length;
    const start = (options.page - 1) * options.limit;
    const data = enrichedVariances.slice(start, start + options.limit);

    const result = {
      data,
      pagination: {
        total,
        page: options.page,
        limit: options.limit,
        totalPages: Math.ceil(total / options.limit),
      },
    };

    // Cache for 5 minutes
    await this.redisService.set(cacheKey, JSON.stringify(result), 300);

    return result;
  }

  async getNetworkBenchmark(period: TimePeriod): Promise<BenchmarkResult[]> {
    const cacheKey = `cost-control:benchmark:${period.start}:${period.end}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Get all branches
    const branches = await prisma.branch.findMany({
      select: { id: true, name: true },
    });

    // Get network average price for all items
    const networkStats = await this.crossLocationService.getBenchmarkStats(null);

    // Calculate each branch's performance
    const benchmarks = await Promise.all(
      branches.map(async (branch) => {
        const branchStats = await this.getBranchStats(branch.id, period);

        return {
          branchId: branch.id,
          branchName: branch.name,
          totalSpending: branchStats.totalSpending,
          avgPriceVsNetwork: branchStats.avgPriceVsNetwork,
          itemsAboveAvg: branchStats.itemsAboveAvg,
          itemsBelowAvg: branchStats.itemsBelowAvg,
          rank: 0, // Set below
          totalBranches: branches.length,
          potentialSavings: branchStats.potentialSavings,
        };
      })
    );

    // Rank by avgPriceVsNetwork (lower is better)
    benchmarks.sort((a, b) => a.avgPriceVsNetwork - b.avgPriceVsNetwork);
    benchmarks.forEach((b, i) => { b.rank = i + 1; });

    // Cache for 1 hour
    await this.redisService.set(cacheKey, JSON.stringify(benchmarks), 3600);

    return benchmarks;
  }

  async getConsolidationOpportunities(minSavings = 100): Promise<ConsolidationOpportunity[]> {
    const cacheKey = `cost-control:consolidation:${minSavings}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const opportunities = await this.crossLocationService.findConsolidationOpportunities();

    // Filter by minimum savings threshold
    const filtered = opportunities.filter(o => o.potentialSavings >= minSavings);

    // Sort by savings (highest first)
    filtered.sort((a, b) => b.potentialSavings - a.potentialSavings);

    // Cache for 1 hour
    await this.redisService.set(cacheKey, JSON.stringify(filtered), 3600);

    return filtered;
  }

  async getCostTrend(branchId: number | null, period: TimePeriod): Promise<TrendData> {
    // Query SpendingMetric table for time-series data
    const metrics = await prisma.spendingMetric.findMany({
      where: {
        date: {
          gte: period.start,
          lte: period.end,
        },
        ...(branchId ? { branchId } : {}),
      },
      orderBy: { date: 'asc' },
    });

    // Aggregate by date
    const trendMap = new Map<string, number>();
    metrics.forEach(m => {
      const dateKey = m.date.toISOString().split('T')[0];
      trendMap.set(dateKey, (trendMap.get(dateKey) || 0) + m.totalAmount);
    });

    return {
      labels: Array.from(trendMap.keys()),
      values: Array.from(trendMap.values()),
    };
  }

  async getTopOpportunities(limit = 10): Promise<Opportunity[]> {
    const cacheKey = `cost-control:top-opportunities:${limit}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Get all opportunity types
    const [variances, consolidations] = await Promise.all([
      this.getPriceVariances({ page: 1, limit: 20 }),
      this.getConsolidationOpportunities(0),
    ]);

    // Merge and sort by potential savings
    const allOpportunities: Opportunity[] = [
      ...variances.data.map(v => ({
        type: 'PRICE_VARIANCE' as const,
        title: `Price variance: ${v.itemName}`,
        description: `${v.highestPayingBranch} pays ${v.maxVariancePercent.toFixed(1)}% more than ${v.lowestPayingBranch}`,
        potentialSavings: v.potentialSavings,
        itemId: v.itemId,
        vendorId: v.vendorId,
      })),
      ...consolidations.map(c => ({
        type: 'CONSOLIDATION' as const,
        title: `Consolidation opportunity: ${c.itemName}`,
        description: `${c.branchCount} branches could save ${c.savingsPercent.toFixed(1)}% by consolidating`,
        potentialSavings: c.potentialSavings,
        itemId: c.itemId,
        vendorId: c.vendorId,
      })),
    ];

    allOpportunities.sort((a, b) => b.potentialSavings - a.potentialSavings);
    const topN = allOpportunities.slice(0, limit);

    // Cache for 30 minutes
    await this.redisService.set(cacheKey, JSON.stringify(topN), 1800);

    return topN;
  }

  // Private helper methods
  private calculatePotentialSavings(variance: PriceVariance): number {
    const lowestPrice = variance.networkMinPrice;
    let totalSavings = 0;

    variance.branches.forEach(branch => {
      if (branch.currentPrice > lowestPrice) {
        const savingsPerUnit = branch.currentPrice - lowestPrice;
        totalSavings += savingsPerUnit * branch.monthlyVolume;
      }
    });

    return totalSavings;
  }

  private async getBranchStats(branchId: number, period: TimePeriod) {
    // Implementation details for branch statistics
    // Query PriceSnapshot and SpendingMetric tables
    // Calculate avgPriceVsNetwork, itemsAboveAvg, etc.
    // ... (detailed implementation)
  }
}
```

**Types**:

```typescript
// server/src/types/costControl.ts
export interface PriceVarianceOptions {
  itemId?: number;
  vendorId?: number;
  minVariancePercent?: number;
  minVarianceAmount?: number;
  page: number;
  limit: number;
}

export interface TimePeriod {
  start: Date;
  end: Date;
}

export interface TrendData {
  labels: string[];  // Date labels
  values: number[];  // Cost values
}

export interface Opportunity {
  type: 'PRICE_VARIANCE' | 'CONSOLIDATION';
  title: string;
  description: string;
  potentialSavings: number;
  itemId: number;
  vendorId: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
```

---

## API Endpoints

### Route File

**Location**: `server/src/routes/costControl.ts`

**Dependencies**: `CostControlService`, Zod schemas, authentication middleware

### Endpoint Specifications

#### 1. GET /api/cost-control/price-variances

**Purpose**: Get price variances across branches

**Request**:
```typescript
// Query parameters
{
  itemId?: number;
  vendorId?: number;
  minVariancePercent?: number;  // Default: 10
  minVarianceAmount?: number;   // Default: 5
  page?: number;                // Default: 1
  limit?: number;               // Default: 20
}
```

**Response**:
```typescript
{
  data: PriceVariance[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
```

**Zod Schema**:
```typescript
const PriceVarianceQuerySchema = z.object({
  itemId: z.string().optional().transform(Number),
  vendorId: z.string().optional().transform(Number),
  minVariancePercent: z.string().optional().default('10').transform(Number),
  minVarianceAmount: z.string().optional().default('5').transform(Number),
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('20').transform(Number),
});
```

**Implementation**:
```typescript
router.get('/price-variances', authenticate, async (req, res) => {
  try {
    const query = PriceVarianceQuerySchema.parse(req.query);
    const result = await costControlService.getPriceVariances(query);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to fetch price variances' });
    }
  }
});
```

---

#### 2. GET /api/cost-control/benchmarks

**Purpose**: Get network benchmarks for all branches

**Request**:
```typescript
// Query parameters
{
  startDate?: string;  // ISO date, default: 30 days ago
  endDate?: string;    // ISO date, default: today
}
```

**Response**:
```typescript
{
  data: BenchmarkResult[];
}
```

**Zod Schema**:
```typescript
const BenchmarkQuerySchema = z.object({
  startDate: z.string().optional().transform(s => s ? new Date(s) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
  endDate: z.string().optional().transform(s => s ? new Date(s) : new Date()),
});
```

---

#### 3. GET /api/cost-control/opportunities

**Purpose**: Get top cost-saving opportunities

**Request**:
```typescript
// Query parameters
{
  limit?: number;      // Default: 10, max: 50
  minSavings?: number; // Default: 0
}
```

**Response**:
```typescript
{
  data: Opportunity[];
}
```

**Zod Schema**:
```typescript
const OpportunitiesQuerySchema = z.object({
  limit: z.string().optional().default('10').transform(Number).refine(n => n <= 50),
  minSavings: z.string().optional().default('0').transform(Number),
});
```

---

#### 4. GET /api/cost-control/consolidation

**Purpose**: Get consolidation opportunities

**Request**:
```typescript
// Query parameters
{
  minSavings?: number;  // Default: 100
}
```

**Response**:
```typescript
{
  data: ConsolidationOpportunity[];
}
```

---

#### 5. GET /api/cost-control/trends/:branchId?

**Purpose**: Get cost trend over time

**Request**:
```typescript
// Path parameter: branchId (optional, null = network-wide)
// Query parameters
{
  startDate?: string;  // ISO date
  endDate?: string;    // ISO date
  granularity?: 'daily' | 'weekly' | 'monthly';  // Default: daily
}
```

**Response**:
```typescript
{
  branchId: number | null;
  branchName: string | null;
  period: {
    start: string;
    end: string;
  };
  data: TrendData;
}
```

---

### Complete Route File

```typescript
// server/src/routes/costControl.ts
import { Router } from 'express';
import { z } from 'zod';
import { CostControlService } from '../services/analytics/costControlService';
import { CrossLocationService } from '../services/analytics/crossLocationService';
import { RedisService } from '../services/redisService';
import { authenticate } from '../middleware/auth';

const router = Router();

// Initialize services (in production, use DI container)
const redisService = new RedisService(process.env.REDIS_URL || 'redis://localhost:6379');
const crossLocationService = new CrossLocationService(redisService);
const costControlService = new CostControlService(crossLocationService, redisService);

// Zod schemas
const PriceVarianceQuerySchema = z.object({
  itemId: z.string().optional().transform(Number),
  vendorId: z.string().optional().transform(Number),
  minVariancePercent: z.string().optional().default('10').transform(Number),
  minVarianceAmount: z.string().optional().default('5').transform(Number),
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('20').transform(Number),
});

const BenchmarkQuerySchema = z.object({
  startDate: z.string().optional().transform(s => s ? new Date(s) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
  endDate: z.string().optional().transform(s => s ? new Date(s) : new Date()),
});

const OpportunitiesQuerySchema = z.object({
  limit: z.string().optional().default('10').transform(Number).refine(n => n <= 50),
  minSavings: z.string().optional().default('0').transform(Number),
});

const ConsolidationQuerySchema = z.object({
  minSavings: z.string().optional().default('100').transform(Number),
});

const TrendQuerySchema = z.object({
  startDate: z.string().optional().transform(s => s ? new Date(s) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
  endDate: z.string().optional().transform(s => s ? new Date(s) : new Date()),
  granularity: z.enum(['daily', 'weekly', 'monthly']).optional().default('daily'),
});

// Endpoints
router.get('/price-variances', authenticate, async (req, res) => {
  try {
    const query = PriceVarianceQuerySchema.parse(req.query);
    const result = await costControlService.getPriceVariances(query);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    } else {
      console.error('Error fetching price variances:', error);
      res.status(500).json({ error: 'Failed to fetch price variances' });
    }
  }
});

router.get('/benchmarks', authenticate, async (req, res) => {
  try {
    const query = BenchmarkQuerySchema.parse(req.query);
    const period = { start: query.startDate, end: query.endDate };
    const result = await costControlService.getNetworkBenchmark(period);
    res.json({ data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    } else {
      console.error('Error fetching benchmarks:', error);
      res.status(500).json({ error: 'Failed to fetch benchmarks' });
    }
  }
});

router.get('/opportunities', authenticate, async (req, res) => {
  try {
    const query = OpportunitiesQuerySchema.parse(req.query);
    const result = await costControlService.getTopOpportunities(query.limit);
    res.json({ data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    } else {
      console.error('Error fetching opportunities:', error);
      res.status(500).json({ error: 'Failed to fetch opportunities' });
    }
  }
});

router.get('/consolidation', authenticate, async (req, res) => {
  try {
    const query = ConsolidationQuerySchema.parse(req.query);
    const result = await costControlService.getConsolidationOpportunities(query.minSavings);
    res.json({ data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    } else {
      console.error('Error fetching consolidation opportunities:', error);
      res.status(500).json({ error: 'Failed to fetch consolidation opportunities' });
    }
  }
});

router.get('/trends/:branchId?', authenticate, async (req, res) => {
  try {
    const branchId = req.params.branchId ? parseInt(req.params.branchId) : null;
    const query = TrendQuerySchema.parse(req.query);
    const period = { start: query.startDate, end: query.endDate };
    const result = await costControlService.getCostTrend(branchId, period);

    // Get branch name if branchId provided
    let branchName = null;
    if (branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: branchId } });
      branchName = branch?.name || null;
    }

    res.json({
      branchId,
      branchName,
      period: {
        start: period.start.toISOString(),
        end: period.end.toISOString(),
      },
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    } else {
      console.error('Error fetching cost trends:', error);
      res.status(500).json({ error: 'Failed to fetch cost trends' });
    }
  }
});

export default router;
```

### Register Routes

Update `server/src/index.ts`:

```typescript
import costControlRoutes from './routes/costControl';

// ... existing routes
app.use('/api/cost-control', costControlRoutes);
```

---

## Frontend Components

### Page Structure

**New Page**: `client/src/pages/CostControlDashboard.tsx`

**Route**: `/cost-control`

**Layout**:
```
+--------------------------------------------------+
| Header: Cross-Location Cost Control             |
+--------------------------------------------------+
| [Summary Cards]                                  |
| - Total Opportunities                            |
| - Potential Annual Savings                       |
| - Avg Price Variance                             |
| - Top Performer (Branch)                         |
+--------------------------------------------------+
| [Top Opportunities Panel]                        |
| - List of top 5 opportunities with actions       |
+--------------------------------------------------+
| [Tabs]                                           |
| - Price Variances                                |
| - Network Benchmarks                             |
| - Consolidation Opportunities                    |
| - Cost Trends                                    |
+--------------------------------------------------+
```

### Component Breakdown

#### 1. CostControlDashboard.tsx (Main Page)

**Location**: `client/src/pages/CostControlDashboard.tsx`

**Responsibilities**:
- Layout and tab management
- Fetch summary statistics
- Render child components

**Implementation**:
```typescript
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SummaryCards } from '@/components/cost-control/SummaryCards';
import { TopOpportunities } from '@/components/cost-control/TopOpportunities';
import { PriceVarianceTable } from '@/components/cost-control/PriceVarianceTable';
import { NetworkBenchmark } from '@/components/cost-control/NetworkBenchmark';
import { ConsolidationPanel } from '@/components/cost-control/ConsolidationPanel';
import { CostTrendChart } from '@/components/cost-control/CostTrendChart';
import { costControlService } from '@/services/costControlService';

export const CostControlDashboard: React.FC = () => {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOpportunities();
  }, []);

  const loadOpportunities = async () => {
    try {
      setLoading(true);
      const data = await costControlService.getTopOpportunities(5);
      setOpportunities(data);
    } catch (error) {
      console.error('Failed to load opportunities:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cross-Location Cost Control</h1>
        <p className="text-gray-600">
          Compare costs across branches and identify savings opportunities
        </p>
      </div>

      <SummaryCards />

      <Card>
        <CardHeader>
          <CardTitle>Top Opportunities</CardTitle>
        </CardHeader>
        <CardContent>
          <TopOpportunities opportunities={opportunities} loading={loading} />
        </CardContent>
      </Card>

      <Tabs defaultValue="variances" className="space-y-4">
        <TabsList>
          <TabsTrigger value="variances">Price Variances</TabsTrigger>
          <TabsTrigger value="benchmarks">Network Benchmarks</TabsTrigger>
          <TabsTrigger value="consolidation">Consolidation</TabsTrigger>
          <TabsTrigger value="trends">Cost Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="variances">
          <PriceVarianceTable />
        </TabsContent>

        <TabsContent value="benchmarks">
          <NetworkBenchmark />
        </TabsContent>

        <TabsContent value="consolidation">
          <ConsolidationPanel />
        </TabsContent>

        <TabsContent value="trends">
          <CostTrendChart />
        </TabsContent>
      </Tabs>
    </div>
  );
};
```

---

#### 2. SummaryCards.tsx

**Location**: `client/src/components/cost-control/SummaryCards.tsx`

**Purpose**: Display key metrics at a glance

**Implementation**:
```typescript
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, DollarSign, AlertTriangle, Award } from 'lucide-react';
import { costControlService } from '@/services/costControlService';

interface SummaryData {
  totalOpportunities: number;
  potentialSavings: number;
  avgVariancePercent: number;
  topPerformer: string;
}

export const SummaryCards: React.FC = () => {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      const [opportunities, benchmarks] = await Promise.all([
        costControlService.getTopOpportunities(100),
        costControlService.getNetworkBenchmark(),
      ]);

      const totalSavings = opportunities.reduce((sum, o) => sum + o.potentialSavings, 0);
      const topBranch = benchmarks[0]?.branchName || 'N/A';

      setData({
        totalOpportunities: opportunities.length,
        potentialSavings: totalSavings,
        avgVariancePercent: 12.5, // Calculate from opportunities
        topPerformer: topBranch,
      });
    } catch (error) {
      console.error('Failed to load summary:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Opportunities</CardTitle>
          <AlertTriangle className="h-4 w-4 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data?.totalOpportunities}</div>
          <p className="text-xs text-gray-600">Active cost-saving opportunities</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Potential Savings</CardTitle>
          <DollarSign className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${data?.potentialSavings.toLocaleString()}/mo
          </div>
          <p className="text-xs text-gray-600">
            ${((data?.potentialSavings || 0) * 12).toLocaleString()}/yr potential
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Price Variance</CardTitle>
          <TrendingUp className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data?.avgVariancePercent}%</div>
          <p className="text-xs text-gray-600">Across all locations</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
          <Award className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data?.topPerformer}</div>
          <p className="text-xs text-gray-600">Lowest avg cost vs network</p>
        </CardContent>
      </Card>
    </div>
  );
};
```

---

#### 3. PriceVarianceTable.tsx

**Location**: `client/src/components/cost-control/PriceVarianceTable.tsx`

**Purpose**: Display price variances in sortable, filterable table

**Features**:
- Sortable columns (variance %, savings, item name)
- Filters (item, vendor, min variance)
- Pagination
- Expand row to see branch-level details
- Action buttons (view item, contact vendor)

**Implementation**:
```typescript
import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { costControlService } from '@/services/costControlService';
import type { PriceVariance } from '@/types/costControl';

export const PriceVarianceTable: React.FC = () => {
  const [variances, setVariances] = useState<PriceVariance[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  useEffect(() => {
    loadVariances();
  }, [page]);

  const loadVariances = async () => {
    try {
      setLoading(true);
      const result = await costControlService.getPriceVariances({ page, limit: 20 });
      setVariances(result.data);
    } catch (error) {
      console.error('Failed to load variances:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (itemId: number) => {
    setExpandedRow(expandedRow === itemId ? null : itemId);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Input placeholder="Search item..." className="max-w-sm" />
        <Input placeholder="Min variance %" type="number" className="max-w-xs" />
        <Button onClick={loadVariances}>Apply Filters</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>Item</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead className="text-right">Max Variance</TableHead>
            <TableHead className="text-right">Potential Savings</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {variances.map((variance) => (
            <React.Fragment key={variance.itemId}>
              <TableRow>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleRow(variance.itemId)}
                  >
                    {expandedRow === variance.itemId ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </TableCell>
                <TableCell>{variance.itemName}</TableCell>
                <TableCell>{variance.vendorName}</TableCell>
                <TableCell className="text-right">
                  <span className="text-red-600 font-semibold">
                    {variance.maxVariancePercent.toFixed(1)}%
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="text-green-600 font-semibold">
                    ${variance.potentialSavings.toFixed(2)}/mo
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      View Item
                    </Button>
                    <Button variant="outline" size="sm">
                      Contact Vendor
                    </Button>
                  </div>
                </TableCell>
              </TableRow>

              {expandedRow === variance.itemId && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <div className="p-4 bg-gray-50 rounded space-y-2">
                      <h4 className="font-semibold">Branch-Level Breakdown:</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Branch</TableHead>
                            <TableHead className="text-right">Current Price</TableHead>
                            <TableHead className="text-right">Monthly Volume</TableHead>
                            <TableHead className="text-right">Last Purchase</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {variance.branches.map((branch) => (
                            <TableRow key={branch.branchId}>
                              <TableCell>{branch.branchName}</TableCell>
                              <TableCell className="text-right">
                                ${branch.currentPrice.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right">
                                {branch.monthlyVolume}
                              </TableCell>
                              <TableCell className="text-right">
                                {new Date(branch.lastPurchaseDate).toLocaleDateString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
```

---

#### 4. NetworkBenchmark.tsx

**Location**: `client/src/components/cost-control/NetworkBenchmark.tsx`

**Purpose**: Display branch rankings and performance vs network

**Features**:
- Leaderboard table (rank, branch, performance metrics)
- Visual indicators (above/below average)
- Filters (date range)
- Export to CSV

---

#### 5. ConsolidationPanel.tsx

**Location**: `client/src/components/cost-control/ConsolidationPanel.tsx`

**Purpose**: Display consolidation opportunities

**Features**:
- Card-based layout for each opportunity
- Savings estimate per opportunity
- List of branches to consolidate
- Action buttons (recommend, dismiss)

---

#### 6. CostTrendChart.tsx

**Location**: `client/src/components/cost-control/CostTrendChart.tsx`

**Purpose**: Line chart showing cost trends over time

**Features**:
- Recharts line chart
- Branch selector dropdown
- Date range picker
- Compare multiple branches

**Implementation** (using Recharts):
```typescript
import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { costControlService } from '@/services/costControlService';

export const CostTrendChart: React.FC = () => {
  const [trendData, setTrendData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);

  useEffect(() => {
    loadTrend();
  }, [selectedBranch]);

  const loadTrend = async () => {
    try {
      setLoading(true);
      const result = await costControlService.getCostTrend(selectedBranch);

      // Transform data for Recharts
      const chartData = result.labels.map((label, i) => ({
        date: label,
        cost: result.values[i],
      }));

      setTrendData(chartData);
    } catch (error) {
      console.error('Failed to load trend:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <select
          value={selectedBranch || ''}
          onChange={(e) => setSelectedBranch(e.target.value ? Number(e.target.value) : null)}
          className="border rounded px-3 py-2"
        >
          <option value="">Network-wide</option>
          {/* Branch options populated from API */}
        </select>
      </div>

      {loading ? (
        <div>Loading chart...</div>
      ) : (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
            <Legend />
            <Line
              type="monotone"
              dataKey="cost"
              stroke="#8884d8"
              activeDot={{ r: 8 }}
              name="Total Cost"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};
```

---

### Frontend Service

**Location**: `client/src/services/costControlService.ts`

```typescript
import api from '@/lib/api';
import type {
  PriceVariance,
  BenchmarkResult,
  ConsolidationOpportunity,
  Opportunity,
  TrendData,
  PaginatedResult,
} from '@/types/costControl';

const getPriceVariances = async (options: {
  itemId?: number;
  vendorId?: number;
  page: number;
  limit: number;
}): Promise<PaginatedResult<PriceVariance>> => {
  const params = new URLSearchParams();
  if (options.itemId) params.append('itemId', String(options.itemId));
  if (options.vendorId) params.append('vendorId', String(options.vendorId));
  params.append('page', String(options.page));
  params.append('limit', String(options.limit));

  const response = await api.get(`/cost-control/price-variances?${params.toString()}`);
  return response.data;
};

const getNetworkBenchmark = async (): Promise<BenchmarkResult[]> => {
  const response = await api.get('/cost-control/benchmarks');
  return response.data.data;
};

const getConsolidationOpportunities = async (
  minSavings = 100
): Promise<ConsolidationOpportunity[]> => {
  const response = await api.get(`/cost-control/consolidation?minSavings=${minSavings}`);
  return response.data.data;
};

const getTopOpportunities = async (limit = 10): Promise<Opportunity[]> => {
  const response = await api.get(`/cost-control/opportunities?limit=${limit}`);
  return response.data.data;
};

const getCostTrend = async (branchId: number | null): Promise<TrendData> => {
  const url = branchId
    ? `/cost-control/trends/${branchId}`
    : '/cost-control/trends';
  const response = await api.get(url);
  return response.data.data;
};

export const costControlService = {
  getPriceVariances,
  getNetworkBenchmark,
  getConsolidationOpportunities,
  getTopOpportunities,
  getCostTrend,
};
```

---

### Frontend Types

**Location**: `client/src/types/costControl.ts`

```typescript
export interface PriceVariance {
  itemId: number;
  itemName: string;
  vendorId: number;
  vendorName: string;
  branches: {
    branchId: number;
    branchName: string;
    currentPrice: number;
    lastPurchaseDate: Date;
    monthlyVolume: number;
  }[];
  networkAvgPrice: number;
  networkMinPrice: number;
  networkMaxPrice: number;
  maxVariance: number;
  maxVariancePercent: number;
  highestPayingBranch: string;
  lowestPayingBranch: string;
  potentialSavings: number;
}

export interface BenchmarkResult {
  branchId: number;
  branchName: string;
  totalSpending: number;
  avgPriceVsNetwork: number;
  itemsAboveAvg: number;
  itemsBelowAvg: number;
  rank: number;
  totalBranches: number;
  potentialSavings: number;
}

export interface ConsolidationOpportunity {
  itemId: number;
  itemName: string;
  vendorId: number;
  vendorName: string;
  branchCount: number;
  currentNetworkSpend: number;
  avgPricePerBranch: number;
  lowestPrice: number;
  potentialSavings: number;
  savingsPercent: number;
  branchesToConsolidate: {
    branchId: number;
    branchName: string;
    currentPrice: number;
    monthlySavings: number;
  }[];
}

export interface Opportunity {
  type: 'PRICE_VARIANCE' | 'CONSOLIDATION';
  title: string;
  description: string;
  potentialSavings: number;
  itemId: number;
  vendorId: number;
}

export interface TrendData {
  labels: string[];
  values: number[];
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
```

---

### Add Route to App

Update `client/src/App.tsx`:

```typescript
import { CostControlDashboard } from '@/pages/CostControlDashboard';

// Inside Router
<Route path="/cost-control" element={<ProtectedRoute><CostControlDashboard /></ProtectedRoute>} />
```

Update navigation menu to include "Cost Control" link.

---

## Implementation Phases

### Phase 1: Backend Service (3 days)

**Goal**: Implement CostControlService and all business logic

**Tasks**:
1. Create `server/src/types/costControl.ts` with all TypeScript interfaces
2. Implement `CostControlService` class in `server/src/services/analytics/costControlService.ts`
3. Write unit tests for all service methods (TDD approach)
4. Test against foundation services (CrossLocationService, AggregationService)
5. Verify caching behavior with RedisService

**Deliverables**:
- `costControlService.ts` (300+ lines)
- `costControl.test.ts` (unit tests)
- All methods passing tests

**Verification**:
```bash
cd server
npm run test -- costControlService.test.ts
```

---

### Phase 2: API Endpoints (2 days)

**Goal**: Create RESTful API endpoints with validation

**Tasks**:
1. Create `server/src/routes/costControl.ts` with all 5 endpoints
2. Define Zod schemas for request/response validation
3. Add authentication middleware to all routes
4. Register routes in `server/src/index.ts`
5. Write integration tests for all endpoints
6. Test with Postman/Insomnia

**Deliverables**:
- `costControl.ts` routes file
- `costControl.routes.test.ts` (integration tests)
- Postman collection for manual testing

**Verification**:
```bash
cd server
npm run dev

# In another terminal
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/cost-control/opportunities
```

---

### Phase 3: Frontend Dashboard (4 days)

**Goal**: Build interactive dashboard with all visualizations

**Day 1**:
- Create `client/src/types/costControl.ts`
- Create `client/src/services/costControlService.ts`
- Build `CostControlDashboard.tsx` main page
- Build `SummaryCards.tsx` component

**Day 2**:
- Build `TopOpportunities.tsx` component
- Build `PriceVarianceTable.tsx` with expand/collapse
- Add filters and pagination

**Day 3**:
- Build `NetworkBenchmark.tsx` leaderboard
- Build `ConsolidationPanel.tsx` cards
- Build `CostTrendChart.tsx` with Recharts

**Day 4**:
- Add routing and navigation
- Implement loading states and error handling
- Polish UI/UX (responsive, colors, spacing)
- Add export to CSV functionality

**Deliverables**:
- 6 React components (1 page + 5 sub-components)
- 1 service file
- 1 types file
- Updated App.tsx with routing

**Verification**:
```bash
cd client
npm run dev

# Open http://localhost:5173/cost-control
```

---

### Phase 4: Testing & Polish (2 days)

**Goal**: Comprehensive testing and production readiness

**Tasks**:
1. **Unit Tests**:
   - Service layer tests (backend)
   - Component tests (frontend with React Testing Library)
   - Mock API responses

2. **Integration Tests**:
   - API endpoint tests
   - End-to-end user flows (Cypress/Playwright)

3. **Performance Testing**:
   - Load test endpoints with 100 concurrent users
   - Verify caching reduces DB queries
   - Check page load times < 2 seconds

4. **Security Testing**:
   - Verify authentication on all routes
   - Test SQL injection prevention (Prisma)
   - Check XSS prevention (Zod sanitization)

5. **User Acceptance Testing**:
   - CFO persona: Can they find top opportunities?
   - Procurement Manager: Can they drill into variances?
   - Branch Manager: Can they see their rank?

6. **Documentation**:
   - API documentation (OpenAPI spec)
   - User guide (how to use dashboard)
   - Debugging journal (common issues)

**Deliverables**:
- 80%+ test coverage
- Performance report
- Security audit report
- User guide document

**Verification**:
```bash
# Run all tests
cd server && npm run test
cd client && npm run test

# Check coverage
npm run test:coverage
```

---

## Testing Strategy

### Unit Tests

**Backend Services**:

```typescript
// server/src/services/analytics/__tests__/costControlService.test.ts
import { CostControlService } from '../costControlService';
import { CrossLocationService } from '../crossLocationService';
import { RedisService } from '../../redisService';

describe('CostControlService', () => {
  let service: CostControlService;
  let mockCrossLocation: jest.Mocked<CrossLocationService>;
  let mockRedis: jest.Mocked<RedisService>;

  beforeEach(() => {
    mockCrossLocation = {
      getPriceVariance: jest.fn(),
      getBenchmarkStats: jest.fn(),
      findConsolidationOpportunities: jest.fn(),
    } as any;

    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
    } as any;

    service = new CostControlService(mockCrossLocation, mockRedis);
  });

  describe('getPriceVariances', () => {
    it('should return paginated price variances', async () => {
      // Arrange
      mockCrossLocation.getPriceVariance.mockResolvedValue([
        {
          itemId: 1,
          itemName: 'Chicken Breast',
          branches: [
            { branchId: 1, currentPrice: 4.50, monthlyVolume: 1000 },
            { branchId: 2, currentPrice: 3.20, monthlyVolume: 800 },
          ],
          networkMinPrice: 3.20,
          maxVariance: 1.30,
          maxVariancePercent: 40.6,
        },
      ]);

      // Act
      const result = await service.getPriceVariances({ page: 1, limit: 20 });

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.data[0].potentialSavings).toBeGreaterThan(0);
      expect(result.pagination.total).toBe(1);
    });

    it('should filter out variances below threshold', async () => {
      mockCrossLocation.getPriceVariance.mockResolvedValue([
        { maxVariancePercent: 5, maxVariance: 2 }, // Below threshold
        { maxVariancePercent: 15, maxVariance: 10 }, // Above threshold
      ]);

      const result = await service.getPriceVariances({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].maxVariancePercent).toBe(15);
    });

    it('should use cached results when available', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ data: [], pagination: {} }));

      await service.getPriceVariances({ page: 1, limit: 20 });

      expect(mockCrossLocation.getPriceVariance).not.toHaveBeenCalled();
    });
  });

  describe('getNetworkBenchmark', () => {
    it('should rank branches by avgPriceVsNetwork', async () => {
      // Test implementation
    });
  });

  describe('calculatePotentialSavings', () => {
    it('should calculate savings correctly', () => {
      const variance = {
        branches: [
          { currentPrice: 5.00, monthlyVolume: 100 },
          { currentPrice: 4.00, monthlyVolume: 200 },
        ],
        networkMinPrice: 3.50,
      };

      const savings = service['calculatePotentialSavings'](variance);

      // Branch 1: (5.00 - 3.50) * 100 = 150
      // Branch 2: (4.00 - 3.50) * 200 = 100
      // Total: 250
      expect(savings).toBe(250);
    });
  });
});
```

**Frontend Components**:

```typescript
// client/src/components/cost-control/__tests__/SummaryCards.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { SummaryCards } from '../SummaryCards';
import { costControlService } from '@/services/costControlService';

jest.mock('@/services/costControlService');

describe('SummaryCards', () => {
  it('should display summary metrics', async () => {
    // Arrange
    (costControlService.getTopOpportunities as jest.Mock).mockResolvedValue([
      { potentialSavings: 1000 },
      { potentialSavings: 500 },
    ]);
    (costControlService.getNetworkBenchmark as jest.Mock).mockResolvedValue([
      { branchName: 'Branch A', rank: 1 },
    ]);

    // Act
    render(<SummaryCards />);

    // Assert
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument(); // Total opportunities
      expect(screen.getByText(/\$1,500/)).toBeInTheDocument(); // Total savings
      expect(screen.getByText('Branch A')).toBeInTheDocument(); // Top performer
    });
  });

  it('should handle loading state', () => {
    (costControlService.getTopOpportunities as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<SummaryCards />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
```

---

### Integration Tests

**API Endpoints**:

```typescript
// server/src/routes/__tests__/costControl.integration.test.ts
import request from 'supertest';
import app from '../../index';
import { generateTestToken } from '../../utils/testHelpers';

describe('Cost Control API', () => {
  let authToken: string;

  beforeAll(async () => {
    authToken = await generateTestToken({ role: 'ADMIN' });
  });

  describe('GET /api/cost-control/price-variances', () => {
    it('should return 200 with price variances', async () => {
      const response = await request(app)
        .get('/api/cost-control/price-variances')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/cost-control/price-variances')
        .expect(401);
    });

    it('should validate query parameters', async () => {
      const response = await request(app)
        .get('/api/cost-control/price-variances?page=invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should apply filters correctly', async () => {
      const response = await request(app)
        .get('/api/cost-control/price-variances?minVariancePercent=20')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // All results should have variance >= 20%
      response.body.data.forEach((v: any) => {
        expect(v.maxVariancePercent).toBeGreaterThanOrEqual(20);
      });
    });
  });

  describe('GET /api/cost-control/benchmarks', () => {
    it('should return ranked branches', async () => {
      const response = await request(app)
        .get('/api/cost-control/benchmarks')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(response.body.data[0]).toHaveProperty('rank');
      expect(response.body.data[0].rank).toBe(1);
    });
  });
});
```

---

### E2E Tests

**User Flows** (Cypress/Playwright):

```typescript
// cypress/e2e/cost-control.cy.ts
describe('Cost Control Dashboard', () => {
  beforeEach(() => {
    cy.login('admin@example.com', 'password');
    cy.visit('/cost-control');
  });

  it('should display summary cards', () => {
    cy.contains('Total Opportunities').should('be.visible');
    cy.contains('Potential Savings').should('be.visible');
    cy.contains('Top Performer').should('be.visible');
  });

  it('should filter price variances', () => {
    cy.get('[data-testid="variances-tab"]').click();
    cy.get('input[placeholder="Min variance %"]').type('15');
    cy.contains('Apply Filters').click();

    cy.wait(1000);

    // All results should show variance >= 15%
    cy.get('[data-testid="variance-row"]').each(($row) => {
      cy.wrap($row).find('[data-testid="variance-percent"]').should((text) => {
        const percent = parseFloat(text.text());
        expect(percent).to.be.at.least(15);
      });
    });
  });

  it('should expand variance row to show branch details', () => {
    cy.get('[data-testid="variances-tab"]').click();
    cy.get('[data-testid="expand-button"]').first().click();
    cy.contains('Branch-Level Breakdown').should('be.visible');
  });

  it('should display network benchmark leaderboard', () => {
    cy.get('[data-testid="benchmarks-tab"]').click();
    cy.contains('Rank').should('be.visible');
    cy.get('[data-testid="benchmark-row"]').should('have.length.at.least', 1);
  });

  it('should show cost trend chart', () => {
    cy.get('[data-testid="trends-tab"]').click();
    cy.get('[data-testid="trend-chart"]').should('be.visible');
  });
});
```

---

### Performance Tests

**Load Testing** (k6 or Artillery):

```javascript
// load-tests/cost-control.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp up to 20 users
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests < 2s
  },
};

export default function () {
  const token = 'your-jwt-token';
  const headers = { Authorization: `Bearer ${token}` };

  // Test price variances endpoint
  const res1 = http.get('http://localhost:3000/api/cost-control/price-variances', { headers });
  check(res1, {
    'status is 200': (r) => r.status === 200,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });

  sleep(1);

  // Test benchmarks endpoint
  const res2 = http.get('http://localhost:3000/api/cost-control/benchmarks', { headers });
  check(res2, {
    'status is 200': (r) => r.status === 200,
    'cached response < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

Run with:
```bash
k6 run load-tests/cost-control.js
```

---

## Acceptance Criteria

### Feature is COMPLETE when:

1. **Backend Service**:
   - [ ] CostControlService implements all 5 methods
   - [ ] All service methods have 80%+ test coverage
   - [ ] Service correctly filters by minimum variance threshold
   - [ ] Service calculates potential savings accurately
   - [ ] Service uses Redis caching (verified via cache hits)

2. **API Endpoints**:
   - [ ] All 5 endpoints return correct data structures
   - [ ] All endpoints require authentication
   - [ ] All query parameters validated with Zod
   - [ ] All endpoints return appropriate HTTP status codes
   - [ ] Integration tests pass for all endpoints

3. **Frontend Dashboard**:
   - [ ] Dashboard loads without errors
   - [ ] Summary cards display correct metrics
   - [ ] Top opportunities panel shows top 5 items
   - [ ] Price variance table supports filtering and pagination
   - [ ] Price variance rows expand to show branch details
   - [ ] Network benchmark leaderboard displays all branches ranked
   - [ ] Consolidation panel displays opportunities sorted by savings
   - [ ] Cost trend chart displays time-series data
   - [ ] Chart updates when branch selector changes
   - [ ] All components handle loading and error states
   - [ ] UI is responsive (mobile, tablet, desktop)

4. **User Experience**:
   - [ ] CFO can identify top 10 opportunities in < 30 seconds
   - [ ] Procurement Manager can filter variances by vendor
   - [ ] Branch Manager can see their rank vs network
   - [ ] Dashboard loads in < 2 seconds (with warm cache)
   - [ ] Export to CSV functionality works

5. **Testing**:
   - [ ] Unit tests pass (backend + frontend)
   - [ ] Integration tests pass (API endpoints)
   - [ ] E2E tests pass (user flows)
   - [ ] Load tests show p95 response time < 2s
   - [ ] Security audit passes (auth, SQL injection, XSS)

6. **Documentation**:
   - [ ] API documentation updated (OpenAPI spec)
   - [ ] User guide created (how to use dashboard)
   - [ ] Debugging journal created (common issues)
   - [ ] Implementation checklist completed

7. **Production Readiness**:
   - [ ] Feature flag enabled (can be toggled)
   - [ ] Monitoring alerts configured (error rate, latency)
   - [ ] Logging implemented (request/response, errors)
   - [ ] Redis cache invalidation strategy verified
   - [ ] Database indexes optimized (query performance)

---

## Implementation Checklist

### Phase 1: Backend Service (Days 1-3)

#### Day 1: Types and Service Structure
- [ ] Create `server/src/types/costControl.ts`
  - [ ] Define `PriceVariance` interface
  - [ ] Define `BenchmarkResult` interface
  - [ ] Define `ConsolidationOpportunity` interface
  - [ ] Define `Opportunity` interface
  - [ ] Define `TrendData` interface
  - [ ] Define helper types (PriceVarianceOptions, TimePeriod, etc.)
- [ ] Create `server/src/services/analytics/costControlService.ts`
  - [ ] Define `ICostControlService` interface
  - [ ] Implement class skeleton with all methods
  - [ ] Add constructor with dependencies

#### Day 2: Service Implementation
- [ ] Implement `getPriceVariances` method
  - [ ] Fetch data from CrossLocationService
  - [ ] Filter by minimum variance threshold
  - [ ] Calculate potential savings
  - [ ] Sort by savings
  - [ ] Apply pagination
  - [ ] Implement caching
- [ ] Implement `getNetworkBenchmark` method
  - [ ] Fetch all branches
  - [ ] Calculate branch statistics
  - [ ] Rank branches
  - [ ] Implement caching
- [ ] Implement `getConsolidationOpportunities` method
  - [ ] Fetch from CrossLocationService
  - [ ] Filter by minimum savings
  - [ ] Sort by savings
  - [ ] Implement caching

#### Day 3: Service Completion and Testing
- [ ] Implement `getCostTrend` method
  - [ ] Query SpendingMetric table
  - [ ] Aggregate by date
  - [ ] Format for chart
- [ ] Implement `getTopOpportunities` method
  - [ ] Merge variances and consolidations
  - [ ] Sort by savings
  - [ ] Limit results
  - [ ] Implement caching
- [ ] Implement private helper methods
  - [ ] `calculatePotentialSavings`
  - [ ] `getBranchStats`
- [ ] Write unit tests
  - [ ] Test `getPriceVariances` with various inputs
  - [ ] Test filtering logic
  - [ ] Test caching behavior
  - [ ] Test `getNetworkBenchmark` ranking
  - [ ] Test `calculatePotentialSavings` calculation
  - [ ] Achieve 80%+ coverage
- [ ] Run tests: `npm run test -- costControlService.test.ts`

---

### Phase 2: API Endpoints (Days 4-5)

#### Day 4: Route Implementation
- [ ] Create `server/src/routes/costControl.ts`
- [ ] Define Zod schemas
  - [ ] `PriceVarianceQuerySchema`
  - [ ] `BenchmarkQuerySchema`
  - [ ] `OpportunitiesQuerySchema`
  - [ ] `ConsolidationQuerySchema`
  - [ ] `TrendQuerySchema`
- [ ] Initialize services in route file
- [ ] Implement endpoint: `GET /price-variances`
  - [ ] Parse query params with Zod
  - [ ] Call service method
  - [ ] Handle errors
  - [ ] Return JSON response
- [ ] Implement endpoint: `GET /benchmarks`
- [ ] Implement endpoint: `GET /opportunities`
- [ ] Implement endpoint: `GET /consolidation`
- [ ] Implement endpoint: `GET /trends/:branchId?`
- [ ] Register routes in `server/src/index.ts`
  - [ ] Import route file
  - [ ] Mount at `/api/cost-control`

#### Day 5: API Testing
- [ ] Create `server/src/routes/__tests__/costControl.integration.test.ts`
- [ ] Write integration tests for all endpoints
  - [ ] Test successful responses (200)
  - [ ] Test authentication requirement (401)
  - [ ] Test query parameter validation (400)
  - [ ] Test filtering behavior
  - [ ] Test pagination
- [ ] Run integration tests: `npm run test -- costControl.integration.test.ts`
- [ ] Manual testing with Postman/Insomnia
  - [ ] Create Postman collection
  - [ ] Test all endpoints with various parameters
  - [ ] Verify response structures
  - [ ] Test error cases
- [ ] Verify caching with Redis
  - [ ] Check Redis keys: `redis-cli KEYS "cost-control:*"`
  - [ ] Verify TTLs: `redis-cli TTL "cost-control:variances:..."`

---

### Phase 3: Frontend Dashboard (Days 6-9)

#### Day 6: Types, Service, and Main Page
- [ ] Create `client/src/types/costControl.ts`
  - [ ] Copy interfaces from backend types
  - [ ] Add frontend-specific types if needed
- [ ] Create `client/src/services/costControlService.ts`
  - [ ] Implement `getPriceVariances`
  - [ ] Implement `getNetworkBenchmark`
  - [ ] Implement `getConsolidationOpportunities`
  - [ ] Implement `getTopOpportunities`
  - [ ] Implement `getCostTrend`
- [ ] Create `client/src/pages/CostControlDashboard.tsx`
  - [ ] Set up page layout
  - [ ] Add header with title and description
  - [ ] Add Tabs component with 4 tabs
  - [ ] Fetch top opportunities on mount
  - [ ] Implement loading state
- [ ] Create `client/src/components/cost-control/SummaryCards.tsx`
  - [ ] Create 4 cards: Opportunities, Savings, Variance, Top Performer
  - [ ] Fetch summary data from API
  - [ ] Display metrics with icons
  - [ ] Implement loading skeleton
- [ ] Test page loads: `npm run dev` and visit `/cost-control`

#### Day 7: Price Variances and Top Opportunities
- [ ] Create `client/src/components/cost-control/TopOpportunities.tsx`
  - [ ] Display opportunities as cards or list
  - [ ] Show type, title, description, savings
  - [ ] Add action buttons (view, dismiss)
  - [ ] Implement loading state
- [ ] Create `client/src/components/cost-control/PriceVarianceTable.tsx`
  - [ ] Set up Table component
  - [ ] Display columns: expand, item, vendor, variance, savings, actions
  - [ ] Implement expand/collapse row
  - [ ] Show branch-level breakdown in expanded row
  - [ ] Add filters (item search, min variance)
  - [ ] Add pagination controls
  - [ ] Implement loading skeleton
- [ ] Test interactions:
  - [ ] Expand row to see branches
  - [ ] Apply filters
  - [ ] Navigate pages

#### Day 8: Benchmarks, Consolidation, and Trends
- [ ] Create `client/src/components/cost-control/NetworkBenchmark.tsx`
  - [ ] Set up leaderboard table
  - [ ] Display columns: rank, branch, spending, variance, savings
  - [ ] Add visual indicators (above/below average)
  - [ ] Add date range filter
  - [ ] Add export to CSV button
  - [ ] Implement loading state
- [ ] Create `client/src/components/cost-control/ConsolidationPanel.tsx`
  - [ ] Display opportunities as cards
  - [ ] Show item, vendor, savings, branch count
  - [ ] List branches to consolidate in each card
  - [ ] Add action buttons (recommend, dismiss)
  - [ ] Implement loading state
- [ ] Install Recharts: `npm install recharts`
- [ ] Create `client/src/components/cost-control/CostTrendChart.tsx`
  - [ ] Set up LineChart component
  - [ ] Fetch trend data on mount
  - [ ] Add branch selector dropdown
  - [ ] Add date range picker
  - [ ] Implement loading state
- [ ] Test all tabs work correctly

#### Day 9: Routing, Polish, and Error Handling
- [ ] Update `client/src/App.tsx`
  - [ ] Import `CostControlDashboard`
  - [ ] Add route: `/cost-control`
  - [ ] Wrap in `ProtectedRoute`
- [ ] Update navigation menu
  - [ ] Add "Cost Control" link
  - [ ] Add icon (TrendingUp or DollarSign)
- [ ] Polish UI/UX
  - [ ] Responsive design (test mobile, tablet, desktop)
  - [ ] Color scheme (use theme colors)
  - [ ] Spacing and padding (consistent with app)
  - [ ] Loading states (skeletons, spinners)
  - [ ] Empty states ("No opportunities found")
- [ ] Error handling
  - [ ] API errors (show toast notification)
  - [ ] Network errors (retry button)
  - [ ] Validation errors (inline messages)
- [ ] Export to CSV functionality
  - [ ] Add export button to variance table
  - [ ] Add export button to benchmark table
  - [ ] Generate CSV from data
  - [ ] Trigger download
- [ ] Test full user flow:
  - [ ] Navigate to dashboard
  - [ ] View summary cards
  - [ ] Explore all tabs
  - [ ] Apply filters
  - [ ] Expand rows
  - [ ] Export CSV

---

### Phase 4: Testing & Polish (Days 10-11)

#### Day 10: Testing
- [ ] Backend unit tests
  - [ ] Run all tests: `npm run test`
  - [ ] Check coverage: `npm run test:coverage`
  - [ ] Fix any failing tests
  - [ ] Achieve 80%+ coverage
- [ ] Backend integration tests
  - [ ] Run API tests: `npm run test -- costControl.integration.test.ts`
  - [ ] Test all endpoints with authentication
  - [ ] Test error cases
  - [ ] Verify response structures
- [ ] Frontend component tests
  - [ ] Create `SummaryCards.test.tsx`
  - [ ] Create `PriceVarianceTable.test.tsx`
  - [ ] Mock API calls
  - [ ] Test rendering
  - [ ] Test user interactions
  - [ ] Run: `npm run test`
- [ ] E2E tests
  - [ ] Install Cypress: `npm install -D cypress`
  - [ ] Create `cypress/e2e/cost-control.cy.ts`
  - [ ] Test user flows (view dashboard, filter, expand rows)
  - [ ] Run: `npx cypress run`
- [ ] Performance tests
  - [ ] Install k6 or Artillery
  - [ ] Create load test script
  - [ ] Test with 50 concurrent users
  - [ ] Verify p95 latency < 2s
  - [ ] Check cache hit rate in Redis

#### Day 11: Production Readiness and Documentation
- [ ] Security audit
  - [ ] Verify authentication on all routes
  - [ ] Test SQL injection (Prisma prevents)
  - [ ] Test XSS (Zod sanitization)
  - [ ] Test authorization (role-based access if applicable)
- [ ] Monitoring and logging
  - [ ] Add request logging (Morgan or Winston)
  - [ ] Add error logging (Sentry or similar)
  - [ ] Configure alerts (high error rate, slow responses)
- [ ] Database optimization
  - [ ] Verify indexes exist on `SpendingMetric` table
  - [ ] Verify indexes exist on `PriceSnapshot` table
  - [ ] Run EXPLAIN on complex queries
  - [ ] Optimize slow queries
- [ ] API documentation
  - [ ] Create OpenAPI spec (Swagger)
  - [ ] Document all endpoints
  - [ ] Add example requests/responses
  - [ ] Deploy Swagger UI
- [ ] User guide
  - [ ] Create `docs/guides/cost-control-user-guide.md`
  - [ ] Add screenshots
  - [ ] Explain each feature
  - [ ] Add tips and best practices
- [ ] Debugging journal
  - [ ] Create `debugging_journals/2025-12-10-cost-control-feature.md`
  - [ ] Document common issues and solutions
  - [ ] Add troubleshooting steps
- [ ] Final verification
  - [ ] All acceptance criteria met
  - [ ] All checklist items completed
  - [ ] Feature works end-to-end
  - [ ] Ready for demo/production

---

## Appendix

### Dependencies to Install

**Backend**:
```bash
cd server
npm install ioredis  # If not already installed (for RedisService)
npm install bull     # If not already installed (for job queue)
npm install -D @types/bull
```

**Frontend**:
```bash
cd client
npm install recharts  # For charts
npm install lucide-react  # For icons (if not already installed)
npm install -D cypress  # For E2E testing
```

### Environment Variables

Add to `server/.env`:
```env
REDIS_URL=redis://localhost:6379
```

### Database Indexes

Verify these indexes exist (should be created by foundation migration):
```sql
-- SpendingMetric indexes
CREATE INDEX idx_spending_metric_date_branch_item ON "SpendingMetric"(date, "branchId", "itemId");
CREATE INDEX idx_spending_metric_date_vendor_item ON "SpendingMetric"(date, "vendorId", "itemId");
CREATE INDEX idx_spending_metric_item_branch_date ON "SpendingMetric"("itemId", "branchId", date);

-- PriceSnapshot indexes
CREATE INDEX idx_price_snapshot_item_date ON "PriceSnapshot"("itemId", date);
CREATE INDEX idx_price_snapshot_vendor_item_date ON "PriceSnapshot"("vendorId", "itemId", date);
CREATE INDEX idx_price_snapshot_branch_item_date ON "PriceSnapshot"("branchId", "itemId", date);
```

### Performance Targets

| Metric | Target |
|--------|--------|
| Dashboard page load | < 2 seconds |
| API response time (p95) | < 1 second (cold), < 200ms (cached) |
| Cache hit rate | > 80% |
| Concurrent users supported | 100+ |
| Database query time | < 500ms |

### Rollback Plan

If feature needs to be rolled back:

1. **Frontend**: Remove route from `App.tsx` and navigation menu
2. **Backend**: Comment out route registration in `index.ts`
3. **Database**: No schema changes required (foundation tables remain)
4. **Cache**: Clear Redis keys: `redis-cli KEYS "cost-control:*" | xargs redis-cli DEL`

---

## Ready for Implementation

**Foundation Status**: VERIFY DEPLOYED (see Dependencies section)

**Estimated Timeline**: 11 days (1 developer)

**Next Steps**:
1. Confirm Analytics Foundation is deployed and operational
2. Assign developer to Phase 1 (Backend Service)
3. Set up development environment (Redis, test database)
4. Begin Day 1 checklist

**Questions? Contact**: Solution Architect or Tech Lead

---

**Document End**
