# Implementation Plan: Invoice-Based Inventory Intelligence

**Document Version**: 1.0
**Date**: 2025-12-10
**Status**: Ready for Implementation
**Dependencies**: Analytics & Intelligence Foundation (Phase 0)
**Estimated Duration**: 16 days (3.2 weeks)

---

## Table of Contents

1. [Feature Overview](#1-feature-overview)
2. [Dependencies](#2-dependencies)
3. [Domain Model](#3-domain-model)
4. [Service Layer](#4-service-layer)
5. [API Endpoints](#5-api-endpoints)
6. [Frontend Components](#6-frontend-components)
7. [Implementation Phases](#7-implementation-phases)
8. [Testing Strategy](#8-testing-strategy)
9. [Acceptance Criteria](#9-acceptance-criteria)
10. [Implementation Checklist](#10-implementation-checklist)

---

## 1. Feature Overview

### Business Value

**Primary Goal**: Achieve 80% inventory visibility without manual counting by deriving stock levels from purchase patterns.

**Key Benefits**:
- Reduce stock-outs by 30% through predictive alerts
- Reduce overstocking waste by 20% through deviation detection
- Eliminate manual inventory counting overhead
- Enable data-driven reorder decisions
- Identify consumption anomalies early

### User Personas

#### Primary Users

**1. Procurement Officer (Marcus)**
- **Needs**: Predictive reorder alerts, consumption rate visibility, pattern analysis
- **Pain Points**: Manual stock tracking, reactive ordering, no visibility into upcoming stock-outs
- **Value**: Proactive ordering, reduced stock-outs, optimized inventory levels

**2. Branch Manager (Lisa)**
- **Needs**: Location-specific stock predictions, consumption trends, deviation alerts
- **Pain Points**: Overstocking perishables, emergency orders, budget overruns
- **Value**: Just-in-time ordering, waste reduction, budget control

#### Secondary Users

**3. Finance Manager (Sarah)**
- **Needs**: Spending pattern visibility, anomaly detection, budget forecasting
- **Pain Points**: Unexpected large orders, budget overruns, fraud detection
- **Value**: Financial oversight, anomaly alerts, predictive budgeting

### Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Stock-out Reduction | 30% decrease | Before/after comparison of emergency orders |
| Overstocking Reduction | 20% decrease | Waste/spoilage reports comparison |
| Prediction Accuracy | 80% within 7-day window | Predicted vs. actual order dates |
| Pattern Detection Coverage | 90% of items ordered 3+ times | Items with patterns / eligible items |
| User Adoption | 70% use reorder alerts weekly | Weekly active users on inventory dashboard |
| Time Savings | 10 hours/week per location | Time spent on manual inventory counting |

### Business Rules

#### Pattern Recognition Rules

**BR-001: Minimum Sample Size**
- Pattern detection requires minimum 3 purchases of same item at same location
- Confidence score increases with more data points (max 1.0 at 10+ purchases)

**BR-002: Order Cycle Calculation**
- Order cycle = average days between consecutive purchases
- Standard deviation tracks consistency
- Outliers (> 2 std deviations) excluded from cycle calculation

**BR-003: Consumption Rate**
- Consumption rate = average quantity per day (total quantity / total days)
- Calculated over last 90 days (configurable)
- Adjusted for seasonal patterns when detected

**BR-004: Pattern Validity**
- Pattern marked as "ACTIVE" if last order within 2x average cycle
- Pattern marked as "STALE" if last order > 2x average cycle
- Stale patterns excluded from predictions

**BR-005: Deviation Thresholds**
- **Minor deviation**: Quantity 1.5x - 2x normal
- **Major deviation**: Quantity > 2x normal
- **Underbuy**: Quantity < 0.5x normal

---

## 2. Dependencies

### Foundation Services (from Analytics Infrastructure)

#### 2.1 Database Models (Prisma Schema)

**Required Models** (from `server/prisma/schema.prisma`):
```prisma
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
```

**Existing Models Used**:
- `Invoice` (purchase history source)
- `InvoiceItem` (quantity and price data)
- `Item` (product information)
- `Branch` (location-specific patterns)
- `Vendor` (supplier context)
- `PurchaseOrder` (planned orders for validation)
- `DeliveryNote` (actual received quantities)

#### 2.2 Foundation Services

**PatternRecognitionService** (`server/src/services/analytics/patternRecognitionService.ts`)
- `analyzePurchasePattern(itemId, branchId?)`: Core pattern detection
- `detectOrderCycle(invoices)`: Calculate cycle metrics
- `predictNextOrder(pattern)`: Forecast next order date
- `detectAnomalies(pattern, recentInvoices)`: Flag deviations

**AggregationService** (`server/src/services/analytics/aggregationService.ts`)
- `computeDailySpendingMetrics(date)`: Pre-compute metrics
- Used for consumption rate calculations

**RedisService** (`server/src/services/redisService.ts`)
- Cache pattern data for fast retrieval
- Cache predictions to avoid repeated calculations

**JobQueueService** (`server/src/services/jobQueueService.ts`)
- Background job: `analyze-purchase-patterns` (daily)
- Pattern refresh scheduling

#### 2.3 Event Bus (PubSub)

**Events to Subscribe**:
- `invoice.approved` → Trigger pattern recalculation for affected items
- `invoice.deleted` → Invalidate cached patterns
- `deliveryNote.confirmed` → Update actual vs. predicted comparison

---

## 3. Domain Model

### 3.1 Value Objects

#### OrderCycle
```typescript
// server/src/domain/inventory/value-objects/OrderCycle.ts

/**
 * Represents the recurring cycle of ordering for an item.
 * Immutable value object.
 */
export class OrderCycle {
  private constructor(
    private readonly _avgCycleDays: number,
    private readonly _stdDeviation: number,
    private readonly _sampleSize: number
  ) {
    this.validate();
  }

  static create(avgCycleDays: number, stdDeviation: number, sampleSize: number): OrderCycle {
    return new OrderCycle(avgCycleDays, stdDeviation, sampleSize);
  }

  private validate(): void {
    if (this._avgCycleDays <= 0) {
      throw new Error('Order cycle must be positive');
    }
    if (this._stdDeviation < 0) {
      throw new Error('Standard deviation cannot be negative');
    }
    if (this._sampleSize < 2) {
      throw new Error('Minimum 2 orders required for cycle calculation');
    }
  }

  get avgCycleDays(): number { return this._avgCycleDays; }
  get stdDeviation(): number { return this._stdDeviation; }
  get sampleSize(): number { return this._sampleSize; }

  // Business logic methods
  isConsistent(): boolean {
    // Low std deviation relative to average = consistent
    const coefficientOfVariation = this._stdDeviation / this._avgCycleDays;
    return coefficientOfVariation < 0.3; // < 30% variation
  }

  predictNextDate(lastOrderDate: Date): Date {
    const nextDate = new Date(lastOrderDate);
    nextDate.setDate(nextDate.getDate() + Math.round(this._avgCycleDays));
    return nextDate;
  }

  getReorderAlertDate(lastOrderDate: Date, leadTimeDays: number = 2): Date {
    const nextOrderDate = this.predictNextDate(lastOrderDate);
    const alertDate = new Date(nextOrderDate);
    alertDate.setDate(alertDate.getDate() - leadTimeDays);
    return alertDate;
  }

  toJSON() {
    return {
      avgCycleDays: this._avgCycleDays,
      stdDeviation: this._stdDeviation,
      sampleSize: this._sampleSize,
      isConsistent: this.isConsistent(),
    };
  }
}
```

#### ConsumptionRate
```typescript
// server/src/domain/inventory/value-objects/ConsumptionRate.ts

/**
 * Represents the rate at which an item is consumed.
 * Immutable value object.
 */
export class ConsumptionRate {
  private constructor(
    private readonly _quantityPerDay: number,
    private readonly _unit: string, // e.g., "kg", "units", "liters"
    private readonly _periodDays: number
  ) {
    this.validate();
  }

  static create(quantityPerDay: number, unit: string, periodDays: number): ConsumptionRate {
    return new ConsumptionRate(quantityPerDay, unit, periodDays);
  }

  private validate(): void {
    if (this._quantityPerDay < 0) {
      throw new Error('Consumption rate cannot be negative');
    }
    if (this._periodDays <= 0) {
      throw new Error('Period must be positive');
    }
  }

  get quantityPerDay(): number { return this._quantityPerDay; }
  get unit(): string { return this._unit; }
  get periodDays(): number { return this._periodDays; }

  // Business logic methods
  estimateStockDays(currentStock: number): number {
    if (this._quantityPerDay === 0) return Infinity;
    return currentStock / this._quantityPerDay;
  }

  projectedConsumption(days: number): number {
    return this._quantityPerDay * days;
  }

  toJSON() {
    return {
      quantityPerDay: this._quantityPerDay,
      unit: this._unit,
      periodDays: this._periodDays,
    };
  }
}
```

#### StockLevel (Derived)
```typescript
// server/src/domain/inventory/value-objects/StockLevel.ts

export enum StockStatus {
  HEALTHY = 'HEALTHY',
  LOW = 'LOW',
  CRITICAL = 'CRITICAL',
  STOCKOUT_PREDICTED = 'STOCKOUT_PREDICTED',
  OVERSTOCKED = 'OVERSTOCKED',
}

/**
 * Derived stock level based on consumption patterns.
 * NOT stored in DB - calculated on demand.
 */
export class StockLevel {
  private constructor(
    private readonly _estimatedQuantity: number,
    private readonly _daysUntilReorder: number,
    private readonly _status: StockStatus,
    private readonly _confidence: number
  ) {}

  static fromPattern(
    lastOrderDate: Date,
    lastOrderQuantity: number,
    consumptionRate: ConsumptionRate,
    orderCycle: OrderCycle,
    confidence: number
  ): StockLevel {
    const daysSinceLastOrder = Math.floor(
      (Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Estimate remaining quantity
    const consumed = consumptionRate.projectedConsumption(daysSinceLastOrder);
    const estimatedQuantity = Math.max(0, lastOrderQuantity - consumed);

    // Calculate days until predicted reorder
    const nextOrderDate = orderCycle.predictNextDate(lastOrderDate);
    const daysUntilReorder = Math.floor(
      (nextOrderDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    // Determine status
    let status: StockStatus;
    if (daysUntilReorder < 0) {
      status = StockStatus.STOCKOUT_PREDICTED;
    } else if (estimatedQuantity <= 0) {
      status = StockStatus.CRITICAL;
    } else if (daysUntilReorder <= 2) {
      status = StockStatus.LOW;
    } else if (estimatedQuantity > lastOrderQuantity * 2) {
      status = StockStatus.OVERSTOCKED;
    } else {
      status = StockStatus.HEALTHY;
    }

    return new StockLevel(estimatedQuantity, daysUntilReorder, status, confidence);
  }

  get estimatedQuantity(): number { return this._estimatedQuantity; }
  get daysUntilReorder(): number { return this._daysUntilReorder; }
  get status(): StockStatus { return this._status; }
  get confidence(): number { return this._confidence; }

  needsReorder(): boolean {
    return this._status === StockStatus.LOW ||
           this._status === StockStatus.CRITICAL ||
           this._status === StockStatus.STOCKOUT_PREDICTED;
  }

  toJSON() {
    return {
      estimatedQuantity: this._estimatedQuantity,
      daysUntilReorder: this._daysUntilReorder,
      status: this._status,
      confidence: this._confidence,
      needsReorder: this.needsReorder(),
    };
  }
}
```

### 3.2 Domain Events

```typescript
// server/src/domain/inventory/events/PatternDetectedEvent.ts
export interface PatternDetectedEvent {
  type: 'inventory.pattern-detected';
  timestamp: Date;
  data: {
    itemId: number;
    branchId: number | null;
    avgOrderCycleDays: number;
    confidenceScore: number;
    basedOnInvoices: number;
  };
}

// server/src/domain/inventory/events/StockoutPredictedEvent.ts
export interface StockoutPredictedEvent {
  type: 'inventory.stockout-predicted';
  timestamp: Date;
  data: {
    itemId: number;
    itemName: string;
    branchId: number | null;
    branchName: string | null;
    predictedStockoutDate: Date;
    daysUntilStockout: number;
    confidence: number;
  };
}

// server/src/domain/inventory/events/OverstockingDetectedEvent.ts
export interface OverstockingDetectedEvent {
  type: 'inventory.overstocking-detected';
  timestamp: Date;
  data: {
    itemId: number;
    itemName: string;
    branchId: number | null;
    branchName: string | null;
    orderedQuantity: number;
    normalQuantity: number;
    deviationMultiple: number; // e.g., 3.0 = 3x normal
    invoiceId: number;
  };
}
```

### 3.3 Business Rules Summary

| Rule ID | Description | Implementation |
|---------|-------------|----------------|
| BR-001 | Minimum 3 orders for pattern | PatternRecognitionService validation |
| BR-002 | Outlier exclusion (>2σ) | detectOrderCycle method |
| BR-003 | 90-day consumption window | AggregationService query |
| BR-004 | Stale pattern detection (>2x cycle) | Pattern validity check |
| BR-005 | Deviation thresholds (1.5x, 2x, 0.5x) | detectAnomalies method |

---

## 4. Service Layer

### 4.1 InventoryIntelligenceService

**File**: `server/src/services/inventoryIntelligenceService.ts`

```typescript
import prisma from '../prisma';
import { PatternRecognitionService } from './analytics/patternRecognitionService';
import { AggregationService } from './analytics/aggregationService';
import { OrderCycle, ConsumptionRate, StockLevel, StockStatus } from '../domain/inventory/value-objects';
import { getOrSet, invalidate, CacheTTL, generateCacheKey } from './cacheService';
import pubsub from './pubsub';

export interface PurchasePatternResult {
  itemId: number;
  itemName: string;
  vendorId: number;
  vendorName: string;
  branchId: number | null;
  branchName: string | null;

  // Pattern metrics
  avgOrderCycleDays: number;
  avgOrderQuantity: number;
  avgOrderAmount: number;
  stdDevQuantity: number;
  stdDevAmount: number;

  // Trend indicators
  isIncreasing: boolean;
  isDecreasing: boolean;
  isSeasonal: boolean;

  // Predictions
  lastOrderDate: Date;
  nextPredictedOrder: Date;
  confidenceScore: number;

  // Derived insights
  isConsistent: boolean;
  status: 'ACTIVE' | 'STALE';
}

export interface StockPrediction {
  itemId: number;
  itemName: string;
  branchId: number | null;
  branchName: string | null;

  estimatedQuantity: number;
  daysUntilReorder: number;
  predictedReorderDate: Date;

  status: StockStatus;
  confidence: number;
  needsReorder: boolean;
}

export interface ReorderAlert {
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  itemId: number;
  itemName: string;
  branchId: number | null;
  branchName: string | null;
  vendorId: number;
  vendorName: string;

  daysUntilStockout: number;
  recommendedOrderDate: Date;
  recommendedQuantity: number;

  message: string;
  confidence: number;
}

export interface OverstockingAlert {
  severity: 'MINOR' | 'MAJOR';
  itemId: number;
  itemName: string;
  branchId: number | null;
  branchName: string | null;

  invoiceId: number;
  invoiceDate: Date;
  orderedQuantity: number;
  normalQuantity: number;
  deviationMultiple: number;

  message: string;
  possibleReasons: string[];
}

export class InventoryIntelligenceService {
  private patternService: PatternRecognitionService;
  private aggregationService: AggregationService;

  constructor() {
    this.patternService = new PatternRecognitionService();
    this.aggregationService = new AggregationService();
  }

  /**
   * Get purchase patterns for items, optionally filtered by item or branch.
   * Cached for 1 hour.
   */
  async getPurchasePatterns(filters: {
    itemId?: number;
    branchId?: number;
    includeStale?: boolean;
  }): Promise<PurchasePatternResult[]> {
    const cacheKey = generateCacheKey('inventory:patterns', filters);

    return getOrSet(cacheKey, CacheTTL.ANALYTICS_PATTERNS, async () => {
      const where: any = {};
      if (filters.itemId) where.itemId = filters.itemId;
      if (filters.branchId) where.branchId = filters.branchId;

      const patterns = await prisma.purchasePattern.findMany({
        where,
        include: {
          item: {
            include: { vendor: true }
          },
          branch: true,
        },
        orderBy: { confidenceScore: 'desc' },
      });

      const now = new Date();

      return patterns
        .map(p => {
          const daysSinceLastOrder = p.lastOrderDate
            ? Math.floor((now.getTime() - p.lastOrderDate.getTime()) / (1000 * 60 * 60 * 24))
            : Infinity;

          const isStale = daysSinceLastOrder > (p.avgOrderCycleDays * 2);

          if (!filters.includeStale && isStale) return null;

          const orderCycle = OrderCycle.create(
            p.avgOrderCycleDays,
            p.stdDevQuantity,
            p.basedOnInvoices
          );

          return {
            itemId: p.itemId,
            itemName: p.item.name,
            vendorId: p.item.vendorId,
            vendorName: p.item.vendor.name,
            branchId: p.branchId,
            branchName: p.branch?.name || null,

            avgOrderCycleDays: p.avgOrderCycleDays,
            avgOrderQuantity: p.avgOrderQuantity,
            avgOrderAmount: p.avgOrderAmount,
            stdDevQuantity: p.stdDevQuantity,
            stdDevAmount: p.stdDevAmount,

            isIncreasing: p.isIncreasing,
            isDecreasing: p.isDecreasing,
            isSeasonal: p.isSeasonal,

            lastOrderDate: p.lastOrderDate!,
            nextPredictedOrder: p.nextPredictedOrder!,
            confidenceScore: p.confidenceScore,

            isConsistent: orderCycle.isConsistent(),
            status: isStale ? 'STALE' : 'ACTIVE',
          };
        })
        .filter(p => p !== null) as PurchasePatternResult[];
    });
  }

  /**
   * Predict stock levels for items based on patterns.
   * Cached for 30 minutes.
   */
  async predictStockLevels(filters: {
    itemId?: number;
    branchId?: number;
    statusFilter?: StockStatus[];
  }): Promise<StockPrediction[]> {
    const cacheKey = generateCacheKey('inventory:predictions', filters);

    return getOrSet(cacheKey, CacheTTL.ANALYTICS_PREDICTIONS, async () => {
      const patterns = await this.getPurchasePatterns({
        itemId: filters.itemId,
        branchId: filters.branchId,
        includeStale: false, // Only active patterns
      });

      const predictions: StockPrediction[] = [];

      for (const pattern of patterns) {
        // Calculate consumption rate
        const consumptionRate = ConsumptionRate.create(
          pattern.avgOrderQuantity / pattern.avgOrderCycleDays,
          'units', // TODO: Get from item metadata
          pattern.avgOrderCycleDays
        );

        const orderCycle = OrderCycle.create(
          pattern.avgOrderCycleDays,
          pattern.stdDevQuantity,
          Math.floor(pattern.avgOrderQuantity) // Sample size approximation
        );

        const stockLevel = StockLevel.fromPattern(
          pattern.lastOrderDate,
          pattern.avgOrderQuantity,
          consumptionRate,
          orderCycle,
          pattern.confidenceScore
        );

        const prediction: StockPrediction = {
          itemId: pattern.itemId,
          itemName: pattern.itemName,
          branchId: pattern.branchId,
          branchName: pattern.branchName,

          estimatedQuantity: stockLevel.estimatedQuantity,
          daysUntilReorder: stockLevel.daysUntilReorder,
          predictedReorderDate: pattern.nextPredictedOrder,

          status: stockLevel.status,
          confidence: stockLevel.confidence,
          needsReorder: stockLevel.needsReorder(),
        };

        // Apply status filter if provided
        if (!filters.statusFilter || filters.statusFilter.includes(prediction.status)) {
          predictions.push(prediction);
        }
      }

      return predictions.sort((a, b) => a.daysUntilReorder - b.daysUntilReorder);
    });
  }

  /**
   * Get reorder alerts for items approaching stock-out.
   * Cached for 15 minutes.
   */
  async getReorderAlerts(filters: {
    branchId?: number;
    priorityFilter?: ('LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')[];
  }): Promise<ReorderAlert[]> {
    const cacheKey = generateCacheKey('inventory:reorder-alerts', filters);

    return getOrSet(cacheKey, CacheTTL.ANALYTICS_ALERTS, async () => {
      const predictions = await this.predictStockLevels({
        branchId: filters.branchId,
        statusFilter: [
          StockStatus.LOW,
          StockStatus.CRITICAL,
          StockStatus.STOCKOUT_PREDICTED,
        ],
      });

      const alerts: ReorderAlert[] = predictions.map(pred => {
        // Determine priority based on days until stockout
        let priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        if (pred.daysUntilReorder < 0) {
          priority = 'CRITICAL';
        } else if (pred.daysUntilReorder <= 1) {
          priority = 'HIGH';
        } else if (pred.daysUntilReorder <= 3) {
          priority = 'MEDIUM';
        } else {
          priority = 'LOW';
        }

        // Find pattern to get vendor info
        const pattern = this.findPatternFromCache(pred.itemId, pred.branchId);

        // Calculate recommended order date (2 days before predicted reorder)
        const recommendedOrderDate = new Date(pred.predictedReorderDate);
        recommendedOrderDate.setDate(recommendedOrderDate.getDate() - 2);

        const alert: ReorderAlert = {
          priority,
          itemId: pred.itemId,
          itemName: pred.itemName,
          branchId: pred.branchId,
          branchName: pred.branchName,
          vendorId: pattern?.vendorId || 0,
          vendorName: pattern?.vendorName || 'Unknown',

          daysUntilStockout: pred.daysUntilReorder,
          recommendedOrderDate,
          recommendedQuantity: Math.round(pred.estimatedQuantity), // Use avg from pattern

          message: this.generateReorderMessage(pred, priority),
          confidence: pred.confidence,
        };

        return alert;
      });

      // Apply priority filter if provided
      const filtered = filters.priorityFilter
        ? alerts.filter(a => filters.priorityFilter!.includes(a.priority))
        : alerts;

      return filtered.sort((a, b) => {
        const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
    });
  }

  /**
   * Detect overstocking - when order quantity significantly exceeds normal.
   * Analyzes recent invoices (last 30 days).
   */
  async detectOverstocking(filters: {
    branchId?: number;
    days?: number;
  }): Promise<OverstockingAlert[]> {
    const days = filters.days || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const where: any = {
      deletedAt: null,
      status: 'APPROVED',
      date: { gte: cutoffDate },
    };
    if (filters.branchId) where.branchId = filters.branchId;

    const recentInvoices = await prisma.invoice.findMany({
      where,
      include: {
        items: {
          include: {
            item: {
              include: { vendor: true },
            },
          },
        },
        branch: true,
      },
      orderBy: { date: 'desc' },
    });

    const alerts: OverstockingAlert[] = [];

    for (const invoice of recentInvoices) {
      for (const invItem of invoice.items) {
        // Get pattern for this item/branch
        const patterns = await this.getPurchasePatterns({
          itemId: invItem.itemId,
          branchId: invoice.branchId,
          includeStale: false,
        });

        if (patterns.length === 0) continue;

        const pattern = patterns[0];
        const deviationMultiple = invItem.quantity / pattern.avgOrderQuantity;

        // Detect overstocking (>1.5x normal is minor, >2x is major)
        if (deviationMultiple >= 1.5) {
          const severity = deviationMultiple >= 2.0 ? 'MAJOR' : 'MINOR';

          const alert: OverstockingAlert = {
            severity,
            itemId: invItem.itemId,
            itemName: invItem.item.name,
            branchId: invoice.branchId,
            branchName: invoice.branch?.name || null,

            invoiceId: invoice.id,
            invoiceDate: invoice.date,
            orderedQuantity: invItem.quantity,
            normalQuantity: pattern.avgOrderQuantity,
            deviationMultiple,

            message: this.generateOverstockingMessage(invItem.item.name, deviationMultiple),
            possibleReasons: this.suggestOverstockingReasons(deviationMultiple, pattern),
          };

          alerts.push(alert);

          // Publish event for major overstocking
          if (severity === 'MAJOR') {
            pubsub.publish('inventory.overstocking-detected', {
              type: 'inventory.overstocking-detected',
              timestamp: new Date(),
              data: {
                itemId: invItem.itemId,
                itemName: invItem.item.name,
                branchId: invoice.branchId,
                branchName: invoice.branch?.name || null,
                orderedQuantity: invItem.quantity,
                normalQuantity: pattern.avgOrderQuantity,
                deviationMultiple,
                invoiceId: invoice.id,
              },
            });
          }
        }
      }
    }

    return alerts.sort((a, b) => b.deviationMultiple - a.deviationMultiple);
  }

  /**
   * Analyze pattern accuracy by comparing predictions to actual orders.
   * Used for calibration and confidence tuning.
   */
  async analyzePatternAccuracy(itemId: number, branchId?: number): Promise<{
    predictions: number;
    correct: number;
    early: number;
    late: number;
    accuracy: number;
    avgDaysOff: number;
  }> {
    // Get pattern
    const patterns = await this.getPurchasePatterns({ itemId, branchId, includeStale: true });
    if (patterns.length === 0) {
      throw new Error(`No pattern found for item ${itemId}`);
    }

    const pattern = patterns[0];

    // Get all invoices for this item/branch
    const where: any = {
      deletedAt: null,
      status: 'APPROVED',
      branchId: branchId || null,
      items: {
        some: { itemId },
      },
    };

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    if (invoices.length < 3) {
      return {
        predictions: 0,
        correct: 0,
        early: 0,
        late: 0,
        accuracy: 0,
        avgDaysOff: 0,
      };
    }

    // Compare predicted vs. actual dates
    let correct = 0;
    let early = 0;
    let late = 0;
    let totalDaysOff = 0;

    for (let i = 1; i < invoices.length; i++) {
      const prevInvoice = invoices[i - 1];
      const actualInvoice = invoices[i];

      const predictedDate = new Date(prevInvoice.date);
      predictedDate.setDate(predictedDate.getDate() + Math.round(pattern.avgOrderCycleDays));

      const actualDate = actualInvoice.date;
      const daysOff = Math.floor(
        (actualDate.getTime() - predictedDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      totalDaysOff += Math.abs(daysOff);

      if (Math.abs(daysOff) <= 2) {
        correct++;
      } else if (daysOff < 0) {
        early++;
      } else {
        late++;
      }
    }

    const predictions = invoices.length - 1;
    const accuracy = predictions > 0 ? (correct / predictions) * 100 : 0;
    const avgDaysOff = predictions > 0 ? totalDaysOff / predictions : 0;

    return {
      predictions,
      correct,
      early,
      late,
      accuracy: Math.round(accuracy * 100) / 100,
      avgDaysOff: Math.round(avgDaysOff * 100) / 100,
    };
  }

  // ===== PRIVATE HELPER METHODS =====

  private findPatternFromCache(itemId: number, branchId: number | null): PurchasePatternResult | undefined {
    // This is a simplified implementation - in production, maintain an in-memory cache
    // For now, return undefined and handle in caller
    return undefined;
  }

  private generateReorderMessage(pred: StockPrediction, priority: string): string {
    if (priority === 'CRITICAL') {
      return `URGENT: ${pred.itemName} predicted stockout ${Math.abs(pred.daysUntilReorder)} days ago!`;
    } else if (priority === 'HIGH') {
      return `${pred.itemName} needs reorder within ${pred.daysUntilReorder} day(s)`;
    } else if (priority === 'MEDIUM') {
      return `${pred.itemName} recommend ordering within ${pred.daysUntilReorder} days`;
    } else {
      return `${pred.itemName} reorder suggested in ${pred.daysUntilReorder} days`;
    }
  }

  private generateOverstockingMessage(itemName: string, multiple: number): string {
    const percentage = Math.round((multiple - 1) * 100);
    return `${itemName} ordered ${percentage}% above normal quantity (${multiple.toFixed(1)}x usual amount)`;
  }

  private suggestOverstockingReasons(multiple: number, pattern: PurchasePatternResult): string[] {
    const reasons: string[] = [];

    if (multiple >= 3.0) {
      reasons.push('Possible bulk order or special event');
      reasons.push('Check for data entry error');
    } else if (multiple >= 2.0) {
      reasons.push('May be stocking up for anticipated demand increase');
      reasons.push('Verify with procurement team');
    } else {
      reasons.push('Minor deviation - may be normal fluctuation');
    }

    if (pattern.isSeasonal) {
      reasons.push('Seasonal item - check if this aligns with season');
    }

    if (pattern.isIncreasing) {
      reasons.push('Item has increasing demand trend');
    }

    return reasons;
  }
}
```

### 4.2 Background Job Integration

**File**: `server/src/jobs/analyzePurchasePatterns.ts`

```typescript
import { InventoryIntelligenceService } from '../services/inventoryIntelligenceService';
import { PatternRecognitionService } from '../services/analytics/patternRecognitionService';
import logger from '../logger';

/**
 * Daily background job to analyze purchase patterns.
 * Updates PurchasePattern table with latest insights.
 */
export async function analyzePurchasePatternsJob(): Promise<void> {
  logger.info('Starting purchase pattern analysis job');
  const startTime = Date.now();

  try {
    const patternService = new PatternRecognitionService();
    const inventoryService = new InventoryIntelligenceService();

    // Get all items that have been purchased at least 3 times
    const eligibleItems = await findEligibleItems();

    logger.info(`Found ${eligibleItems.length} items eligible for pattern analysis`);

    let updated = 0;
    let created = 0;
    let skipped = 0;

    for (const { itemId, branchId } of eligibleItems) {
      try {
        const pattern = await patternService.analyzePurchasePattern(itemId, branchId);

        if (pattern) {
          // Upsert pattern to database
          await prisma.purchasePattern.upsert({
            where: {
              itemId_branchId: { itemId, branchId: branchId || null },
            },
            create: {
              itemId,
              branchId: branchId || null,
              ...pattern,
            },
            update: pattern,
          });

          if (pattern.basedOnInvoices >= 3) {
            created++;
          } else {
            updated++;
          }
        } else {
          skipped++;
        }
      } catch (error) {
        logger.error(`Error analyzing pattern for item ${itemId}, branch ${branchId}:`, error);
      }
    }

    const duration = Date.now() - startTime;
    logger.info(
      `Purchase pattern analysis complete: ${created} created, ${updated} updated, ${skipped} skipped (${duration}ms)`
    );

    // Invalidate caches
    await invalidate('inventory:patterns*');
    await invalidate('inventory:predictions*');

  } catch (error) {
    logger.error('Purchase pattern analysis job failed:', error);
    throw error;
  }
}

async function findEligibleItems(): Promise<{ itemId: number; branchId: number | null }[]> {
  // Find items with at least 3 approved invoices
  const results = await prisma.$queryRaw<{ itemId: number; branchId: number | null; count: number }[]>`
    SELECT
      ii."itemId",
      i."branchId",
      COUNT(*) as count
    FROM "InvoiceItem" ii
    JOIN "Invoice" i ON i.id = ii."invoiceId"
    WHERE i."deletedAt" IS NULL
      AND i.status = 'APPROVED'
    GROUP BY ii."itemId", i."branchId"
    HAVING COUNT(*) >= 3
    ORDER BY count DESC
  `;

  return results.map(r => ({ itemId: r.itemId, branchId: r.branchId }));
}
```

---

## 5. API Endpoints

### 5.1 Endpoint Specifications

#### GET /api/analytics/inventory/patterns

**Purpose**: Retrieve purchase patterns for items

**Query Parameters**:
```typescript
{
  itemId?: number;        // Filter by specific item
  branchId?: number;      // Filter by specific branch
  includeStale?: boolean; // Include patterns with no recent orders (default: false)
}
```

**Response** (200 OK):
```json
{
  "data": [
    {
      "itemId": 123,
      "itemName": "Chicken Breast (Fresh)",
      "vendorId": 45,
      "vendorName": "FreshMeats Inc",
      "branchId": 2,
      "branchName": "Downtown Location",

      "avgOrderCycleDays": 4.2,
      "avgOrderQuantity": 50,
      "avgOrderAmount": 425.00,
      "stdDevQuantity": 8.5,
      "stdDevAmount": 72.25,

      "isIncreasing": false,
      "isDecreasing": false,
      "isSeasonal": false,

      "lastOrderDate": "2025-12-08T00:00:00Z",
      "nextPredictedOrder": "2025-12-12T00:00:00Z",
      "confidenceScore": 0.85,

      "isConsistent": true,
      "status": "ACTIVE"
    }
  ]
}
```

**Route Implementation**:
```typescript
// server/src/routes/analytics.ts

router.get('/analytics/inventory/patterns', requireAuth, async (req, res) => {
  try {
    const filters = {
      itemId: req.query.itemId ? parseInt(req.query.itemId as string) : undefined,
      branchId: req.query.branchId ? parseInt(req.query.branchId as string) : undefined,
      includeStale: req.query.includeStale === 'true',
    };

    const inventoryService = new InventoryIntelligenceService();
    const patterns = await inventoryService.getPurchasePatterns(filters);

    res.json({ data: patterns });
  } catch (error) {
    logger.error('Error fetching purchase patterns:', error);
    res.status(500).json({ error: 'Failed to fetch purchase patterns' });
  }
});
```

---

#### GET /api/analytics/inventory/stock-predictions

**Purpose**: Get predicted stock levels based on consumption patterns

**Query Parameters**:
```typescript
{
  itemId?: number;
  branchId?: number;
  status?: StockStatus[];  // Filter by status (LOW, CRITICAL, etc.)
}
```

**Response** (200 OK):
```json
{
  "data": [
    {
      "itemId": 123,
      "itemName": "Chicken Breast (Fresh)",
      "branchId": 2,
      "branchName": "Downtown Location",

      "estimatedQuantity": 12.5,
      "daysUntilReorder": 2,
      "predictedReorderDate": "2025-12-12T00:00:00Z",

      "status": "LOW",
      "confidence": 0.85,
      "needsReorder": true
    }
  ]
}
```

**Route Implementation**:
```typescript
router.get('/analytics/inventory/stock-predictions', requireAuth, async (req, res) => {
  try {
    const filters = {
      itemId: req.query.itemId ? parseInt(req.query.itemId as string) : undefined,
      branchId: req.query.branchId ? parseInt(req.query.branchId as string) : undefined,
      statusFilter: req.query.status
        ? (req.query.status as string).split(',') as StockStatus[]
        : undefined,
    };

    const inventoryService = new InventoryIntelligenceService();
    const predictions = await inventoryService.predictStockLevels(filters);

    res.json({ data: predictions });
  } catch (error) {
    logger.error('Error fetching stock predictions:', error);
    res.status(500).json({ error: 'Failed to fetch stock predictions' });
  }
});
```

---

#### GET /api/analytics/inventory/reorder-alerts

**Purpose**: Get actionable reorder alerts for items approaching stock-out

**Query Parameters**:
```typescript
{
  branchId?: number;
  priority?: ('LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')[];
}
```

**Response** (200 OK):
```json
{
  "data": [
    {
      "priority": "HIGH",
      "itemId": 123,
      "itemName": "Chicken Breast (Fresh)",
      "branchId": 2,
      "branchName": "Downtown Location",
      "vendorId": 45,
      "vendorName": "FreshMeats Inc",

      "daysUntilStockout": 1,
      "recommendedOrderDate": "2025-12-10T00:00:00Z",
      "recommendedQuantity": 50,

      "message": "Chicken Breast (Fresh) needs reorder within 1 day(s)",
      "confidence": 0.85
    }
  ]
}
```

---

#### GET /api/analytics/inventory/overstocking-alerts

**Purpose**: Detect recent orders that significantly exceed normal patterns

**Query Parameters**:
```typescript
{
  branchId?: number;
  days?: number;  // Lookback period (default: 30)
}
```

**Response** (200 OK):
```json
{
  "data": [
    {
      "severity": "MAJOR",
      "itemId": 456,
      "itemName": "Flour (25kg)",
      "branchId": 3,
      "branchName": "Westside Location",

      "invoiceId": 789,
      "invoiceDate": "2025-12-08T00:00:00Z",
      "orderedQuantity": 200,
      "normalQuantity": 50,
      "deviationMultiple": 4.0,

      "message": "Flour (25kg) ordered 300% above normal quantity (4.0x usual amount)",
      "possibleReasons": [
        "Possible bulk order or special event",
        "Check for data entry error"
      ]
    }
  ]
}
```

---

#### GET /api/analytics/inventory/pattern-accuracy/:itemId

**Purpose**: Analyze prediction accuracy for calibration

**Path Parameters**:
- `itemId` (number): Item to analyze

**Query Parameters**:
```typescript
{
  branchId?: number;
}
```

**Response** (200 OK):
```json
{
  "itemId": 123,
  "itemName": "Chicken Breast (Fresh)",
  "branchId": 2,
  "branchName": "Downtown Location",

  "accuracy": {
    "predictions": 20,
    "correct": 16,
    "early": 2,
    "late": 2,
    "accuracy": 80.00,
    "avgDaysOff": 1.25
  }
}
```

---

## 6. Frontend Components

### 6.1 Inventory Intelligence Dashboard

**File**: `client/src/pages/InventoryIntelligence.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Package,
  Calendar,
  AlertTriangle,
} from 'lucide-react';

import { PurchasePatternTimeline } from '@/components/inventory/PurchasePatternTimeline';
import { StockPredictionCards } from '@/components/inventory/StockPredictionCards';
import { ReorderAlertList } from '@/components/inventory/ReorderAlertList';
import { OverstockingAlertList } from '@/components/inventory/OverstockingAlertList';

import { inventoryService } from '@/services/inventoryService';

export default function InventoryIntelligence() {
  const [activeTab, setActiveTab] = useState('reorder-alerts');
  const [branchFilter, setBranchFilter] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const [reorderAlerts, setReorderAlerts] = useState([]);
  const [overstockingAlerts, setOverstockingAlerts] = useState([]);
  const [criticalCount, setCriticalCount] = useState(0);
  const [highCount, setHighCount] = useState(0);

  useEffect(() => {
    loadDashboardData();
  }, [branchFilter]);

  async function loadDashboardData() {
    try {
      setLoading(true);

      const [reorderData, overstockData] = await Promise.all([
        inventoryService.getReorderAlerts({ branchId: branchFilter }),
        inventoryService.getOverstockingAlerts({ branchId: branchFilter }),
      ]);

      setReorderAlerts(reorderData.data);
      setOverstockingAlerts(overstockData.data);

      // Calculate counts
      setCriticalCount(reorderData.data.filter(a => a.priority === 'CRITICAL').length);
      setHighCount(reorderData.data.filter(a => a.priority === 'HIGH').length);

    } catch (error) {
      console.error('Failed to load inventory intelligence data:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Intelligence</h1>
          <p className="text-gray-600">Smart stock predictions without manual counting</p>
        </div>

        {/* Branch Filter */}
        <select
          value={branchFilter || ''}
          onChange={(e) => setBranchFilter(e.target.value ? parseInt(e.target.value) : undefined)}
          className="px-4 py-2 border rounded-md"
        >
          <option value="">All Locations</option>
          {/* TODO: Load branches dynamically */}
        </select>
      </div>

      {/* Alert Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Critical Alerts</p>
                <p className="text-3xl font-bold text-red-600">{criticalCount}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">High Priority</p>
                <p className="text-3xl font-bold text-orange-600">{highCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Overstocking</p>
                <p className="text-3xl font-bold text-yellow-600">{overstockingAlerts.length}</p>
              </div>
              <Package className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Items Tracked</p>
                <p className="text-3xl font-bold text-blue-600">--</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="reorder-alerts">
            Reorder Alerts {criticalCount + highCount > 0 && (
              <Badge variant="destructive" className="ml-2">{criticalCount + highCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="stock-predictions">Stock Predictions</TabsTrigger>
          <TabsTrigger value="patterns">Purchase Patterns</TabsTrigger>
          <TabsTrigger value="overstocking">
            Overstocking {overstockingAlerts.length > 0 && (
              <Badge variant="warning" className="ml-2">{overstockingAlerts.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reorder-alerts" className="space-y-4">
          {loading ? (
            <div>Loading...</div>
          ) : (
            <ReorderAlertList alerts={reorderAlerts} onRefresh={loadDashboardData} />
          )}
        </TabsContent>

        <TabsContent value="stock-predictions" className="space-y-4">
          <StockPredictionCards branchId={branchFilter} />
        </TabsContent>

        <TabsContent value="patterns" className="space-y-4">
          <PurchasePatternTimeline branchId={branchFilter} />
        </TabsContent>

        <TabsContent value="overstocking" className="space-y-4">
          {loading ? (
            <div>Loading...</div>
          ) : (
            <OverstockingAlertList alerts={overstockingAlerts} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### 6.2 Reorder Alert List Component

**File**: `client/src/components/inventory/ReorderAlertList.tsx`

```typescript
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Calendar, Package, ShoppingCart } from 'lucide-react';

interface ReorderAlert {
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  itemId: number;
  itemName: string;
  branchName: string | null;
  vendorName: string;
  daysUntilStockout: number;
  recommendedOrderDate: string;
  recommendedQuantity: number;
  message: string;
  confidence: number;
}

export function ReorderAlertList({
  alerts,
  onRefresh
}: {
  alerts: ReorderAlert[];
  onRefresh: () => void;
}) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'destructive';
      case 'HIGH': return 'warning';
      case 'MEDIUM': return 'default';
      case 'LOW': return 'secondary';
      default: return 'default';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
      case 'HIGH':
        return <AlertCircle className="h-5 w-5" />;
      default:
        return <Package className="h-5 w-5" />;
    }
  };

  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-gray-500">
            <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No reorder alerts at this time</p>
            <p className="text-sm">All items are well-stocked</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert, index) => (
        <Card key={index} className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4 flex-1">
                {/* Priority Icon */}
                <div className="flex-shrink-0">
                  <Badge variant={getPriorityColor(alert.priority)} className="flex items-center gap-1">
                    {getPriorityIcon(alert.priority)}
                    {alert.priority}
                  </Badge>
                </div>

                {/* Alert Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold">{alert.itemName}</h3>
                    {alert.branchName && (
                      <Badge variant="outline">{alert.branchName}</Badge>
                    )}
                  </div>

                  <p className="text-sm text-gray-600 mb-3">{alert.message}</p>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span>Order by: {new Date(alert.recommendedOrderDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-gray-500" />
                      <span>Quantity: {alert.recommendedQuantity} units</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4 text-gray-500" />
                      <span>Vendor: {alert.vendorName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Confidence: {Math.round(alert.confidence * 100)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 ml-4">
                <Button size="sm" variant="default">
                  Create PO
                </Button>
                <Button size="sm" variant="outline">
                  View Details
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### 6.3 Purchase Pattern Timeline Component

**File**: `client/src/components/inventory/PurchasePatternTimeline.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Calendar, Package } from 'lucide-react';
import { inventoryService } from '@/services/inventoryService';

export function PurchasePatternTimeline({ branchId }: { branchId?: number }) {
  const [patterns, setPatterns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPatterns();
  }, [branchId]);

  async function loadPatterns() {
    try {
      setLoading(true);
      const response = await inventoryService.getPurchasePatterns({
        branchId,
        includeStale: false
      });
      setPatterns(response.data);
    } catch (error) {
      console.error('Failed to load patterns:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (patterns.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-gray-500">
          <p>No patterns detected yet</p>
          <p className="text-sm">Patterns require at least 3 orders</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {patterns.map((pattern, index) => (
        <Card key={index}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold">{pattern.itemName}</h3>
                  <Badge variant="outline">{pattern.vendorName}</Badge>
                  {pattern.branchName && (
                    <Badge variant="secondary">{pattern.branchName}</Badge>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Order Cycle</p>
                    <p className="text-xl font-semibold flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Every {pattern.avgOrderCycleDays.toFixed(1)} days
                    </p>
                    {pattern.isConsistent && (
                      <Badge variant="success" size="sm">Consistent</Badge>
                    )}
                  </div>

                  <div>
                    <p className="text-gray-600">Avg Quantity</p>
                    <p className="text-xl font-semibold flex items-center gap-1">
                      <Package className="h-4 w-4" />
                      {Math.round(pattern.avgOrderQuantity)} units
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-600">Confidence</p>
                    <p className="text-xl font-semibold">
                      {Math.round(pattern.confidenceScore * 100)}%
                    </p>
                  </div>
                </div>

                {/* Trend Indicators */}
                <div className="flex items-center gap-2 mt-3">
                  {pattern.isIncreasing && (
                    <Badge variant="default" className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Increasing Demand
                    </Badge>
                  )}
                  {pattern.isDecreasing && (
                    <Badge variant="warning" className="flex items-center gap-1">
                      <TrendingDown className="h-3 w-3" />
                      Decreasing Demand
                    </Badge>
                  )}
                  {pattern.isSeasonal && (
                    <Badge variant="secondary">Seasonal</Badge>
                  )}
                </div>

                {/* Timeline */}
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-gray-600">Last Order</p>
                      <p className="font-medium">
                        {new Date(pattern.lastOrderDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-center">
                      <div className="h-1 w-32 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" />
                      <p className="text-xs text-gray-500 mt-1">
                        {pattern.avgOrderCycleDays.toFixed(1)} days
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Next Predicted</p>
                      <p className="font-medium">
                        {new Date(pattern.nextPredictedOrder).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### 6.4 API Service

**File**: `client/src/services/inventoryService.ts`

```typescript
import api from '@/lib/api';

export const inventoryService = {
  async getPurchasePatterns(filters: {
    itemId?: number;
    branchId?: number;
    includeStale?: boolean;
  }) {
    const params = new URLSearchParams();
    if (filters.itemId) params.append('itemId', filters.itemId.toString());
    if (filters.branchId) params.append('branchId', filters.branchId.toString());
    if (filters.includeStale) params.append('includeStale', 'true');

    const response = await api.get(`/analytics/inventory/patterns?${params}`);
    return response.data;
  },

  async getStockPredictions(filters: {
    itemId?: number;
    branchId?: number;
    status?: string[];
  }) {
    const params = new URLSearchParams();
    if (filters.itemId) params.append('itemId', filters.itemId.toString());
    if (filters.branchId) params.append('branchId', filters.branchId.toString());
    if (filters.status) params.append('status', filters.status.join(','));

    const response = await api.get(`/analytics/inventory/stock-predictions?${params}`);
    return response.data;
  },

  async getReorderAlerts(filters: {
    branchId?: number;
    priority?: string[];
  }) {
    const params = new URLSearchParams();
    if (filters.branchId) params.append('branchId', filters.branchId.toString());
    if (filters.priority) params.append('priority', filters.priority.join(','));

    const response = await api.get(`/analytics/inventory/reorder-alerts?${params}`);
    return response.data;
  },

  async getOverstockingAlerts(filters: {
    branchId?: number;
    days?: number;
  }) {
    const params = new URLSearchParams();
    if (filters.branchId) params.append('branchId', filters.branchId.toString());
    if (filters.days) params.append('days', filters.days.toString());

    const response = await api.get(`/analytics/inventory/overstocking-alerts?${params}`);
    return response.data;
  },

  async getPatternAccuracy(itemId: number, branchId?: number) {
    const params = new URLSearchParams();
    if (branchId) params.append('branchId', branchId.toString());

    const response = await api.get(`/analytics/inventory/pattern-accuracy/${itemId}?${params}`);
    return response.data;
  },
};
```

---

## 7. Implementation Phases

### Phase 1: Pattern Learning Logic (4 days)

**Sprint Goal**: Implement core pattern detection algorithms

**Tasks**:
1. **Value Objects** (1 day)
   - [ ] Implement `OrderCycle` value object with validation
   - [ ] Implement `ConsumptionRate` value object
   - [ ] Implement `StockLevel` derived value object
   - [ ] Write unit tests for all value objects (TDD)

2. **Pattern Recognition Enhancement** (2 days)
   - [ ] Extend `PatternRecognitionService.analyzePurchasePattern()`
   - [ ] Implement outlier detection (>2σ exclusion)
   - [ ] Calculate trend indicators (increasing, decreasing, seasonal)
   - [ ] Write unit tests for pattern detection logic

3. **Background Job** (1 day)
   - [ ] Create `analyzePurchasePatternsJob()` function
   - [ ] Implement eligible item finder (≥3 orders)
   - [ ] Add job scheduling (daily 2am)
   - [ ] Test job execution and error handling

**Deliverables**:
- Value objects with 100% test coverage
- Pattern detection algorithm with 80%+ accuracy
- Background job running successfully

**Acceptance Criteria**:
- [ ] Patterns detected for items with ≥3 orders
- [ ] Confidence score increases with sample size
- [ ] Outliers correctly excluded from cycle calculation
- [ ] Background job completes without errors

---

### Phase 2: Prediction Algorithms (3 days)

**Sprint Goal**: Implement stock-out prediction and consumption rate calculation

**Tasks**:
1. **InventoryIntelligenceService** (2 days)
   - [ ] Implement `getPurchasePatterns()` with caching
   - [ ] Implement `predictStockLevels()` method
   - [ ] Implement stock status determination logic
   - [ ] Write integration tests against test database

2. **Alert Generation** (1 day)
   - [ ] Implement `getReorderAlerts()` method
   - [ ] Implement priority calculation (CRITICAL/HIGH/MEDIUM/LOW)
   - [ ] Implement `detectOverstocking()` method
   - [ ] Publish domain events for major alerts

**Deliverables**:
- `InventoryIntelligenceService` fully implemented
- Stock predictions with 80%+ accuracy
- Reorder alerts with correct prioritization

**Acceptance Criteria**:
- [ ] Stock levels calculated correctly based on consumption
- [ ] Reorder alerts generated 2 days before predicted stock-out
- [ ] Overstocking detected for orders >1.5x normal
- [ ] Events published for critical alerts

---

### Phase 3: API Endpoints (2 days)

**Sprint Goal**: Expose inventory intelligence via REST API

**Tasks**:
1. **Route Implementation** (1 day)
   - [ ] Add `/api/analytics/inventory/patterns` endpoint
   - [ ] Add `/api/analytics/inventory/stock-predictions` endpoint
   - [ ] Add `/api/analytics/inventory/reorder-alerts` endpoint
   - [ ] Add `/api/analytics/inventory/overstocking-alerts` endpoint
   - [ ] Add query parameter validation (Zod schemas)

2. **Testing & Documentation** (1 day)
   - [ ] Write API integration tests (Supertest)
   - [ ] Test authentication and authorization
   - [ ] Document API endpoints (OpenAPI comments)
   - [ ] Test caching behavior

**Deliverables**:
- 4 new API endpoints fully functional
- API documentation updated
- Integration tests with 80%+ coverage

**Acceptance Criteria**:
- [ ] All endpoints return correct data format
- [ ] Query parameter validation working
- [ ] Caching reduces database queries by 80%+
- [ ] All endpoints require authentication

---

### Phase 4: Frontend Dashboard (4 days)

**Sprint Goal**: Build intuitive inventory intelligence UI

**Tasks**:
1. **Dashboard Layout** (1 day)
   - [ ] Create `InventoryIntelligence.tsx` page
   - [ ] Implement tab navigation (Reorder Alerts, Predictions, Patterns, Overstocking)
   - [ ] Add branch filter dropdown
   - [ ] Create summary metric cards

2. **Reorder Alerts UI** (1 day)
   - [ ] Implement `ReorderAlertList` component
   - [ ] Priority badges and icons
   - [ ] Add "Create PO" quick action button
   - [ ] Implement refresh functionality

3. **Pattern Visualization** (1 day)
   - [ ] Implement `PurchasePatternTimeline` component
   - [ ] Display cycle metrics and confidence
   - [ ] Show trend indicators (increasing, decreasing, seasonal)
   - [ ] Timeline visualization (last order → predicted next order)

4. **Stock Predictions & Overstocking** (1 day)
   - [ ] Implement `StockPredictionCards` component
   - [ ] Status color coding (LOW, CRITICAL, HEALTHY)
   - [ ] Implement `OverstockingAlertList` component
   - [ ] Add filtering and sorting

**Deliverables**:
- Fully functional inventory intelligence dashboard
- Responsive design (desktop, tablet, mobile)
- 4 interactive components

**Acceptance Criteria**:
- [ ] Dashboard loads in <2 seconds
- [ ] All alerts displayed with correct priority
- [ ] Branch filtering works correctly
- [ ] UI is mobile-responsive
- [ ] Real-time data refresh works

---

### Phase 5: Testing & Calibration (3 days)

**Sprint Goal**: Validate accuracy, tune thresholds, and document

**Tasks**:
1. **Accuracy Testing** (1 day)
   - [ ] Test pattern detection on historical data
   - [ ] Measure prediction accuracy (target: 80% within 7 days)
   - [ ] Analyze false positives and false negatives
   - [ ] Document accuracy metrics

2. **Threshold Calibration** (1 day)
   - [ ] Tune deviation thresholds (1.5x vs. 2x)
   - [ ] Adjust alert priorities based on user feedback
   - [ ] Calibrate confidence score calculation
   - [ ] Test edge cases (seasonal items, new items, discontinued items)

3. **Integration & Documentation** (1 day)
   - [ ] End-to-end testing (background job → API → UI)
   - [ ] Performance testing (1000+ patterns)
   - [ ] Write user documentation (how to interpret alerts)
   - [ ] Create admin guide (threshold tuning)

**Deliverables**:
- Prediction accuracy ≥80% within 7-day window
- Calibrated thresholds for deviation detection
- Complete user and admin documentation

**Acceptance Criteria**:
- [ ] Prediction accuracy meets 80% target
- [ ] Alert priorities align with business needs
- [ ] System handles 1000+ patterns without performance degradation
- [ ] Documentation complete and reviewed

---

## 8. Testing Strategy

### 8.1 Unit Tests (Vitest)

**Value Objects** (`server/src/domain/inventory/value-objects/__tests__/`)
- [ ] OrderCycle: validation, consistency check, prediction methods
- [ ] ConsumptionRate: validation, stock days calculation
- [ ] StockLevel: status determination, reorder logic

**Service Layer** (`server/src/services/__tests__/inventoryIntelligenceService.test.ts`)
- [ ] Pattern retrieval with various filters
- [ ] Stock level predictions with different scenarios
- [ ] Reorder alert generation with priority calculation
- [ ] Overstocking detection with threshold validation

**Test Coverage Target**: 90% for service layer, 100% for value objects

### 8.2 Integration Tests (Supertest)

**API Endpoints** (`server/src/routes/__tests__/inventory.test.ts`)
```typescript
describe('GET /api/analytics/inventory/patterns', () => {
  it('should return patterns for items with ≥3 orders', async () => {
    // Seed database with test invoices
    // Call API endpoint
    // Assert response format and data
  });

  it('should filter patterns by itemId', async () => {});
  it('should filter patterns by branchId', async () => {});
  it('should require authentication', async () => {});
  it('should cache results for 1 hour', async () => {});
});

describe('GET /api/analytics/inventory/reorder-alerts', () => {
  it('should return HIGH priority for items 1 day from stockout', async () => {});
  it('should return CRITICAL priority for overdue reorders', async () => {});
  it('should filter by priority', async () => {});
});
```

**Test Coverage Target**: 80% for API routes

### 8.3 E2E Tests (Playwright - Future)

**User Workflows**:
- [ ] User views inventory dashboard and sees reorder alerts
- [ ] User filters patterns by branch
- [ ] User clicks "Create PO" from reorder alert
- [ ] User views pattern accuracy for specific item

### 8.4 Accuracy Validation Tests

**Historical Data Testing**:
```typescript
describe('Pattern Accuracy Validation', () => {
  it('should achieve 80% accuracy on historical chicken orders', async () => {
    // Load 6 months of chicken breast invoices
    // Use first 3 months to build pattern
    // Predict next 3 months
    // Compare predictions to actual orders
    // Assert ≥80% within 7-day window
  });

  it('should detect seasonal patterns in flour orders', async () => {});
  it('should exclude outliers in inconsistent order patterns', async () => {});
});
```

---

## 9. Acceptance Criteria

### Business Acceptance Criteria

**BAC-001: Stock-out Reduction**
- **Criteria**: 30% reduction in emergency orders within 3 months of deployment
- **Measurement**: Count of rush/emergency POs before and after
- **Validation**: Monthly reporting

**BAC-002: Overstocking Reduction**
- **Criteria**: 20% reduction in waste/spoilage for perishable items
- **Measurement**: Waste tracking reports comparison
- **Validation**: Quarterly review

**BAC-003: Prediction Accuracy**
- **Criteria**: 80% of predictions within 7-day window of actual order
- **Measurement**: Automated accuracy tracking via `/pattern-accuracy` API
- **Validation**: Continuous monitoring, weekly review

**BAC-004: Pattern Coverage**
- **Criteria**: 90% of items with ≥3 orders have detected patterns
- **Measurement**: Count of items with patterns / eligible items
- **Validation**: Daily background job metrics

**BAC-005: User Adoption**
- **Criteria**: 70% of procurement officers use dashboard weekly
- **Measurement**: User analytics (page views, session duration)
- **Validation**: Monthly usage reports

### Technical Acceptance Criteria

**TAC-001: Pattern Detection**
- [ ] Patterns detected for all items with ≥3 approved invoices
- [ ] Confidence score increases from 0.5 (3 orders) to 1.0 (10+ orders)
- [ ] Outliers (>2σ) excluded from cycle calculation
- [ ] Stale patterns (>2x cycle) marked as inactive

**TAC-002: Stock Prediction**
- [ ] Stock level calculated based on last order + consumption rate
- [ ] Status correctly determined (HEALTHY, LOW, CRITICAL, STOCKOUT_PREDICTED, OVERSTOCKED)
- [ ] Predictions cached for 30 minutes
- [ ] Edge cases handled (no pattern, stale pattern, negative stock)

**TAC-003: Reorder Alerts**
- [ ] CRITICAL priority for overdue orders (days < 0)
- [ ] HIGH priority for 0-1 day until stockout
- [ ] MEDIUM priority for 2-3 days until stockout
- [ ] Recommended order date 2 days before predicted stockout
- [ ] Alerts cached for 15 minutes

**TAC-004: Overstocking Detection**
- [ ] MINOR deviation: 1.5x - 2x normal quantity
- [ ] MAJOR deviation: >2x normal quantity
- [ ] Possible reasons suggested based on pattern characteristics
- [ ] Major deviations publish domain events

**TAC-005: Performance**
- [ ] Pattern retrieval API responds in <200ms (cached)
- [ ] Stock prediction API responds in <500ms
- [ ] Background job completes in <5 minutes for 1000 items
- [ ] Dashboard loads in <2 seconds

**TAC-006: Caching**
- [ ] Patterns cached 1 hour (`CacheTTL.ANALYTICS_PATTERNS`)
- [ ] Predictions cached 30 minutes (`CacheTTL.ANALYTICS_PREDICTIONS`)
- [ ] Alerts cached 15 minutes (`CacheTTL.ANALYTICS_ALERTS`)
- [ ] Cache invalidated on invoice approval/deletion

**TAC-007: Testing**
- [ ] 90% unit test coverage for `InventoryIntelligenceService`
- [ ] 100% unit test coverage for value objects
- [ ] 80% integration test coverage for API endpoints
- [ ] All tests pass in CI pipeline

---

## 10. Implementation Checklist

### Prerequisites
- [ ] Analytics & Intelligence Foundation deployed to production
- [ ] `PurchasePattern` table created and indexed
- [ ] RedisService operational with caching
- [ ] JobQueueService running scheduled jobs
- [ ] PatternRecognitionService baseline implemented

---

### Phase 1: Pattern Learning Logic (4 days)

#### Day 1: Value Objects
- [ ] Create `server/src/domain/inventory/value-objects/` directory
- [ ] Implement `OrderCycle.ts` with validation and business methods
  - [ ] `create()` factory method
  - [ ] `isConsistent()` method
  - [ ] `predictNextDate()` method
  - [ ] `getReorderAlertDate()` method
- [ ] Implement `ConsumptionRate.ts`
  - [ ] `create()` factory method
  - [ ] `estimateStockDays()` method
  - [ ] `projectedConsumption()` method
- [ ] Implement `StockLevel.ts`
  - [ ] `fromPattern()` factory method
  - [ ] `needsReorder()` method
  - [ ] Status determination logic
- [ ] Write unit tests for all value objects (TDD approach)
  - [ ] `OrderCycle.test.ts` (10 test cases)
  - [ ] `ConsumptionRate.test.ts` (8 test cases)
  - [ ] `StockLevel.test.ts` (12 test cases)
- [ ] Verify 100% test coverage for value objects

#### Day 2-3: Pattern Recognition Enhancement
- [ ] Update `server/src/services/analytics/patternRecognitionService.ts`
  - [ ] Implement outlier detection using standard deviation
  - [ ] Calculate trend indicators (isIncreasing, isDecreasing)
  - [ ] Detect seasonality (basic monthly pattern)
  - [ ] Update confidence score calculation
- [ ] Write unit tests for enhanced pattern recognition
  - [ ] Test outlier exclusion (>2σ)
  - [ ] Test trend detection with mock data
  - [ ] Test seasonality detection
  - [ ] Test confidence score progression
- [ ] Test on historical data (seed database with 6 months of invoices)
- [ ] Measure prediction accuracy (target: ≥80%)

#### Day 4: Background Job
- [ ] Create `server/src/jobs/analyzePurchasePatterns.ts`
- [ ] Implement `analyzePurchasePatternsJob()` function
  - [ ] Find eligible items (≥3 orders)
  - [ ] Loop through items and call `analyzePurchasePattern()`
  - [ ] Upsert to `PurchasePattern` table
  - [ ] Handle errors gracefully (log and continue)
  - [ ] Invalidate caches after completion
- [ ] Register job in JobQueueService (daily at 2am)
- [ ] Test job execution manually
- [ ] Monitor job completion and performance

**Verification**:
```bash
cd server
npm test -- --coverage src/domain/inventory
npm test -- src/services/analytics/patternRecognitionService.test.ts
node -e "require('./dist/jobs/analyzePurchasePatterns').analyzePurchasePatternsJob()"
```

---

### Phase 2: Prediction Algorithms (3 days)

#### Day 5-6: InventoryIntelligenceService
- [ ] Create `server/src/services/inventoryIntelligenceService.ts`
- [ ] Implement `getPurchasePatterns()` method
  - [ ] Query `PurchasePattern` with filters
  - [ ] Include item, vendor, branch relations
  - [ ] Filter stale patterns (unless includeStale=true)
  - [ ] Map to `PurchasePatternResult` interface
  - [ ] Cache for 1 hour
- [ ] Implement `predictStockLevels()` method
  - [ ] Get patterns from cache
  - [ ] Calculate consumption rate for each pattern
  - [ ] Use `StockLevel.fromPattern()` to derive stock level
  - [ ] Map to `StockPrediction` interface
  - [ ] Filter by status if provided
  - [ ] Sort by `daysUntilReorder` (ascending)
  - [ ] Cache for 30 minutes
- [ ] Write integration tests
  - [ ] Mock Prisma client
  - [ ] Test various filter combinations
  - [ ] Test caching behavior
  - [ ] Test with stale patterns

#### Day 7: Alert Generation
- [ ] Implement `getReorderAlerts()` method
  - [ ] Call `predictStockLevels()` with status filter
  - [ ] Determine priority based on days until stockout
  - [ ] Calculate recommended order date (2 days before)
  - [ ] Generate descriptive message
  - [ ] Filter by priority if provided
  - [ ] Sort by priority (CRITICAL first)
  - [ ] Cache for 15 minutes
- [ ] Implement `detectOverstocking()` method
  - [ ] Query recent invoices (last 30 days)
  - [ ] For each invoice item, compare to pattern
  - [ ] Calculate deviation multiple
  - [ ] Generate alerts for >1.5x deviations
  - [ ] Suggest possible reasons
  - [ ] Publish domain events for MAJOR deviations
- [ ] Implement `analyzePatternAccuracy()` method (for calibration)
- [ ] Write tests for alert generation logic

**Verification**:
```bash
npm test -- src/services/inventoryIntelligenceService.test.ts
```

---

### Phase 3: API Endpoints (2 days)

#### Day 8: Route Implementation
- [ ] Update `server/src/routes/analytics.ts`
- [ ] Add `GET /api/analytics/inventory/patterns` endpoint
  - [ ] Parse query params (itemId, branchId, includeStale)
  - [ ] Call `inventoryService.getPurchasePatterns()`
  - [ ] Return JSON response
  - [ ] Handle errors with 500 status
- [ ] Add `GET /api/analytics/inventory/stock-predictions` endpoint
  - [ ] Parse query params (itemId, branchId, status)
  - [ ] Call `inventoryService.predictStockLevels()`
  - [ ] Return JSON response
- [ ] Add `GET /api/analytics/inventory/reorder-alerts` endpoint
  - [ ] Parse query params (branchId, priority)
  - [ ] Call `inventoryService.getReorderAlerts()`
  - [ ] Return JSON response
- [ ] Add `GET /api/analytics/inventory/overstocking-alerts` endpoint
  - [ ] Parse query params (branchId, days)
  - [ ] Call `inventoryService.detectOverstocking()`
  - [ ] Return JSON response
- [ ] Add `GET /api/analytics/inventory/pattern-accuracy/:itemId` endpoint
  - [ ] Parse path param (itemId) and query param (branchId)
  - [ ] Call `inventoryService.analyzePatternAccuracy()`
  - [ ] Return JSON response
- [ ] Apply middleware: `requireAuth` on all endpoints

#### Day 9: Testing & Documentation
- [ ] Create `server/src/routes/__tests__/inventory.test.ts`
- [ ] Write integration tests for each endpoint
  - [ ] Test successful responses (200 OK)
  - [ ] Test query parameter filtering
  - [ ] Test authentication requirement (401 without token)
  - [ ] Test caching behavior (hit and miss)
  - [ ] Test error handling (500 on service errors)
- [ ] Add OpenAPI/JSDoc comments to each endpoint
- [ ] Update API documentation
- [ ] Test endpoints manually with Postman/curl
- [ ] Verify response schemas match interfaces

**Verification**:
```bash
npm test -- src/routes/__tests__/inventory.test.ts
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/analytics/inventory/patterns
```

---

### Phase 4: Frontend Dashboard (4 days)

#### Day 10: Dashboard Layout
- [ ] Create `client/src/pages/InventoryIntelligence.tsx`
- [ ] Implement tab navigation using shadcn/ui Tabs component
  - [ ] Reorder Alerts tab
  - [ ] Stock Predictions tab
  - [ ] Purchase Patterns tab
  - [ ] Overstocking tab
- [ ] Add branch filter dropdown (populate from API)
- [ ] Create summary metric cards (4 cards: Critical, High Priority, Overstocking, Items Tracked)
- [ ] Add loading states (Skeleton components)
- [ ] Implement `loadDashboardData()` function
  - [ ] Fetch reorder alerts
  - [ ] Fetch overstocking alerts
  - [ ] Calculate counts for summary cards
- [ ] Add route to `App.tsx`: `/inventory-intelligence`

#### Day 11: Reorder Alerts UI
- [ ] Create `client/src/components/inventory/ReorderAlertList.tsx`
- [ ] Display alerts as cards with priority badges
- [ ] Implement priority color coding (red=CRITICAL, orange=HIGH, yellow=MEDIUM, gray=LOW)
- [ ] Show alert details (item name, branch, vendor, days until stockout, recommended quantity)
- [ ] Add "Create PO" button (link to PO creation with pre-filled data)
- [ ] Add "View Details" button (modal or navigation to item detail)
- [ ] Implement empty state (no alerts)
- [ ] Add refresh functionality

#### Day 12: Pattern Visualization
- [ ] Create `client/src/components/inventory/PurchasePatternTimeline.tsx`
- [ ] Display patterns as timeline cards
- [ ] Show key metrics (order cycle, avg quantity, confidence)
- [ ] Implement trend indicators with icons (TrendingUp, TrendingDown)
- [ ] Show timeline visualization (last order → predicted next order)
- [ ] Add consistency badge ("Consistent" if low std deviation)
- [ ] Implement loading state (Skeleton)
- [ ] Implement empty state (no patterns detected)

#### Day 13: Stock Predictions & Overstocking
- [ ] Create `client/src/components/inventory/StockPredictionCards.tsx`
  - [ ] Display predictions as cards
  - [ ] Color-code by status (green=HEALTHY, yellow=LOW, red=CRITICAL, purple=OVERSTOCKED)
  - [ ] Show estimated quantity and days until reorder
  - [ ] Add confidence indicator
- [ ] Create `client/src/components/inventory/OverstockingAlertList.tsx`
  - [ ] Display alerts as cards with severity badges
  - [ ] Show deviation details (ordered vs. normal quantity)
  - [ ] List possible reasons
  - [ ] Add "View Invoice" button
- [ ] Create `client/src/services/inventoryService.ts`
  - [ ] Implement API client methods for all 4 endpoints
  - [ ] Use Axios instance with auth interceptor
  - [ ] Handle errors gracefully
- [ ] Test all components in browser
- [ ] Verify responsive design on mobile

**Verification**:
```bash
cd client
npm run dev
# Navigate to http://localhost:5173/inventory-intelligence
# Test all tabs, filters, and interactions
```

---

### Phase 5: Testing & Calibration (3 days)

#### Day 14: Accuracy Testing
- [ ] Seed database with 12 months of historical invoice data
  - [ ] Use realistic patterns (e.g., chicken every 4 days, flour weekly)
  - [ ] Include seasonal items (e.g., ice cream in summer)
  - [ ] Include irregular items (new items, discontinued items)
- [ ] Run background job to detect patterns
- [ ] Use first 6 months to build patterns
- [ ] Compare predictions to actual orders in last 6 months
- [ ] Calculate accuracy metrics
  - [ ] Percentage of predictions within 7-day window (target: ≥80%)
  - [ ] Average days off (target: <2 days)
  - [ ] False positive rate (predicted stockout but didn't occur)
  - [ ] False negative rate (stockout occurred but not predicted)
- [ ] Document accuracy findings in `docs/reports/inventory-accuracy-report.md`

#### Day 15: Threshold Calibration
- [ ] Analyze overstocking false positives
  - [ ] Adjust deviation thresholds if needed (1.5x → 1.7x?)
  - [ ] Test on historical data
- [ ] Analyze reorder alert timeliness
  - [ ] Adjust recommended order date lead time (2 days → 3 days?)
  - [ ] Test with various order cycle lengths
- [ ] Tune confidence score calculation
  - [ ] Test with different sample sizes (3, 5, 10, 20 orders)
  - [ ] Ensure confidence increases appropriately
- [ ] Test edge cases
  - [ ] New items (no pattern yet)
  - [ ] Discontinued items (stale patterns)
  - [ ] Seasonal items (winter to summer transition)
  - [ ] Items with large order variations
- [ ] Document calibration decisions in `docs/implementation/calibration-notes.md`

#### Day 16: Integration & Documentation
- [ ] End-to-end testing
  - [ ] Trigger background job manually
  - [ ] Verify patterns in database
  - [ ] Call all API endpoints
  - [ ] Verify UI displays correct data
  - [ ] Test cache invalidation on invoice approval
- [ ] Performance testing
  - [ ] Load test with 1000 patterns
  - [ ] Measure API response times
  - [ ] Measure background job duration
  - [ ] Optimize queries if needed (add indexes)
- [ ] Write user documentation
  - [ ] Create `docs/user-guides/inventory-intelligence.md`
  - [ ] Explain how to interpret reorder alerts
  - [ ] Explain how to interpret overstocking alerts
  - [ ] Provide decision-making guidelines
- [ ] Write admin guide
  - [ ] Create `docs/admin-guides/inventory-calibration.md`
  - [ ] Explain how to tune thresholds
  - [ ] Explain how to monitor accuracy
  - [ ] Troubleshooting guide
- [ ] Deploy to staging environment
- [ ] User acceptance testing with procurement team

**Verification**:
```bash
# Run all tests
npm test -- --coverage

# Check coverage report
open coverage/index.html

# Performance test
npx artillery quick --count 100 --num 10 http://localhost:3000/api/analytics/inventory/patterns

# End-to-end test
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/analytics/inventory/reorder-alerts | jq
```

---

### Post-Implementation

#### Deployment
- [ ] Merge feature branch to main
- [ ] Deploy to production
- [ ] Run database migration (PurchasePattern table already exists from foundation)
- [ ] Trigger background job manually to populate initial patterns
- [ ] Monitor logs for errors
- [ ] Verify caching working (Redis metrics)

#### Monitoring
- [ ] Add metrics to Prometheus
  - [ ] `inventory_patterns_detected_total`
  - [ ] `inventory_predictions_generated_total`
  - [ ] `inventory_alerts_critical_count`
  - [ ] `inventory_accuracy_percentage`
- [ ] Set up alerts
  - [ ] Background job failures
  - [ ] Prediction accuracy drops below 70%
  - [ ] Critical alert count spikes
- [ ] Create Grafana dashboard (future)

#### User Training
- [ ] Schedule training session with procurement officers
- [ ] Demo dashboard features
- [ ] Explain alert priorities
- [ ] Collect feedback on thresholds
- [ ] Document common questions in FAQ

---

## Appendix A: Sample Data for Testing

### Seed Script
```typescript
// server/prisma/seeds/inventoryPatterns.seed.ts

import prisma from '../../src/prisma';

async function seedInventoryPatterns() {
  // Create test vendors
  const vendor1 = await prisma.vendor.create({
    data: { name: 'FreshMeats Inc', contact: 'orders@freshmeats.com' },
  });

  const vendor2 = await prisma.vendor.create({
    data: { name: 'BakersGrain Co', contact: 'sales@bakersgrain.com' },
  });

  // Create test branches
  const branch1 = await prisma.branch.create({
    data: { name: 'Downtown Location' },
  });

  const branch2 = await prisma.branch.create({
    data: { name: 'Westside Location' },
  });

  // Create test items
  const chickenBreast = await prisma.item.create({
    data: {
      name: 'Chicken Breast (Fresh)',
      price: 8.50,
      vendorId: vendor1.id,
      item_code: 'CHKN-BRST-001',
    },
  });

  const flour = await prisma.item.create({
    data: {
      name: 'Flour (25kg)',
      price: 45.00,
      vendorId: vendor2.id,
      item_code: 'FLR-25KG-001',
    },
  });

  // Create historical invoices (consistent pattern)
  const startDate = new Date('2025-06-01');
  for (let i = 0; i < 30; i++) {
    const invoiceDate = new Date(startDate);
    invoiceDate.setDate(invoiceDate.getDate() + (i * 4)); // Every 4 days

    await prisma.invoice.create({
      data: {
        date: invoiceDate,
        status: 'APPROVED',
        branchId: branch1.id,
        totalAmount: 425.00,
        items: {
          create: {
            itemId: chickenBreast.id,
            quantity: 50,
            price: 8.50,
          },
        },
      },
    });
  }

  // Create historical invoices (seasonal pattern)
  for (let i = 0; i < 12; i++) {
    const invoiceDate = new Date('2025-01-01');
    invoiceDate.setMonth(invoiceDate.getMonth() + i);

    // Summer months (June-August) have 2x orders
    const isSummer = invoiceDate.getMonth() >= 5 && invoiceDate.getMonth() <= 7;
    const quantity = isSummer ? 100 : 50;

    await prisma.invoice.create({
      data: {
        date: invoiceDate,
        status: 'APPROVED',
        branchId: branch2.id,
        totalAmount: quantity * 45.00,
        items: {
          create: {
            itemId: flour.id,
            quantity,
            price: 45.00,
          },
        },
      },
    });
  }

  console.log('Inventory pattern seed data created');
}

seedInventoryPatterns().catch(console.error);
```

---

## Appendix B: Cache TTL Configuration

```typescript
// server/src/services/cacheService.ts

export enum CacheTTL {
  // Existing
  ANALYTICS_DASHBOARD = 5 * 60,      // 5 minutes
  ANALYTICS_SPENDING = 15 * 60,       // 15 minutes
  ANALYTICS_TRENDS = 15 * 60,         // 15 minutes
  ANALYTICS_PRICE_CHANGES = 30 * 60,  // 30 minutes

  // New for Inventory Intelligence
  ANALYTICS_PATTERNS = 60 * 60,       // 1 hour
  ANALYTICS_PREDICTIONS = 30 * 60,    // 30 minutes
  ANALYTICS_ALERTS = 15 * 60,         // 15 minutes
}
```

---

## Appendix C: Domain Events

```typescript
// server/src/services/pubsub.ts

// Existing events
export enum EventType {
  // ... existing events ...

  // Inventory Intelligence events
  INVENTORY_PATTERN_DETECTED = 'inventory.pattern-detected',
  INVENTORY_STOCKOUT_PREDICTED = 'inventory.stockout-predicted',
  INVENTORY_OVERSTOCKING_DETECTED = 'inventory.overstocking-detected',
}
```

---

**Document End**
