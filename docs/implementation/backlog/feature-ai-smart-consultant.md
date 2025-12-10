# Feature 3: AI Smart Consultant (Recommendations Engine) - Implementation Plan

**Document Version**: 1.0
**Date**: 2025-12-10
**Status**: Ready for Implementation
**Estimated Effort**: 18 days (1 developer)

---

## Table of Contents

1. [Feature Overview](#1-feature-overview)
2. [Dependencies](#2-dependencies)
3. [Recommendation Rule Library](#3-recommendation-rule-library)
4. [Service Layer](#4-service-layer)
5. [API Endpoints](#5-api-endpoints)
6. [Frontend Components](#6-frontend-components)
7. [Implementation Phases](#7-implementation-phases)
8. [Rule Extensibility](#8-rule-extensibility)
9. [Testing Strategy](#9-testing-strategy)
10. [Acceptance Criteria](#10-acceptance-criteria)
11. [Future ML Integration Plan](#11-future-ml-integration-plan)
12. [Implementation Checklist](#12-implementation-checklist)

---

## 1. Feature Overview

### Business Value

The AI Smart Consultant transforms reactive procurement management into proactive strategic sourcing by analyzing all transaction data and delivering actionable recommendations. This feature targets $100-150K in additional cost optimization per $1M in annual procurement spend.

**Key Business Outcomes**:
- **Cost Savings**: Identify vendor consolidation opportunities, price negotiation leverage, and bulk purchasing benefits
- **Risk Mitigation**: Alert to single-source dependencies, price volatility, and vendor reliability issues
- **Waste Reduction**: Prevent spoilage through reorder timing optimization and portion control insights
- **Operational Efficiency**: Automate pattern detection that would require hours of manual analysis

### User Personas

#### Procurement Manager (Primary User)
**Goals**:
- Reduce costs through vendor optimization
- Minimize supply chain risks
- Improve order timing and quantities

**Usage Pattern**: Reviews recommendations daily, accepts 40-60% of suggestions, dismisses irrelevant ones to train the system

#### Location Manager (Secondary User)
**Goals**:
- Reduce location-specific waste
- Optimize inventory levels
- Stay within budget

**Usage Pattern**: Reviews location-specific recommendations weekly, focuses on inventory and waste prevention recommendations

#### Executive/CFO (Tertiary User)
**Goals**:
- Monitor cost optimization progress
- Identify strategic procurement opportunities
- Benchmark performance across locations

**Usage Pattern**: Reviews high-impact recommendations monthly, tracks savings realization metrics

### Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Recommendation Relevance Rate | 80% not dismissed immediately | (Total - Dismissed) / Total |
| Recommendation Acceptance Rate | 30% accepted within 30 days | Accepted / Total |
| Average Recommendations per Week | 5-20 recommendations | Count of PENDING recommendations |
| Estimated Annual Savings | $100-150K per $1M spend | Sum of estimatedSavings for APPLIED recommendations |
| User Engagement | 70% of managers review recommendations weekly | Active users viewing /recommendations page |
| Time to Action | 90% of recommendations actioned within 7 days | Time from createdAt to (appliedAt or dismissedAt) |

---

## 2. Dependencies

### Foundation Infrastructure (MUST be in place)

From `/docs/architecture/2025-12-10-analytics-infrastructure-foundation.md`:

#### Database Models (Prisma Schema)
- ✅ `Recommendation` model - ALREADY EXISTS in schema (verified in schema.prisma lines 273-331)
- ✅ `RecommendationType` enum - ALREADY EXISTS
- ✅ `RecommendationStatus` enum - ALREADY EXISTS
- ⚠️ `SpendingMetric` model - REFERENCED in foundation doc, NOT YET in schema
- ⚠️ `PurchasePattern` model - REFERENCED in foundation doc, NOT YET in schema
- ⚠️ `PriceSnapshot` model - REFERENCED in foundation doc, NOT YET in schema

**ACTION REQUIRED**: Confirm with user whether foundation feature Phase 0 has been completed. If SpendingMetric/PurchasePattern/PriceSnapshot models are NOT yet added to Prisma schema, this feature can still launch with BASIC recommendations using existing Invoice/Item/Vendor data, but ADVANCED recommendations (pattern-based, benchmark-based) will be limited.

#### Services
- ✅ `analyticsService.ts` - EXISTS with dashboard totals, spending breakdowns, trends, price changes
- ⚠️ `RuleEngine` - NOT YET EXISTS (will be built in this feature)
- ⚠️ `RecommendationService` - NOT YET EXISTS (will be built in this feature)
- ⚠️ `AggregationService` - REFERENCED in foundation, not yet verified (needed for pre-computed metrics)
- ⚠️ `CrossLocationService` - REFERENCED in foundation, not yet verified (needed for benchmarking)
- ⚠️ `PatternRecognitionService` - REFERENCED in foundation, not yet verified (needed for inventory intelligence)

#### Background Jobs
- ⚠️ Job queue system (Bull + Redis) - Foundation doc specifies Bull for job processing
- ⚠️ `generate-recommendations` job - NOT YET EXISTS (will be built in this feature)

### Data from Other Features

#### Feature 1: Cross-Location Cost Control
- **Data Needed**: Price variance across branches, benchmark statistics
- **Fallback Strategy**: If Feature 1 not implemented, use simple price history from `ItemPriceHistory` table
- **Impact**: Limited cross-location recommendations, but single-location recommendations still valuable

#### Feature 2: Inventory Intelligence
- **Data Needed**: Purchase patterns, order cycles, consumption rates
- **Fallback Strategy**: If Feature 2 not implemented, use raw invoice data to detect basic patterns (order frequency, quantity trends)
- **Impact**: Less accurate stock-out predictions, but basic reorder timing recommendations still possible

### Launch Strategy

**Phase 1 (MVP)**: Launch with BASIC recommendations using existing data:
- Use `Invoice`, `InvoiceItem`, `Item`, `Vendor`, `ItemPriceHistory` tables
- Use `analyticsService.ts` for spending data
- 10 basic rules (see section 3)
- Manual daily review instead of automated job queue

**Phase 2 (Enhanced)**: Add ADVANCED recommendations after foundation complete:
- Integrate `SpendingMetric`, `PurchasePattern`, `PriceSnapshot` tables
- Integrate `CrossLocationService`, `PatternRecognitionService`
- Background job queue for daily generation
- 20+ advanced rules

---

## 3. Recommendation Rule Library

### Rule Structure

Each rule follows this interface:

```typescript
interface Rule {
  id: string;                    // Unique identifier (e.g., "COST_001")
  name: string;                  // Human-readable name
  type: RecommendationType;      // Enum value
  category: string;              // "Cost Optimization", "Risk Alert", etc.
  priority: number;              // 1=critical, 5=low

  // Rule evaluation
  condition: (context: AnalyticsContext) => boolean;
  generateRecommendation: (context: AnalyticsContext) => RecommendationPayload;

  // Scoring
  calculateConfidence: (context: AnalyticsContext) => number; // 0-1
  estimateSavings: (context: AnalyticsContext) => number | null;

  // Configuration
  enabled: boolean;
  threshold?: Record<string, number>; // Configurable thresholds
}

interface RecommendationPayload {
  title: string;
  description: string;
  reasoning: string;
  context: Record<string, any>; // JSON data (item IDs, vendor IDs, etc.)
}
```

---

### Category 1: Cost Optimization (5 Rules)

#### COST_001: Price Spike Alert
**Trigger Conditions**:
- Item price increased by >15% from 30-day average
- Minimum 3 price history entries (to establish baseline)
- Price change occurred within last 7 days

**Data Sources**:
- `ItemPriceHistory` table (date, price, itemId)
- `Item` table (name, current price, vendorId)
- `Vendor` table (name)

**Recommendation Template**:
```
Title: "Price Spike Detected: {itemName}"
Description: "{itemName} from {vendorName} increased {percentChange}% (from ${oldPrice} to ${newPrice}). This is significantly above the 30-day average."
Reasoning: "Sudden price increases may indicate supply chain disruptions or vendor opportunism. Consider negotiating with vendor, seeking alternative suppliers, or adjusting order quantities."
```

**Confidence Scoring**:
- High confidence (0.9): >20% increase with stable prior history
- Medium confidence (0.7): 15-20% increase
- Low confidence (0.5): 10-15% increase

**Priority**: 2 (High - requires timely action)

**Estimated Savings**: `(newPrice - oldPrice) * avgMonthlyQuantity * 12 months`

---

#### COST_002: Vendor Consolidation Opportunity
**Trigger Conditions**:
- 2+ vendors sell the same or similar items (matched by name similarity >80%)
- Price difference between vendors is <10% (not significant quality difference implied)
- Both vendors have been used within last 90 days
- Combined monthly spending with both vendors >$1,000

**Data Sources**:
- `Item` table (name, price, vendorId)
- `InvoiceItem` JOIN `Invoice` (for spending and usage frequency)
- `Vendor` table (name)

**Recommendation Template**:
```
Title: "Vendor Consolidation: Combine {itemName} orders"
Description: "You purchase {itemName} from both {vendor1Name} (${price1}) and {vendor2Name} (${price2}). Consolidating orders with {preferredVendor} could simplify procurement and unlock volume discounts."
Reasoning: "Consolidating vendors reduces administrative overhead, improves negotiating leverage, and often qualifies for volume-based pricing tiers."
```

**Confidence Scoring**:
- High confidence (0.85): >5 orders/month from each vendor, <5% price difference
- Medium confidence (0.7): 2-5 orders/month, 5-10% price difference

**Priority**: 3 (Medium - strategic but not urgent)

**Estimated Savings**: `consolidatedVolumeDiscount (estimated 5%) * annual spending on item`

---

#### COST_003: Bulk Purchase Opportunity
**Trigger Conditions**:
- Item ordered >3 times per month
- Order size is consistent (std deviation <20% of mean)
- Order size <50% of typical bulk order size (heuristic: 10x current order size)
- No perishability risk (future: integrate with item metadata)

**Data Sources**:
- `InvoiceItem` JOIN `Invoice` WHERE status = 'APPROVED' (last 90 days)
- `Item` table (name, price, vendorId)

**Recommendation Template**:
```
Title: "Bulk Purchase Savings: {itemName}"
Description: "You order {itemName} an average of {ordersPerMonth} times per month with consistent quantities (~{avgQuantity} units). Ordering in larger batches (e.g., monthly instead of weekly) could reduce per-unit costs."
Reasoning: "Frequent small orders incur higher transaction costs and miss volume discounts. Bulk purchasing typically offers 5-15% savings."
```

**Confidence Scoring**:
- High confidence (0.8): >4 orders/month, <10% variance in order size
- Medium confidence (0.6): 3-4 orders/month, 10-20% variance

**Priority**: 3 (Medium)

**Estimated Savings**: `estimatedBulkDiscount (10%) * annual spending on item`

---

#### COST_004: Alternative Vendor Discovery
**Trigger Conditions**:
- Vendor's pricing is >20% above cross-location average (if cross-location data available)
- OR: No price change in 12+ months while CPI increased >3% (inflation baseline)
- Spending with vendor >$500/month

**Data Sources**:
- `PriceSnapshot` table (if available from Feature 1)
- `ItemPriceHistory` table
- `Invoice` + `InvoiceItem` for spending

**Recommendation Template**:
```
Title: "Explore Alternative Vendors for {itemName}"
Description: "{vendorName} is charging ${currentPrice} for {itemName}, which is {percentAboveMarket}% above market benchmarks. Consider requesting quotes from alternative suppliers."
Reasoning: "Competitive bidding often yields 10-25% cost savings. Vendor complacency can lead to above-market pricing."
```

**Confidence Scoring**:
- High confidence (0.9): >30% above benchmark, >$1000/month spending
- Medium confidence (0.7): 20-30% above benchmark

**Priority**: 2 (High - significant savings potential)

**Estimated Savings**: `(currentPrice - benchmarkPrice) * annual quantity`

---

#### COST_005: Pricing Negotiation Leverage
**Trigger Conditions**:
- Vendor represents >30% of total procurement spending
- Spending with vendor increased >20% in last quarter vs. prior quarter
- No contract renegotiation event in last 12 months (stored in recommendation context)

**Data Sources**:
- `Invoice` + `InvoiceItem` aggregated by vendor
- `Vendor` table

**Recommendation Template**:
```
Title: "Negotiate Pricing with {vendorName}"
Description: "{vendorName} now represents {percentOfSpending}% of total procurement spend (${quarterlySpending} this quarter, up {percentIncrease}% from last quarter). Your increased volume provides strong negotiating leverage."
Reasoning: "Volume growth demonstrates commitment and provides leverage for tiered pricing, extended payment terms, or exclusive discounts."
```

**Confidence Scoring**:
- High confidence (0.85): >40% of spend, >30% growth
- Medium confidence (0.7): 30-40% of spend, 20-30% growth

**Priority**: 2 (High - time-sensitive, leverage is perishable)

**Estimated Savings**: `potentialDiscount (5%) * annual spending with vendor`

---

### Category 2: Purchasing Patterns (4 Rules)

#### PATTERN_001: Order Frequency Optimization
**Trigger Conditions**:
- Ordering same item >5 times per month
- Individual order value <$50 (high transaction cost ratio)
- Item is non-perishable OR has >30 day shelf life

**Data Sources**:
- `Invoice` + `InvoiceItem` (last 90 days)
- `Item` table

**Recommendation Template**:
```
Title: "Reduce Order Frequency: {itemName}"
Description: "You're ordering {itemName} {ordersPerMonth} times per month with an average order value of ${avgOrderValue}. Consolidating into bi-weekly or monthly orders would reduce administrative overhead."
Reasoning: "Each order incurs processing costs (~$25-50 per transaction). Reducing frequency by 50% could save ${annualSavings} annually."
```

**Confidence Scoring**:
- High confidence (0.8): >8 orders/month, <$30 avg order value
- Medium confidence (0.65): 5-8 orders/month

**Priority**: 3 (Medium)

**Estimated Savings**: `reducedTransactionCost ($30 per order eliminated) * orders eliminated`

---

#### PATTERN_002: Seasonal Purchase Timing
**Trigger Conditions**:
- Historical data shows consistent seasonal price fluctuation (>10% variance)
- Minimum 12 months of price history
- Currently in high-price season (above annual average)

**Data Sources**:
- `ItemPriceHistory` (requires 12+ months data)
- `PurchasePattern.seasonalityPattern` (if Feature 2 implemented)

**Recommendation Template**:
```
Title: "Seasonal Buying: Stock up on {itemName} in {lowPriceMonth}"
Description: "{itemName} historically costs {percentCheaper}% less in {lowPriceMonth} compared to current month. Consider forward-buying for non-perishable inventory."
Reasoning: "Seasonal price patterns are predictable. Strategic timing of large purchases can capture savings of 10-20% on seasonal items."
```

**Confidence Scoring**:
- High confidence (0.85): >3 years of consistent seasonal pattern
- Medium confidence (0.7): 1-2 years of data

**Priority**: 4 (Low - planning horizon is long)

**Estimated Savings**: `(avgCurrentPrice - avgLowSeasonPrice) * annual quantity`

---

#### PATTERN_003: Order Quantity Standardization
**Trigger Conditions**:
- Order quantities for same item vary by >50% (high std deviation)
- >10 orders in last 90 days
- No discernible pattern (not correlated with demand events)

**Data Sources**:
- `InvoiceItem` aggregated by itemId (quantity analysis)

**Recommendation Template**:
```
Title: "Standardize Order Quantities: {itemName}"
Description: "Order quantities for {itemName} vary significantly (from {minQuantity} to {maxQuantity} units). Standardizing to a consistent order size (e.g., {suggestedQuantity} units) simplifies inventory planning."
Reasoning: "Erratic order quantities complicate forecasting, increase stockout risk, and prevent negotiation of fixed pricing agreements."
```

**Confidence Scoring**:
- High confidence (0.75): Coefficient of variation >0.5, no demand seasonality
- Medium confidence (0.6): CV 0.3-0.5

**Priority**: 4 (Low - operational efficiency)

**Estimated Savings**: `null` (not directly quantifiable)

---

#### PATTERN_004: Reorder Point Optimization
**Trigger Conditions**:
- Order cycle detected (from `PurchasePattern` table if available)
- Recent order timing deviated >30% from cycle (too early or too late)
- Item is regularly consumed (>6 orders in last 90 days)

**Data Sources**:
- `PurchasePattern` table (if Feature 2 implemented)
- OR: Calculate cycle from `Invoice` + `InvoiceItem` historical data

**Recommendation Template**:
```
Title: "Optimize Reorder Timing: {itemName}"
Description: "Based on usage patterns, you typically reorder {itemName} every {avgCycleDays} days. The last order was {actualDaysSinceLastOrder} days ago, which is {deviationPercent}% {earlier/later} than usual."
Reasoning: "Ordering too early ties up capital and risks spoilage. Ordering too late risks stockouts. Data-driven reorder points balance these risks."
```

**Confidence Scoring**:
- High confidence (0.8): Consistent cycle detected (CV <0.2)
- Medium confidence (0.65): Moderate consistency (CV 0.2-0.4)

**Priority**: 3 (Medium)

**Estimated Savings**: `capitalCostAvoidance + stockoutRiskReduction (estimated combined 3%)`

---

### Category 3: Waste Prevention (3 Rules)

#### WASTE_001: Spoilage Risk Alert
**Trigger Conditions**:
- Perishable item (requires item metadata or heuristic: food categories)
- Order quantity >2x typical weekly consumption rate
- No upcoming event justifying large order (requires integration with calendar/notes)

**Data Sources**:
- `PurchasePattern.avgOrderQuantity` vs. recent order
- `InvoiceItem` (detect large orders)
- Item metadata (future: perishability flag)

**Recommendation Template**:
```
Title: "Spoilage Risk: {itemName}"
Description: "Recent order of {recentQuantity} units of {itemName} is {percentAboveNormal}% higher than your typical order size ({avgQuantity} units). With a shelf life of ~{shelfLifeDays} days, consumption may not keep pace."
Reasoning: "Overstocking perishables leads to waste. Estimated spoilage cost: ${potentialWaste}."
```

**Confidence Scoring**:
- High confidence (0.8): >3x normal order, perishable category confirmed
- Medium confidence (0.65): 2-3x normal, assumed perishable

**Priority**: 2 (High - immediate financial impact)

**Estimated Savings**: `potentialWasteCost (estimated 15% of excess inventory value)`

---

#### WASTE_002: Overstocking Detection
**Trigger Conditions**:
- Ordering frequency decreased by >50% in last 60 days
- Current inventory level (estimated from orders - consumption) is >2x normal
- No seasonal demand pattern justifying stockpile

**Data Sources**:
- `Invoice` + `InvoiceItem` (order history)
- `PurchasePattern` (if available)

**Recommendation Template**:
```
Title: "Reduce Orders: Excess Inventory of {itemName}"
Description: "Ordering of {itemName} has slowed significantly (down {percentDecrease}% vs. prior period), but recent orders suggest inventory buildup. Consider pausing orders until consumption normalizes."
Reasoning: "Excess inventory ties up capital, increases storage costs, and risks obsolescence or spoilage."
```

**Confidence Scoring**:
- High confidence (0.75): Consistent consumption rate historically, sudden order slowdown
- Medium confidence (0.6): Less historical data

**Priority**: 3 (Medium)

**Estimated Savings**: `capitalCostAvoidance (interest on tied-up capital) + storage cost reduction`

---

#### WASTE_003: Portion Control Opportunity
**Trigger Conditions**:
- Food service context (requires business type metadata)
- Item usage per cover/transaction is >20% above industry benchmark (requires external data or cross-location comparison)
- High-value ingredient (price per unit >$5)

**Data Sources**:
- `PriceSnapshot.networkAvgPrice` (cross-location comparison if Feature 1 implemented)
- `Invoice` + `InvoiceItem` (usage volume)
- Transaction count (requires POS integration - future)

**Recommendation Template**:
```
Title: "Portion Control: {itemName}"
Description: "Usage of {itemName} per transaction is {percentAboveNormal}% above network average. Standardizing portions could reduce costs without impacting quality."
Reasoning: "Inconsistent portioning wastes high-value ingredients. A 10% reduction in portion size often goes unnoticed but saves ${annualSavings} annually."
```

**Confidence Scoring**:
- High confidence (0.8): >30% above benchmark, high transaction volume
- Medium confidence (0.65): 20-30% above

**Priority**: 3 (Medium)

**Estimated Savings**: `(currentUsageRate - benchmarkRate) * price * annual transactions`

---

### Category 4: Risk Alerts (3 Rules)

#### RISK_001: Single-Source Dependency
**Trigger Conditions**:
- Critical item (high spend or high frequency) sourced from only 1 vendor
- Spending on item >$5,000/year OR >20 orders/year
- No alternative vendor exists in system for item category

**Data Sources**:
- `Item` table (vendorId)
- `Invoice` + `InvoiceItem` (spending and frequency)

**Recommendation Template**:
```
Title: "Supply Chain Risk: Single Vendor for {itemName}"
Description: "You source {itemName} exclusively from {vendorName}, representing ${annualSpending} in annual spending. This creates supply chain vulnerability."
Reasoning: "Single-source dependencies risk business disruption if vendor faces issues (bankruptcy, natural disaster, price hikes). Establish backup vendors for critical items."
```

**Confidence Scoring**:
- High confidence (0.9): >$10k annual spend, no backup vendor
- Medium confidence (0.75): $5-10k annual spend

**Priority**: 2 (High - risk mitigation)

**Estimated Savings**: `null` (risk avoidance, not direct savings)

---

#### RISK_002: Vendor Reliability Concern
**Trigger Conditions**:
- Order fulfillment issues detected (requires delivery note tracking from Feature 1)
- OR: Invoice approval rejection rate >20% for vendor (quality issues implied)
- OR: Price volatility >20% variance in last 6 months

**Data Sources**:
- `DeliveryNote` + `DeliveryNoteItem.condition` (if available)
- `Invoice.status = 'REJECTED'` aggregated by vendor
- `ItemPriceHistory` (price volatility)

**Recommendation Template**:
```
Title: "Vendor Reliability Issue: {vendorName}"
Description: "{vendorName} has shown concerning patterns: {issueDescription} (e.g., '3 of last 10 deliveries had discrepancies' or 'price increased 25% in 4 months'). Consider diversifying suppliers."
Reasoning: "Vendor reliability affects operations. Establishing alternative sources mitigates risk."
```

**Confidence Scoring**:
- High confidence (0.85): Multiple signals (quality issues + price volatility)
- Medium confidence (0.7): Single signal

**Priority**: 2 (High - operational risk)

**Estimated Savings**: `null` (risk avoidance)

---

#### RISK_003: Price Volatility Alert
**Trigger Conditions**:
- Item price standard deviation >15% of mean over last 6 months
- Minimum 6 price history entries
- High-spend item (>$2,000/year)

**Data Sources**:
- `ItemPriceHistory` (6-month window)
- `Invoice` + `InvoiceItem` (spending)

**Recommendation Template**:
```
Title: "Price Volatility Risk: {itemName}"
Description: "{itemName} prices from {vendorName} have fluctuated significantly (${minPrice} to ${maxPrice}, standard deviation {stdDevPercent}%). This makes budgeting difficult."
Reasoning: "High price volatility indicates unstable supply or opportunistic pricing. Consider fixed-price contracts or hedging strategies."
```

**Confidence Scoring**:
- High confidence (0.85): >20% volatility, >$5k annual spend
- Medium confidence (0.7): 15-20% volatility

**Priority**: 3 (Medium - planning impact)

**Estimated Savings**: `null` (budgeting benefit)

---

### Category 5: Seasonal Intelligence (2 Rules)

#### SEASONAL_001: Demand Forecasting
**Trigger Conditions**:
- Seasonal pattern detected in historical data (from `PurchasePattern.isSeasonal`)
- Approaching high-demand season (within 4 weeks)
- Current inventory level (estimated) <50% of typical seasonal peak

**Data Sources**:
- `PurchasePattern.seasonalityPattern` (if Feature 2 implemented)
- `Invoice` + `InvoiceItem` historical seasonal data

**Recommendation Template**:
```
Title: "Prepare for Seasonal Demand: {itemName}"
Description: "Historical data shows {itemName} demand increases {percentIncrease}% during {seasonName}. Current ordering suggests you may be understocked for the upcoming peak."
Reasoning: "Stockouts during high-demand periods result in lost revenue and customer dissatisfaction. Proactive stocking ensures availability."
```

**Confidence Scoring**:
- High confidence (0.85): >2 years of consistent seasonal pattern
- Medium confidence (0.7): 1 year of data

**Priority**: 2 (High - time-sensitive)

**Estimated Savings**: `stockoutAvoidance (lost revenue prevented)`

---

#### SEASONAL_002: Off-Season Inventory Reduction
**Trigger Conditions**:
- Seasonal item (from `PurchasePattern.isSeasonal`)
- Currently in low-demand season
- Ordering pace has not decreased (still ordering at peak-season levels)

**Data Sources**:
- `PurchasePattern.seasonalityPattern`
- Recent `Invoice` + `InvoiceItem` (last 30 days)

**Recommendation Template**:
```
Title: "Reduce Off-Season Inventory: {itemName}"
Description: "{itemName} is in off-season (demand typically drops {percentDecrease}% in {currentMonth}), but ordering remains elevated. Consider reducing order frequency to avoid excess inventory."
Reasoning: "Carrying excess off-season inventory ties up capital and increases storage costs."
```

**Confidence Scoring**:
- High confidence (0.8): Clear seasonal pattern, currently off-season
- Medium confidence (0.65): Emerging seasonal pattern

**Priority**: 3 (Medium)

**Estimated Savings**: `capitalCostAvoidance + storage cost reduction`

---

### Category 6: Benchmarking Insights (3 Rules)

#### BENCHMARK_001: Cross-Location Cost Variance
**Trigger Conditions**:
- Multi-location deployment
- Same item purchased at >2 locations
- Price variance between locations >10%
- Vendor is available at both locations (or can ship to both)

**Data Sources**:
- `PriceSnapshot` (cross-location prices from Feature 1)
- `Branch` table (location info)

**Recommendation Template**:
```
Title: "Cross-Location Price Gap: {itemName}"
Description: "{branchA} pays ${priceA} for {itemName}, while {branchB} pays ${priceB} (a {percentDifference}% difference). Consider consolidating orders or negotiating location-level pricing."
Reasoning: "Price inconsistencies across locations suggest negotiation opportunities or procurement inefficiencies."
```

**Confidence Scoring**:
- High confidence (0.9): >20% price gap, same vendor
- Medium confidence (0.75): 10-20% gap

**Priority**: 2 (High - direct savings)

**Estimated Savings**: `(higherPrice - lowerPrice) * annual quantity at higher-price location`

---

#### BENCHMARK_002: Best Practice Sharing
**Trigger Conditions**:
- One location has significantly better performance metric (e.g., 20% lower cost per cover)
- Metric is within control of location (not market-driven)
- Underperforming location has been flagged multiple times

**Data Sources**:
- `SpendingMetric` aggregated by branch (if Feature 1 implemented)
- Cross-location comparison of efficiency ratios

**Recommendation Template**:
```
Title: "Best Practice: Learn from {topPerformingBranch}"
Description: "{topPerformingBranch} achieves {metricName} of {value}, {percentBetter}% better than {underperformingBranch}. Key practices: {practicesList}."
Reasoning: "Cross-location learning accelerates improvement. Site visits or process documentation sharing can transfer best practices."
```

**Confidence Scoring**:
- High confidence (0.8): Sustained performance difference, controlled for market factors
- Medium confidence (0.65): Recent performance difference

**Priority**: 4 (Low - long-term improvement)

**Estimated Savings**: `(underperformingMetric - benchmarkMetric) * annual volume`

---

#### BENCHMARK_003: Network Efficiency Ranking
**Trigger Conditions**:
- Multi-location deployment
- Location ranks in bottom quartile for key efficiency metric (cost per transaction, waste percentage, etc.)
- Sufficient data to normalize for location-specific factors (revenue, market, etc.)

**Data Sources**:
- `SpendingMetric` aggregated by branch
- Cross-location percentile ranking

**Recommendation Template**:
```
Title: "Performance Alert: {branchName} Efficiency Ranking"
Description: "{branchName} ranks in the bottom {percentile}% of locations for {metricName}. Network leaders achieve {benchmarkValue}, while {branchName} is at {actualValue}."
Reasoning: "Performance visibility drives improvement. Focus areas: {improvementOpportunities}."
```

**Confidence Scoring**:
- High confidence (0.85): Consistent bottom-quartile ranking across multiple metrics
- Medium confidence (0.7): Single metric underperformance

**Priority**: 3 (Medium - strategic improvement)

**Estimated Savings**: `improvementPotential (bring to median performance) * annual spending`

---

## 4. Service Layer

### 4.1 RuleEngine Service

**File**: `server/src/services/recommendations/ruleEngine.ts`

```typescript
import { RecommendationType, RecommendationStatus } from '@prisma/client';

export interface Rule {
  id: string;
  name: string;
  type: RecommendationType;
  category: string;
  priority: number;
  enabled: boolean;

  // Evaluation
  condition: (context: AnalyticsContext) => Promise<boolean>;
  generateRecommendation: (context: AnalyticsContext) => Promise<RecommendationPayload>;

  // Scoring
  calculateConfidence: (context: AnalyticsContext) => Promise<number>;
  estimateSavings: (context: AnalyticsContext) => Promise<number | null>;

  // Configuration
  threshold?: Record<string, number>;
}

export interface RecommendationPayload {
  title: string;
  description: string;
  reasoning: string;
  context: Record<string, any>;
}

export interface AnalyticsContext {
  // Entities
  items: ItemWithRelations[];
  vendors: VendorWithRelations[];
  invoices: InvoiceWithRelations[];
  branches?: BranchWithRelations[];

  // Analytics
  priceHistory: ItemPriceHistory[];
  spendingMetrics?: SpendingMetric[]; // From foundation
  purchasePatterns?: PurchasePattern[]; // From foundation
  priceSnapshots?: PriceSnapshot[]; // From foundation

  // Time windows
  dateRange: { start: Date; end: Date };
  comparisonRange?: { start: Date; end: Date };
}

export class RuleEngine {
  private rules: Map<string, Rule> = new Map();

  constructor() {
    this.registerDefaultRules();
  }

  /**
   * Register a rule with the engine
   */
  registerRule(rule: Rule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Unregister a rule
   */
  unregisterRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  /**
   * Get all registered rules
   */
  getAllRules(): Rule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get enabled rules only
   */
  getEnabledRules(): Rule[] {
    return Array.from(this.rules.values()).filter(r => r.enabled);
  }

  /**
   * Evaluate all enabled rules and generate recommendations
   */
  async evaluateRules(context: AnalyticsContext): Promise<RecommendationPayload[]> {
    const enabledRules = this.getEnabledRules();
    const recommendations: RecommendationPayload[] = [];

    for (const rule of enabledRules) {
      try {
        const shouldApply = await rule.condition(context);
        if (shouldApply) {
          const recommendation = await rule.generateRecommendation(context);
          const confidence = await rule.calculateConfidence(context);
          const estimatedSavings = await rule.estimateSavings(context);

          recommendations.push({
            ...recommendation,
            context: {
              ...recommendation.context,
              ruleId: rule.id,
              confidence,
              estimatedSavings,
              priority: rule.priority,
              type: rule.type,
              category: rule.category,
            }
          });
        }
      } catch (error) {
        console.error(`Rule ${rule.id} evaluation failed:`, error);
        // Continue evaluating other rules
      }
    }

    return recommendations;
  }

  /**
   * Evaluate a single rule
   */
  async evaluateRule(ruleId: string, context: AnalyticsContext): Promise<RecommendationPayload | null> {
    const rule = this.rules.get(ruleId);
    if (!rule || !rule.enabled) {
      return null;
    }

    const shouldApply = await rule.condition(context);
    if (!shouldApply) {
      return null;
    }

    const recommendation = await rule.generateRecommendation(context);
    const confidence = await rule.calculateConfidence(context);
    const estimatedSavings = await rule.estimateSavings(context);

    return {
      ...recommendation,
      context: {
        ...recommendation.context,
        ruleId: rule.id,
        confidence,
        estimatedSavings,
        priority: rule.priority,
        type: rule.type,
        category: rule.category,
      }
    };
  }

  /**
   * Update rule configuration (e.g., thresholds)
   */
  updateRuleConfig(ruleId: string, config: Partial<Rule>): void {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule ${ruleId} not found`);
    }

    Object.assign(rule, config);
  }

  /**
   * Register default rules (Phase 1 basic rules)
   */
  private registerDefaultRules(): void {
    // Import rule definitions from separate files
    // Example: this.registerRule(new PriceSpikeRule());
    // This keeps RuleEngine clean and rules modular
  }
}
```

### 4.2 RecommendationService

**File**: `server/src/services/recommendations/recommendationService.ts`

```typescript
import prisma from '../../prisma';
import { RuleEngine, AnalyticsContext } from './ruleEngine';
import { RecommendationType, RecommendationStatus } from '@prisma/client';
import { logger } from '../../utils/logger';

export class RecommendationService {
  private ruleEngine: RuleEngine;

  constructor() {
    this.ruleEngine = new RuleEngine();
  }

  /**
   * Generate all recommendations by evaluating rules
   * Called by background job (daily)
   */
  async generateRecommendations(): Promise<void> {
    logger.info('Starting recommendation generation');

    try {
      // 1. Build analytics context
      const context = await this.buildAnalyticsContext();

      // 2. Evaluate all rules
      const recommendationPayloads = await this.ruleEngine.evaluateRules(context);

      logger.info(`Generated ${recommendationPayloads.length} recommendations`);

      // 3. Deduplicate (check for existing PENDING recommendations with same context)
      const newRecommendations = await this.deduplicateRecommendations(recommendationPayloads);

      logger.info(`${newRecommendations.length} new recommendations after deduplication`);

      // 4. Persist to database
      const createdRecommendations = await this.saveRecommendations(newRecommendations);

      // 5. Expire old recommendations (>30 days old and still PENDING)
      await this.expireOldRecommendations();

      logger.info('Recommendation generation complete', {
        generated: recommendationPayloads.length,
        new: newRecommendations.length,
        saved: createdRecommendations.length,
      });
    } catch (error) {
      logger.error({ err: error }, 'Recommendation generation failed');
      throw error;
    }
  }

  /**
   * Get pending recommendations for dashboard
   */
  async getPendingRecommendations(filters?: {
    type?: RecommendationType;
    category?: string;
    priority?: number;
    branchId?: number;
    limit?: number;
  }): Promise<any[]> {
    const where: any = {
      status: RecommendationStatus.PENDING,
      expiresAt: {
        gt: new Date(), // Not expired
      },
    };

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.priority) {
      where.priority = filters.priority;
    }

    // Context-based filtering (requires JSON query)
    // For branchId, we'd need to query context field
    // Simplified for MVP: return all pending recommendations

    const recommendations = await prisma.recommendation.findMany({
      where,
      orderBy: [
        { priority: 'asc' }, // Lower number = higher priority
        { createdAt: 'desc' },
      ],
      take: filters?.limit || 50,
    });

    return recommendations.map(r => ({
      ...r,
      context: JSON.parse(r.context),
    }));
  }

  /**
   * Get recommendation by ID
   */
  async getRecommendationById(id: number): Promise<any> {
    const recommendation = await prisma.recommendation.findUnique({
      where: { id },
    });

    if (!recommendation) {
      return null;
    }

    return {
      ...recommendation,
      context: JSON.parse(recommendation.context),
    };
  }

  /**
   * Mark recommendation as viewed
   */
  async markViewed(id: number, userId: number): Promise<void> {
    await prisma.recommendation.update({
      where: { id },
      data: {
        status: RecommendationStatus.VIEWED,
        viewedAt: new Date(),
        viewedBy: userId,
      },
    });

    logger.info(`Recommendation ${id} marked as viewed by user ${userId}`);
  }

  /**
   * Dismiss recommendation
   */
  async dismiss(id: number, userId: number, reason?: string): Promise<void> {
    await prisma.recommendation.update({
      where: { id },
      data: {
        status: RecommendationStatus.DISMISSED,
        dismissedAt: new Date(),
        dismissedBy: userId,
        dismissReason: reason,
      },
    });

    logger.info(`Recommendation ${id} dismissed by user ${userId}`, { reason });
  }

  /**
   * Apply recommendation (mark as implemented)
   */
  async apply(id: number, userId: number): Promise<void> {
    await prisma.recommendation.update({
      where: { id },
      data: {
        status: RecommendationStatus.APPLIED,
        appliedAt: new Date(),
        appliedBy: userId,
      },
    });

    logger.info(`Recommendation ${id} applied by user ${userId}`);
  }

  /**
   * Get recommendation history (all statuses)
   */
  async getRecommendationHistory(filters?: {
    status?: RecommendationStatus;
    type?: RecommendationType;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ data: any[]; total: number }> {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [recommendations, total] = await Promise.all([
      prisma.recommendation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 20,
        skip: filters?.offset || 0,
      }),
      prisma.recommendation.count({ where }),
    ]);

    return {
      data: recommendations.map(r => ({
        ...r,
        context: JSON.parse(r.context),
      })),
      total,
    };
  }

  /**
   * Get recommendation statistics
   */
  async getRecommendationStats(filters?: {
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    total: number;
    pending: number;
    viewed: number;
    dismissed: number;
    applied: number;
    totalEstimatedSavings: number;
    realizedSavings: number;
  }> {
    const where: any = {};

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [statusCounts, savingsData] = await Promise.all([
      prisma.recommendation.groupBy({
        by: ['status'],
        where,
        _count: { status: true },
      }),
      prisma.recommendation.aggregate({
        where,
        _sum: { estimatedSavings: true },
      }),
    ]);

    const appliedRecommendations = await prisma.recommendation.aggregate({
      where: {
        ...where,
        status: RecommendationStatus.APPLIED,
      },
      _sum: { estimatedSavings: true },
    });

    const stats = {
      total: 0,
      pending: 0,
      viewed: 0,
      dismissed: 0,
      applied: 0,
      totalEstimatedSavings: savingsData._sum.estimatedSavings || 0,
      realizedSavings: appliedRecommendations._sum.estimatedSavings || 0,
    };

    statusCounts.forEach(sc => {
      stats.total += sc._count.status;
      const status = sc.status.toLowerCase() as keyof typeof stats;
      if (status in stats && typeof stats[status] === 'number') {
        (stats as any)[status] = sc._count.status;
      }
    });

    return stats;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Build analytics context for rule evaluation
   */
  private async buildAnalyticsContext(): Promise<AnalyticsContext> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90); // 90-day window

    const [items, vendors, invoices, priceHistory] = await Promise.all([
      prisma.item.findMany({
        where: { deletedAt: null },
        include: {
          vendor: true,
        },
      }),
      prisma.vendor.findMany({
        where: { deletedAt: null },
      }),
      prisma.invoice.findMany({
        where: {
          deletedAt: null,
          status: 'APPROVED',
          date: {
            gte: startDate,
            lte: endDate,
          },
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
        },
      }),
      prisma.itemPriceHistory.findMany({
        where: {
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: {
          date: 'asc',
        },
      }),
    ]);

    // Optional: Load foundation data if tables exist
    // This would require checking for table existence or catching errors
    // For MVP, we'll leave these as optional and handle gracefully in rules

    return {
      items,
      vendors,
      invoices,
      priceHistory,
      dateRange: { start: startDate, end: endDate },
    };
  }

  /**
   * Deduplicate recommendations (avoid creating duplicates)
   */
  private async deduplicateRecommendations(
    payloads: any[]
  ): Promise<any[]> {
    // For each payload, check if a PENDING recommendation exists with same:
    // - type
    // - context (item/vendor IDs)
    // If exists, skip

    const newPayloads: any[] = [];

    for (const payload of payloads) {
      const contextData = payload.context;

      // Build query to find existing recommendation
      // This is simplified; in production, you'd want more sophisticated matching
      const existingCount = await prisma.recommendation.count({
        where: {
          type: contextData.type,
          status: RecommendationStatus.PENDING,
          // Context matching would require JSON query or custom logic
          // For MVP, we'll use title matching as a proxy
          title: payload.title,
        },
      });

      if (existingCount === 0) {
        newPayloads.push(payload);
      }
    }

    return newPayloads;
  }

  /**
   * Save recommendations to database
   */
  private async saveRecommendations(payloads: any[]): Promise<any[]> {
    const createdRecommendations = [];

    for (const payload of payloads) {
      const contextData = payload.context;

      const recommendation = await prisma.recommendation.create({
        data: {
          type: contextData.type,
          category: contextData.category,
          title: payload.title,
          description: payload.description,
          reasoning: payload.reasoning,
          estimatedSavings: contextData.estimatedSavings || null,
          confidenceScore: contextData.confidence,
          priority: contextData.priority,
          context: JSON.stringify(payload.context),
          status: RecommendationStatus.PENDING,
          createdBy: 'SYSTEM',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      });

      createdRecommendations.push(recommendation);
    }

    return createdRecommendations;
  }

  /**
   * Expire old pending recommendations (>30 days)
   */
  private async expireOldRecommendations(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    const result = await prisma.recommendation.updateMany({
      where: {
        status: RecommendationStatus.PENDING,
        createdAt: {
          lt: cutoffDate,
        },
      },
      data: {
        status: RecommendationStatus.EXPIRED,
      },
    });

    logger.info(`Expired ${result.count} old recommendations`);
  }
}
```

### 4.3 Rule Implementation Example: COST_001 Price Spike Alert

**File**: `server/src/services/recommendations/rules/priceSpikeRule.ts`

```typescript
import { Rule, AnalyticsContext, RecommendationPayload } from '../ruleEngine';
import { RecommendationType } from '@prisma/client';

export class PriceSpikeRule implements Rule {
  id = 'COST_001';
  name = 'Price Spike Alert';
  type = RecommendationType.COST_OPTIMIZATION;
  category = 'Cost Optimization';
  priority = 2;
  enabled = true;
  threshold = {
    percentIncrease: 15,
    minPriceHistoryEntries: 3,
    daysRecent: 7,
  };

  async condition(context: AnalyticsContext): Promise<boolean> {
    // Check if any items have recent price spikes
    const recentSpikes = await this.detectPriceSpikes(context);
    return recentSpikes.length > 0;
  }

  async generateRecommendation(context: AnalyticsContext): Promise<RecommendationPayload> {
    const spikes = await this.detectPriceSpikes(context);
    const spike = spikes[0]; // Take first spike (rules can generate multiple recommendations)

    const item = context.items.find(i => i.id === spike.itemId);
    const vendor = context.vendors.find(v => v.id === item?.vendorId);

    const percentChange = Math.round(
      ((spike.newPrice - spike.avgPrice) / spike.avgPrice) * 100
    );

    return {
      title: `Price Spike Detected: ${item?.name}`,
      description: `${item?.name} from ${vendor?.name} increased ${percentChange}% (from $${spike.avgPrice.toFixed(2)} to $${spike.newPrice.toFixed(2)}). This is significantly above the 30-day average.`,
      reasoning: 'Sudden price increases may indicate supply chain disruptions or vendor opportunism. Consider negotiating with vendor, seeking alternative suppliers, or adjusting order quantities.',
      context: {
        itemId: item?.id,
        vendorId: vendor?.id,
        oldPrice: spike.avgPrice,
        newPrice: spike.newPrice,
        percentChange,
        priceHistoryIds: spike.priceHistoryIds,
      },
    };
  }

  async calculateConfidence(context: AnalyticsContext): Promise<number> {
    const spikes = await this.detectPriceSpikes(context);
    if (spikes.length === 0) return 0;

    const spike = spikes[0];
    const percentChange = ((spike.newPrice - spike.avgPrice) / spike.avgPrice) * 100;

    // High confidence for >20% increase with stable prior history
    if (percentChange > 20 && spike.priceHistoryStdDev < 5) {
      return 0.9;
    }

    // Medium confidence for 15-20% increase
    if (percentChange >= 15 && percentChange <= 20) {
      return 0.7;
    }

    // Low confidence for 10-15% increase
    return 0.5;
  }

  async estimateSavings(context: AnalyticsContext): Promise<number | null> {
    const spikes = await this.detectPriceSpikes(context);
    if (spikes.length === 0) return null;

    const spike = spikes[0];

    // Estimate annual savings if price is negotiated back to average
    const priceReduction = spike.newPrice - spike.avgPrice;

    // Estimate monthly quantity from invoice data
    const itemInvoices = context.invoices
      .flatMap(inv => inv.items)
      .filter(invItem => invItem.itemId === spike.itemId);

    const totalQuantity = itemInvoices.reduce((sum, invItem) => sum + invItem.quantity, 0);
    const avgMonthlyQuantity = totalQuantity / 3; // 90-day context / 3 months

    const annualSavings = priceReduction * avgMonthlyQuantity * 12;

    return Math.round(annualSavings);
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async detectPriceSpikes(context: AnalyticsContext): Promise<any[]> {
    const spikes: any[] = [];

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.threshold.daysRecent);

    // Group price history by item
    const priceHistoryByItem = context.priceHistory.reduce((acc, ph) => {
      if (!acc[ph.itemId]) acc[ph.itemId] = [];
      acc[ph.itemId].push(ph);
      return acc;
    }, {} as Record<number, any[]>);

    for (const [itemIdStr, priceHistoryEntries] of Object.entries(priceHistoryByItem)) {
      const itemId = parseInt(itemIdStr);

      // Must have minimum price history entries
      if (priceHistoryEntries.length < this.threshold.minPriceHistoryEntries) {
        continue;
      }

      // Sort by date ascending
      priceHistoryEntries.sort((a, b) => a.date.getTime() - b.date.getTime());

      // Get most recent entry
      const mostRecent = priceHistoryEntries[priceHistoryEntries.length - 1];

      // Check if recent (within threshold)
      if (mostRecent.date < cutoffDate) {
        continue;
      }

      // Calculate 30-day average (excluding most recent)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const priorEntries = priceHistoryEntries
        .filter(ph => ph.date < mostRecent.date && ph.date >= thirtyDaysAgo);

      if (priorEntries.length === 0) continue;

      const avgPrice = priorEntries.reduce((sum, ph) => sum + ph.price, 0) / priorEntries.length;
      const stdDev = this.calculateStdDev(priorEntries.map(ph => ph.price));

      // Check if price spike exceeds threshold
      const percentIncrease = ((mostRecent.price - avgPrice) / avgPrice) * 100;

      if (percentIncrease >= this.threshold.percentIncrease) {
        spikes.push({
          itemId,
          newPrice: mostRecent.price,
          avgPrice,
          priceHistoryStdDev: stdDev,
          priceHistoryIds: priorEntries.map(ph => ph.id),
        });
      }
    }

    return spikes;
  }

  private calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0;

    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
    const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;

    return Math.sqrt(variance);
  }
}
```

---

## 5. API Endpoints

### 5.1 Endpoint Specifications

**Base Route**: `/api/analytics/recommendations`

#### GET /api/analytics/recommendations
**Description**: Get active (PENDING) recommendations for dashboard

**Authentication**: Required (JWT)

**Authorization**: `Permission.ANALYTICS_READ`

**Query Parameters**:
```typescript
{
  type?: RecommendationType;        // Filter by recommendation type
  category?: string;                // Filter by category
  priority?: number;                // Filter by priority (1-5)
  branchId?: number;                // Filter by branch (from context)
  limit?: number;                   // Max results (default: 50)
}
```

**Response**:
```typescript
{
  data: {
    id: number;
    type: RecommendationType;
    category: string;
    title: string;
    description: string;
    reasoning: string;
    estimatedSavings: number | null;
    confidenceScore: number;
    priority: number;
    context: Record<string, any>;
    status: RecommendationStatus;
    createdAt: string;
    expiresAt: string | null;
  }[];
  total: number;
}
```

**Status Codes**:
- 200: Success
- 401: Unauthorized
- 403: Forbidden (missing permission)
- 500: Internal Server Error

---

#### GET /api/analytics/recommendations/:id
**Description**: Get detailed recommendation by ID

**Authentication**: Required (JWT)

**Authorization**: `Permission.ANALYTICS_READ`

**Path Parameters**:
- `id` (integer): Recommendation ID

**Response**:
```typescript
{
  id: number;
  type: RecommendationType;
  category: string;
  title: string;
  description: string;
  reasoning: string;
  estimatedSavings: number | null;
  confidenceScore: number;
  priority: number;
  context: Record<string, any>;
  status: RecommendationStatus;
  createdAt: string;
  expiresAt: string | null;
  viewedAt: string | null;
  viewedBy: number | null;
  dismissedAt: string | null;
  dismissedBy: number | null;
  dismissReason: string | null;
  appliedAt: string | null;
  appliedBy: number | null;
}
```

**Status Codes**:
- 200: Success
- 401: Unauthorized
- 403: Forbidden
- 404: Recommendation not found
- 500: Internal Server Error

---

#### POST /api/analytics/recommendations/:id/dismiss
**Description**: Dismiss a recommendation (mark as not relevant)

**Authentication**: Required (JWT)

**Authorization**: `Permission.ANALYTICS_WRITE` (or MANAGER role)

**Path Parameters**:
- `id` (integer): Recommendation ID

**Request Body**:
```typescript
{
  reason?: string; // Optional dismissal reason
}
```

**Response**:
```typescript
{
  success: true;
  message: "Recommendation dismissed successfully";
}
```

**Status Codes**:
- 200: Success
- 400: Invalid request (recommendation already actioned)
- 401: Unauthorized
- 403: Forbidden
- 404: Recommendation not found
- 500: Internal Server Error

---

#### POST /api/analytics/recommendations/:id/accept
**Description**: Accept recommendation (mark as implemented)

**Authentication**: Required (JWT)

**Authorization**: `Permission.ANALYTICS_WRITE` (or MANAGER role)

**Path Parameters**:
- `id` (integer): Recommendation ID

**Request Body**:
```typescript
{
  notes?: string; // Optional implementation notes
}
```

**Response**:
```typescript
{
  success: true;
  message: "Recommendation accepted successfully";
}
```

**Status Codes**:
- 200: Success
- 400: Invalid request (recommendation already actioned)
- 401: Unauthorized
- 403: Forbidden
- 404: Recommendation not found
- 500: Internal Server Error

---

#### GET /api/analytics/recommendations/history
**Description**: Get recommendation history (all statuses) with filters

**Authentication**: Required (JWT)

**Authorization**: `Permission.ANALYTICS_READ`

**Query Parameters**:
```typescript
{
  status?: RecommendationStatus;   // Filter by status
  type?: RecommendationType;       // Filter by type
  startDate?: string;              // ISO date string
  endDate?: string;                // ISO date string
  page?: number;                   // Page number (default: 1)
  limit?: number;                  // Results per page (default: 20)
}
```

**Response**:
```typescript
{
  data: {
    id: number;
    type: RecommendationType;
    category: string;
    title: string;
    description: string;
    estimatedSavings: number | null;
    confidenceScore: number;
    priority: number;
    status: RecommendationStatus;
    createdAt: string;
    appliedAt: string | null;
    dismissedAt: string | null;
  }[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}
```

**Status Codes**:
- 200: Success
- 401: Unauthorized
- 403: Forbidden
- 500: Internal Server Error

---

#### GET /api/analytics/recommendations/stats
**Description**: Get recommendation statistics and metrics

**Authentication**: Required (JWT)

**Authorization**: `Permission.ANALYTICS_READ`

**Query Parameters**:
```typescript
{
  startDate?: string;  // ISO date string
  endDate?: string;    // ISO date string
}
```

**Response**:
```typescript
{
  total: number;                    // Total recommendations
  pending: number;                  // Pending recommendations
  viewed: number;                   // Viewed but not actioned
  dismissed: number;                // Dismissed recommendations
  applied: number;                  // Applied recommendations
  totalEstimatedSavings: number;    // Sum of all estimated savings
  realizedSavings: number;          // Sum of applied recommendations' savings
  acceptanceRate: number;           // applied / (applied + dismissed)
  avgTimeToAction: number;          // Avg days from created to actioned
}
```

**Status Codes**:
- 200: Success
- 401: Unauthorized
- 403: Forbidden
- 500: Internal Server Error

---

### 5.2 Routes Implementation

**File**: `server/src/routes/analyticsRecommendations.ts`

```typescript
import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { Permission } from '../constants/permissions';
import { RecommendationService } from '../services/recommendations/recommendationService';
import { logger } from '../utils/logger';
import { z } from 'zod';

const router = express.Router();
const recommendationService = new RecommendationService();

// All routes require authentication
router.use(authenticateToken);

// GET /api/analytics/recommendations - Get active recommendations
router.get('/', authorize(Permission.ANALYTICS_READ), async (req, res) => {
  try {
    const filters = {
      type: req.query.type as any,
      category: req.query.category as string,
      priority: req.query.priority ? parseInt(req.query.priority as string) : undefined,
      branchId: req.query.branchId ? parseInt(req.query.branchId as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
    };

    const recommendations = await recommendationService.getPendingRecommendations(filters);

    res.json({
      data: recommendations,
      total: recommendations.length,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to retrieve recommendations');
    res.status(500).json({ error: 'Failed to retrieve recommendations' });
  }
});

// GET /api/analytics/recommendations/history - Get recommendation history
router.get('/history', authorize(Permission.ANALYTICS_READ), async (req, res) => {
  try {
    const filters = {
      status: req.query.status as any,
      type: req.query.type as any,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      offset: req.query.page
        ? (parseInt(req.query.page as string) - 1) * (req.query.limit ? parseInt(req.query.limit as string) : 20)
        : 0,
    };

    const { data, total } = await recommendationService.getRecommendationHistory(filters);

    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = filters.limit;
    const totalPages = Math.ceil(total / limit);

    res.json({
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to retrieve recommendation history');
    res.status(500).json({ error: 'Failed to retrieve recommendation history' });
  }
});

// GET /api/analytics/recommendations/stats - Get recommendation statistics
router.get('/stats', authorize(Permission.ANALYTICS_READ), async (req, res) => {
  try {
    const filters = {
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    };

    const stats = await recommendationService.getRecommendationStats(filters);

    // Calculate acceptance rate
    const acceptanceRate =
      stats.applied + stats.dismissed > 0
        ? (stats.applied / (stats.applied + stats.dismissed)) * 100
        : 0;

    res.json({
      ...stats,
      acceptanceRate: Math.round(acceptanceRate * 100) / 100,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to retrieve recommendation stats');
    res.status(500).json({ error: 'Failed to retrieve recommendation stats' });
  }
});

// GET /api/analytics/recommendations/:id - Get recommendation by ID
router.get('/:id', authorize(Permission.ANALYTICS_READ), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const recommendation = await recommendationService.getRecommendationById(id);

    if (!recommendation) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }

    res.json(recommendation);
  } catch (error) {
    logger.error({ err: error }, 'Failed to retrieve recommendation');
    res.status(500).json({ error: 'Failed to retrieve recommendation' });
  }
});

// POST /api/analytics/recommendations/:id/dismiss - Dismiss recommendation
router.post('/:id/dismiss', authorize(Permission.ANALYTICS_WRITE), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = (req as any).user.id;
    const reason = req.body.reason as string | undefined;

    await recommendationService.dismiss(id, userId, reason);

    res.json({
      success: true,
      message: 'Recommendation dismissed successfully',
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to dismiss recommendation');
    res.status(500).json({ error: 'Failed to dismiss recommendation' });
  }
});

// POST /api/analytics/recommendations/:id/accept - Accept recommendation
router.post('/:id/accept', authorize(Permission.ANALYTICS_WRITE), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = (req as any).user.id;

    await recommendationService.apply(id, userId);

    res.json({
      success: true,
      message: 'Recommendation accepted successfully',
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to accept recommendation');
    res.status(500).json({ error: 'Failed to accept recommendation' });
  }
});

export default router;
```

**Integration into main server**:

Update `server/src/index.ts`:
```typescript
// Add to imports
import analyticsRecommendationsRoutes from './routes/analyticsRecommendations';

// Add to routes (after existing analytics route)
app.use('/api/analytics/recommendations', analyticsRecommendationsRoutes);
```

---

## 6. Frontend Components

### 6.1 Component Architecture

```
client/src/
├── pages/
│   └── RecommendationsDashboard.tsx     # Main dashboard page
├── components/
│   └── recommendations/
│       ├── RecommendationCard.tsx       # Individual recommendation card
│       ├── RecommendationDetailModal.tsx # Full detail modal
│       ├── RecommendationFilters.tsx    # Filter sidebar
│       ├── RecommendationStats.tsx      # Stats summary cards
│       └── RecommendationHistory.tsx    # Historical view
└── services/
    └── recommendationService.ts         # API client
```

### 6.2 Main Dashboard Component

**File**: `client/src/pages/RecommendationsDashboard.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { RecommendationCard } from '../components/recommendations/RecommendationCard';
import { RecommendationFilters } from '../components/recommendations/RecommendationFilters';
import { RecommendationStats } from '../components/recommendations/RecommendationStats';
import { RecommendationDetailModal } from '../components/recommendations/RecommendationDetailModal';
import { recommendationService } from '../services/recommendationService';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Skeleton } from '../components/ui/skeleton';
import { Badge } from '../components/ui/badge';

interface Recommendation {
  id: number;
  type: string;
  category: string;
  title: string;
  description: string;
  reasoning: string;
  estimatedSavings: number | null;
  confidenceScore: number;
  priority: number;
  context: Record<string, any>;
  status: string;
  createdAt: string;
  expiresAt: string | null;
}

export const RecommendationsDashboard: React.FC = () => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [filteredRecommendations, setFilteredRecommendations] = useState<Recommendation[]>([]);
  const [selectedRecommendation, setSelectedRecommendation] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState({
    category: 'all',
    priority: 'all',
    type: 'all',
  });

  useEffect(() => {
    fetchRecommendations();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [recommendations, filters]);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await recommendationService.getRecommendations();
      setRecommendations(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = recommendations;

    if (filters.category !== 'all') {
      filtered = filtered.filter(r => r.category === filters.category);
    }

    if (filters.priority !== 'all') {
      filtered = filtered.filter(r => r.priority === parseInt(filters.priority));
    }

    if (filters.type !== 'all') {
      filtered = filtered.filter(r => r.type === filters.type);
    }

    setFilteredRecommendations(filtered);
  };

  const handleDismiss = async (id: number, reason?: string) => {
    try {
      await recommendationService.dismissRecommendation(id, reason);
      setRecommendations(prev => prev.filter(r => r.id !== id));
      setSelectedRecommendation(null);
    } catch (err: any) {
      alert('Failed to dismiss recommendation: ' + err.message);
    }
  };

  const handleAccept = async (id: number) => {
    try {
      await recommendationService.acceptRecommendation(id);
      setRecommendations(prev => prev.filter(r => r.id !== id));
      setSelectedRecommendation(null);
    } catch (err: any) {
      alert('Failed to accept recommendation: ' + err.message);
    }
  };

  const groupedRecommendations = filteredRecommendations.reduce((acc, rec) => {
    if (!acc[rec.category]) {
      acc[rec.category] = [];
    }
    acc[rec.category].push(rec);
    return acc;
  }, {} as Record<string, Recommendation[]>);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">AI Smart Consultant</h1>
        <RecommendationStats loading={true} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">AI Smart Consultant</h1>
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">AI Smart Consultant</h1>
        <Badge variant="secondary">
          {filteredRecommendations.length} Active Recommendation{filteredRecommendations.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <RecommendationStats recommendations={recommendations} />

      <div className="flex gap-6 mt-6">
        <div className="w-64 flex-shrink-0">
          <RecommendationFilters
            filters={filters}
            onFiltersChange={setFilters}
            availableCategories={Array.from(new Set(recommendations.map(r => r.category)))}
          />
        </div>

        <div className="flex-1">
          {filteredRecommendations.length === 0 ? (
            <Alert>
              <AlertDescription>
                No recommendations match your current filters. Try adjusting the filters or check back later for new insights.
              </AlertDescription>
            </Alert>
          ) : (
            Object.entries(groupedRecommendations).map(([category, recs]) => (
              <div key={category} className="mb-8">
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  {category}
                  <Badge variant="outline" className="ml-2">
                    {recs.length}
                  </Badge>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recs.map(rec => (
                    <RecommendationCard
                      key={rec.id}
                      recommendation={rec}
                      onViewDetails={() => setSelectedRecommendation(rec)}
                      onDismiss={() => handleDismiss(rec.id)}
                      onAccept={() => handleAccept(rec.id)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {selectedRecommendation && (
        <RecommendationDetailModal
          recommendation={selectedRecommendation}
          onClose={() => setSelectedRecommendation(null)}
          onDismiss={handleDismiss}
          onAccept={handleAccept}
        />
      )}
    </div>
  );
};
```

### 6.3 Recommendation Card Component

**File**: `client/src/components/recommendations/RecommendationCard.tsx`

```typescript
import React from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';

interface RecommendationCardProps {
  recommendation: {
    id: number;
    type: string;
    category: string;
    title: string;
    description: string;
    estimatedSavings: number | null;
    confidenceScore: number;
    priority: number;
  };
  onViewDetails: () => void;
  onDismiss: () => void;
  onAccept: () => void;
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
  onViewDetails,
  onDismiss,
  onAccept,
}) => {
  const priorityColors = {
    1: 'destructive',
    2: 'warning',
    3: 'default',
    4: 'secondary',
    5: 'outline',
  };

  const priorityLabels = {
    1: 'Critical',
    2: 'High',
    3: 'Medium',
    4: 'Low',
    5: 'Info',
  };

  const confidencePercent = Math.round(recommendation.confidenceScore * 100);

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <Badge variant={priorityColors[recommendation.priority as keyof typeof priorityColors] as any}>
            {priorityLabels[recommendation.priority as keyof typeof priorityLabels]}
          </Badge>
          {recommendation.estimatedSavings && (
            <span className="text-sm font-semibold text-green-600">
              ${recommendation.estimatedSavings.toLocaleString()} potential savings
            </span>
          )}
        </div>
        <CardTitle className="text-lg mt-2">{recommendation.title}</CardTitle>
        <CardDescription className="line-clamp-2">
          {recommendation.description}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="flex justify-between text-sm text-gray-500">
          <span>Confidence: {confidencePercent}%</span>
          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
            {recommendation.category}
          </span>
        </div>
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onViewDetails} className="flex-1">
          Learn More
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
        <Button variant="default" size="sm" onClick={onAccept}>
          Accept
        </Button>
      </CardFooter>
    </Card>
  );
};
```

### 6.4 Recommendation Detail Modal

**File**: `client/src/components/recommendations/RecommendationDetailModal.tsx`

```typescript
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';

interface RecommendationDetailModalProps {
  recommendation: {
    id: number;
    type: string;
    category: string;
    title: string;
    description: string;
    reasoning: string;
    estimatedSavings: number | null;
    confidenceScore: number;
    priority: number;
    context: Record<string, any>;
    createdAt: string;
  };
  onClose: () => void;
  onDismiss: (id: number, reason?: string) => void;
  onAccept: (id: number) => void;
}

export const RecommendationDetailModal: React.FC<RecommendationDetailModalProps> = ({
  recommendation,
  onClose,
  onDismiss,
  onAccept,
}) => {
  const [showDismissReason, setShowDismissReason] = useState(false);
  const [dismissReason, setDismissReason] = useState('');

  const handleDismiss = () => {
    if (showDismissReason) {
      onDismiss(recommendation.id, dismissReason);
    } else {
      setShowDismissReason(true);
    }
  };

  const handleAccept = () => {
    onAccept(recommendation.id);
  };

  const priorityLabels = {
    1: 'Critical',
    2: 'High',
    3: 'Medium',
    4: 'Low',
    5: 'Info',
  };

  const confidencePercent = Math.round(recommendation.confidenceScore * 100);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex justify-between items-center mb-2">
            <Badge variant="outline">{recommendation.category}</Badge>
            <Badge variant="secondary">
              {priorityLabels[recommendation.priority as keyof typeof priorityLabels]} Priority
            </Badge>
          </div>
          <DialogTitle className="text-2xl">{recommendation.title}</DialogTitle>
          <DialogDescription className="text-base mt-2">
            {recommendation.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <h3 className="font-semibold mb-2">Why this recommendation?</h3>
            <p className="text-sm text-gray-600">{recommendation.reasoning}</p>
          </div>

          {recommendation.estimatedSavings && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-800 mb-1">Estimated Annual Savings</h3>
              <p className="text-2xl font-bold text-green-600">
                ${recommendation.estimatedSavings.toLocaleString()}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-500">Confidence Score</h4>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${confidencePercent}%` }}
                  />
                </div>
                <span className="text-sm font-semibold">{confidencePercent}%</span>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-500">Created</h4>
              <p className="text-sm mt-1">
                {new Date(recommendation.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {recommendation.context && Object.keys(recommendation.context).length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Supporting Data</h3>
              <div className="bg-gray-50 rounded-lg p-3 text-xs font-mono">
                {Object.entries(recommendation.context)
                  .filter(([key]) => !['ruleId', 'confidence', 'estimatedSavings', 'priority', 'type', 'category'].includes(key))
                  .map(([key, value]) => (
                    <div key={key} className="mb-1">
                      <span className="text-gray-500">{key}:</span> {JSON.stringify(value)}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {showDismissReason && (
            <div>
              <label className="block text-sm font-semibold mb-2">
                Why are you dismissing this recommendation? (Optional)
              </label>
              <Textarea
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                placeholder="E.g., Already addressed, not relevant to our business, incorrect data..."
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="outline" onClick={handleDismiss}>
            {showDismissReason ? 'Submit Dismissal' : 'Dismiss'}
          </Button>
          <Button variant="default" onClick={handleAccept}>
            Accept & Implement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

### 6.5 API Service Client

**File**: `client/src/services/recommendationService.ts`

```typescript
import api from '../lib/api';

export interface Recommendation {
  id: number;
  type: string;
  category: string;
  title: string;
  description: string;
  reasoning: string;
  estimatedSavings: number | null;
  confidenceScore: number;
  priority: number;
  context: Record<string, any>;
  status: string;
  createdAt: string;
  expiresAt: string | null;
}

export interface RecommendationStats {
  total: number;
  pending: number;
  viewed: number;
  dismissed: number;
  applied: number;
  totalEstimatedSavings: number;
  realizedSavings: number;
  acceptanceRate: number;
}

class RecommendationService {
  async getRecommendations(filters?: {
    type?: string;
    category?: string;
    priority?: number;
    branchId?: number;
    limit?: number;
  }): Promise<{ data: Recommendation[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.priority) params.append('priority', filters.priority.toString());
    if (filters?.branchId) params.append('branchId', filters.branchId.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/api/analytics/recommendations?${params.toString()}`);
    return response.data;
  }

  async getRecommendationById(id: number): Promise<Recommendation> {
    const response = await api.get(`/api/analytics/recommendations/${id}`);
    return response.data;
  }

  async dismissRecommendation(id: number, reason?: string): Promise<void> {
    await api.post(`/api/analytics/recommendations/${id}/dismiss`, { reason });
  }

  async acceptRecommendation(id: number): Promise<void> {
    await api.post(`/api/analytics/recommendations/${id}/accept`);
  }

  async getRecommendationHistory(filters?: {
    status?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Recommendation[]; pagination: any }> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/api/analytics/recommendations/history?${params.toString()}`);
    return response.data;
  }

  async getRecommendationStats(filters?: {
    startDate?: string;
    endDate?: string;
  }): Promise<RecommendationStats> {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const response = await api.get(`/api/analytics/recommendations/stats?${params.toString()}`);
    return response.data;
  }
}

export const recommendationService = new RecommendationService();
```

---

## 7. Implementation Phases

### Phase 1: Rule Engine + Basic Rules (4 days)

**Goal**: Implement core infrastructure and 10 basic rules using existing data

**Tasks**:
1. Create RuleEngine class with registration and evaluation logic (0.5 day)
2. Define Rule interface and AnalyticsContext (0.5 day)
3. Implement 10 basic rules (2 days):
   - COST_001: Price Spike Alert
   - COST_002: Vendor Consolidation Opportunity
   - COST_003: Bulk Purchase Opportunity
   - PATTERN_001: Order Frequency Optimization
   - PATTERN_004: Reorder Point Optimization (basic version)
   - WASTE_001: Spoilage Risk Alert (heuristic-based)
   - RISK_001: Single-Source Dependency
   - RISK_003: Price Volatility Alert
   - SEASONAL_001: Demand Forecasting (basic historical)
   - BENCHMARK_001: Cross-Location Cost Variance (if multi-branch)
4. Unit tests for RuleEngine and 2-3 rules (1 day)

**Deliverables**:
- ✅ `server/src/services/recommendations/ruleEngine.ts`
- ✅ `server/src/services/recommendations/rules/*.ts` (10 rule files)
- ✅ Unit tests with >80% coverage

**Verification**:
- RuleEngine can register and evaluate rules
- Rules correctly identify conditions and generate recommendations
- All tests passing

---

### Phase 2: Natural Language Generation (2 days)

**Goal**: Enhance recommendation outputs with clear, actionable language

**Tasks**:
1. Refine recommendation templates for clarity (0.5 day)
2. Implement dynamic placeholders (item names, vendor names, metrics) (0.5 day)
3. Add reasoning sections explaining "why" and "what to do" (0.5 day)
4. User feedback integration (capture dismissal reasons for tuning) (0.5 day)

**Deliverables**:
- ✅ Improved recommendation payloads with structured output
- ✅ Dismissal reason tracking

**Verification**:
- Recommendations are understandable without technical knowledge
- Users can understand reasoning and action steps

---

### Phase 3: Recommendation Scoring Logic (2 days)

**Goal**: Implement confidence scoring and estimated savings calculations

**Tasks**:
1. Implement confidence scoring for each rule (1 day)
2. Implement estimated savings calculations for cost-optimization rules (1 day)
3. Test scoring accuracy against sample data

**Deliverables**:
- ✅ `calculateConfidence()` implemented for all rules
- ✅ `estimateSavings()` implemented for relevant rules

**Verification**:
- Confidence scores reflect data quality and rule strength
- Savings estimates are reasonable (within 20% of manual calculation)

---

### Phase 4: API Endpoints (2 days)

**Goal**: Build RESTful API for recommendation access and management

**Tasks**:
1. Create RecommendationService class (0.5 day)
2. Implement API routes (1 day):
   - GET /api/analytics/recommendations
   - GET /api/analytics/recommendations/:id
   - POST /api/analytics/recommendations/:id/dismiss
   - POST /api/analytics/recommendations/:id/accept
   - GET /api/analytics/recommendations/history
   - GET /api/analytics/recommendations/stats
3. Add permission checks and validation (0.5 day)

**Deliverables**:
- ✅ `server/src/services/recommendations/recommendationService.ts`
- ✅ `server/src/routes/analyticsRecommendations.ts`
- ✅ API endpoints functional and secured

**Verification**:
- All endpoints return correct data
- Permission checks working (ANALYTICS_READ, ANALYTICS_WRITE)
- Postman/API tests passing

---

### Phase 5: Frontend Dashboard (5 days)

**Goal**: Build user interface for viewing and managing recommendations

**Tasks**:
1. Create RecommendationsDashboard page (1 day)
2. Build RecommendationCard component (1 day)
3. Build RecommendationDetailModal (1 day)
4. Implement filters and stats components (1 day)
5. Add routing and navigation (0.5 day)
6. Polish UI/UX (responsive, animations, loading states) (0.5 day)

**Deliverables**:
- ✅ `client/src/pages/RecommendationsDashboard.tsx`
- ✅ `client/src/components/recommendations/*.tsx`
- ✅ `client/src/services/recommendationService.ts`
- ✅ Route added to React Router

**Verification**:
- Dashboard displays recommendations grouped by category
- Users can view details, accept, and dismiss recommendations
- Filters work correctly
- Responsive on mobile and desktop

---

### Phase 6: User Feedback Loop + Tuning (3 days)

**Goal**: Collect user feedback and tune rules based on real-world usage

**Tasks**:
1. Deploy to staging environment (0.5 day)
2. Collect initial user feedback on 20+ recommendations (1 day)
3. Analyze dismissal reasons and acceptance rate (0.5 day)
4. Tune rule thresholds based on feedback (0.5 day)
5. Document rule configurations and tuning guidelines (0.5 day)

**Deliverables**:
- ✅ Feedback analysis report
- ✅ Updated rule thresholds
- ✅ Configuration documentation

**Verification**:
- Recommendation relevance rate >80% (not immediately dismissed)
- Acceptance rate >20% (reasonable for MVP)
- False positive rate <15%

---

## 8. Rule Extensibility

### Adding New Rules

**Step 1: Create Rule Class**

Create a new file in `server/src/services/recommendations/rules/`:

```typescript
// Example: newRule.ts
import { Rule, AnalyticsContext, RecommendationPayload } from '../ruleEngine';
import { RecommendationType } from '@prisma/client';

export class NewRule implements Rule {
  id = 'CATEGORY_###'; // Unique ID
  name = 'Rule Name';
  type = RecommendationType.APPROPRIATE_TYPE;
  category = 'Category Name';
  priority = 3; // 1-5
  enabled = true;
  threshold = {
    // Configurable thresholds
    exampleThreshold: 20,
  };

  async condition(context: AnalyticsContext): Promise<boolean> {
    // Implement condition logic
    return false;
  }

  async generateRecommendation(context: AnalyticsContext): Promise<RecommendationPayload> {
    // Generate recommendation
    return {
      title: 'Title',
      description: 'Description',
      reasoning: 'Reasoning',
      context: {},
    };
  }

  async calculateConfidence(context: AnalyticsContext): Promise<number> {
    // Calculate confidence score (0-1)
    return 0.8;
  }

  async estimateSavings(context: AnalyticsContext): Promise<number | null> {
    // Estimate annual savings (or null)
    return null;
  }
}
```

**Step 2: Register Rule**

Update `RuleEngine.registerDefaultRules()`:

```typescript
import { NewRule } from './rules/newRule';

private registerDefaultRules(): void {
  this.registerRule(new PriceSpikeRule());
  // ... existing rules
  this.registerRule(new NewRule());
}
```

**Step 3: Test Rule**

Create unit test:

```typescript
// server/src/services/recommendations/rules/__tests__/newRule.test.ts
import { NewRule } from '../newRule';
import { buildMockContext } from '../../__tests__/helpers';

describe('NewRule', () => {
  it('should detect condition when threshold exceeded', async () => {
    const rule = new NewRule();
    const context = buildMockContext({
      // Mock data
    });

    const result = await rule.condition(context);
    expect(result).toBe(true);
  });

  it('should generate recommendation with correct format', async () => {
    const rule = new NewRule();
    const context = buildMockContext({});

    const recommendation = await rule.generateRecommendation(context);
    expect(recommendation.title).toBeDefined();
    expect(recommendation.description).toBeDefined();
    expect(recommendation.reasoning).toBeDefined();
  });
});
```

**Step 4: Configuration**

Rules can be configured via:
1. Database (future: `RuleConfig` table)
2. Environment variables
3. Admin UI (future)

Example configuration:

```typescript
// Via code
ruleEngine.updateRuleConfig('COST_001', {
  enabled: false, // Disable rule
  threshold: {
    percentIncrease: 20, // Increase threshold
  },
});
```

### Rule Configuration UI (Future)

**Admin page at `/admin/rules`**:
- List all rules with enable/disable toggles
- Edit thresholds per rule
- View rule performance metrics (acceptance rate, false positive rate)
- A/B test rules (enable for 50% of users)

---

## 9. Testing Strategy

### 9.1 Unit Tests

**Test Coverage Targets**:
- RuleEngine: 100%
- Individual Rules: 90%
- RecommendationService: 85%

**Test Files**:
```
server/src/services/recommendations/__tests__/
├── ruleEngine.test.ts
├── recommendationService.test.ts
└── rules/
    ├── priceSpikeRule.test.ts
    ├── vendorConsolidationRule.test.ts
    └── ... (one per rule)
```

**Example Test**:
```typescript
import { RuleEngine } from '../ruleEngine';
import { PriceSpikeRule } from '../rules/priceSpikeRule';
import { buildMockContext } from './helpers';

describe('RuleEngine', () => {
  let engine: RuleEngine;

  beforeEach(() => {
    engine = new RuleEngine();
  });

  it('should register rules', () => {
    const rule = new PriceSpikeRule();
    engine.registerRule(rule);
    expect(engine.getAllRules()).toHaveLength(1);
  });

  it('should evaluate rules and generate recommendations', async () => {
    engine.registerRule(new PriceSpikeRule());

    const context = buildMockContext({
      priceHistory: [
        { itemId: 1, price: 10, date: new Date('2025-11-01') },
        { itemId: 1, price: 12, date: new Date('2025-12-01') },
        { itemId: 1, price: 15, date: new Date('2025-12-05') }, // 50% spike
      ],
      items: [{ id: 1, name: 'Test Item', vendorId: 1 }],
      vendors: [{ id: 1, name: 'Test Vendor' }],
    });

    const recommendations = await engine.evaluateRules(context);
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0].title).toContain('Price Spike');
  });
});
```

### 9.2 Integration Tests

**Test API Endpoints**:
```typescript
import request from 'supertest';
import app from '../../../index';
import { generateTestToken } from '../../__tests__/helpers';

describe('GET /api/analytics/recommendations', () => {
  it('should return pending recommendations', async () => {
    const token = generateTestToken({ role: 'MANAGER' });

    const response = await request(app)
      .get('/api/analytics/recommendations')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.data).toBeInstanceOf(Array);
    expect(response.body.total).toBeGreaterThanOrEqual(0);
  });

  it('should require authentication', async () => {
    await request(app)
      .get('/api/analytics/recommendations')
      .expect(401);
  });

  it('should accept recommendation', async () => {
    const token = generateTestToken({ role: 'MANAGER' });
    const recommendationId = 1; // Assume exists in test DB

    const response = await request(app)
      .post(`/api/analytics/recommendations/${recommendationId}/accept`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.success).toBe(true);
  });
});
```

### 9.3 Rule Accuracy Tests

**Precision/Recall Testing**:
```typescript
describe('PriceSpikeRule Accuracy', () => {
  it('should have high precision (true positives / total positives)', async () => {
    const rule = new PriceSpikeRule();
    const testCases = loadTestDataset('price_spike_labeled.json');

    let truePositives = 0;
    let falsePositives = 0;

    for (const testCase of testCases) {
      const context = buildContextFromTestCase(testCase);
      const result = await rule.condition(context);

      if (result && testCase.label === 'spike') {
        truePositives++;
      } else if (result && testCase.label !== 'spike') {
        falsePositives++;
      }
    }

    const precision = truePositives / (truePositives + falsePositives);
    expect(precision).toBeGreaterThan(0.8); // 80% precision target
  });
});
```

### 9.4 User Acceptance Testing

**Test Scenarios**:
1. **Scenario: Manager reviews daily recommendations**
   - Navigate to /recommendations
   - View 10+ recommendations
   - Accept 2-3 relevant recommendations
   - Dismiss 1-2 irrelevant recommendations
   - **Pass Criteria**: Can complete workflow in <5 minutes

2. **Scenario: Location manager filters recommendations**
   - Navigate to /recommendations
   - Filter by category "Waste Prevention"
   - Filter by priority "High"
   - View filtered results
   - **Pass Criteria**: Filters work correctly, results update instantly

3. **Scenario: Executive views savings dashboard**
   - Navigate to /recommendations
   - View stats section (total savings, acceptance rate)
   - Click "View History"
   - Export report (future)
   - **Pass Criteria**: Stats are accurate, history is complete

---

## 10. Acceptance Criteria

### Functional Requirements

| Requirement | Acceptance Criteria |
|-------------|-------------------|
| Recommendation Generation | System generates 5-20 recommendations per week (not too few, not too many) |
| Recommendation Relevance | 80% of recommendations are not immediately dismissed (relevance rate) |
| Recommendation Clarity | Users understand recommendation without viewing detailed reasoning (test with 5 users) |
| Estimated Savings Accuracy | Savings estimates within 30% of actual realized savings (after 3 months) |
| Confidence Scoring | Confidence score correlates with acceptance rate (Pearson r > 0.5) |
| Dashboard Performance | Dashboard loads in <2 seconds with 50 recommendations |
| Accept/Dismiss Actions | Users can accept or dismiss recommendations in <3 clicks |
| Historical View | Users can view all recommendations (pending, accepted, dismissed, expired) with filters |
| Statistics Tracking | Dashboard shows acceptance rate, total savings, realized savings |

### Technical Requirements

| Requirement | Acceptance Criteria |
|-------------|-------------------|
| Rule Engine Architecture | Rules are modular, can be added without modifying core engine |
| API Response Time | 95% of API requests respond in <300ms |
| Database Performance | Recommendation queries use indexes, <100ms query time |
| Test Coverage | >80% code coverage for rule engine and services |
| Error Handling | All errors logged with context, user sees friendly error messages |
| Security | All endpoints require authentication and authorization |
| Scalability | System handles 1000+ recommendations without performance degradation |

### Business Requirements

| Requirement | Acceptance Criteria |
|-------------|-------------------|
| Cost Savings | Identify $100-150K in annual savings opportunities per $1M procurement spend |
| User Adoption | 70% of managers review recommendations at least weekly (after 1 month) |
| Recommendation Actionability | 30% of recommendations are accepted within 30 days |
| False Positive Rate | <15% of recommendations are dismissed as "not relevant" or "incorrect data" |
| Time Savings | Reduce manual analysis time by 5+ hours per week (survey after 1 month) |

---

## 11. Future ML Integration Plan

### Where to Add ML Models

**Phase 1 Foundation**: Rule-based system (current implementation)
- Pros: Transparent, debuggable, no training data required
- Cons: Limited to explicit patterns, no learning from user feedback

**Phase 2 Integration**: Hybrid rule-based + ML system
- ML Model 1: **Recommendation Ranking Model**
  - Purpose: Re-rank rule-generated recommendations by predicted acceptance probability
  - Input: Recommendation features (type, confidence, savings, user history)
  - Output: Acceptance probability (0-1)
  - Integration Point: `RecommendationService.getPendingRecommendations()` - sort by ML score

- ML Model 2: **Anomaly Detection Model**
  - Purpose: Detect unusual patterns not covered by explicit rules
  - Input: Time-series data (prices, quantities, order frequencies)
  - Output: Anomaly score + interpretation
  - Integration Point: New rule `ML_ANOMALY_DETECTION` calls model API

- ML Model 3: **Demand Forecasting Model**
  - Purpose: Predict future demand for seasonal intelligence
  - Input: Historical order data, calendar features (holidays, events)
  - Output: Forecasted demand with confidence intervals
  - Integration Point: Enhance `SEASONAL_001` rule with ML predictions

**Phase 3 Advanced**: Full ML-driven recommendations
- Deep learning models for pattern recognition
- Reinforcement learning for recommendation optimization
- Natural language generation for reasoning (GPT-based)

### Data Collection for Training

**User Interaction Data**:
```sql
-- Track recommendation outcomes
CREATE TABLE RecommendationFeedback (
  id SERIAL PRIMARY KEY,
  recommendationId INT REFERENCES Recommendation(id),
  userId INT,
  action VARCHAR(20), -- 'accepted', 'dismissed', 'ignored'
  feedbackRating INT, -- 1-5 stars (optional user rating)
  dismissReason TEXT,
  timeToAction INT, -- Seconds from viewed to actioned
  createdAt TIMESTAMP
);
```

**Feature Engineering**:
- User features: role, department, location, historical acceptance rate
- Recommendation features: type, confidence, savings, priority, category
- Context features: day of week, time of day, competing recommendations
- Historical features: similar recommendations previously accepted/dismissed

**Training Dataset**:
- Minimum: 500 recommendations with outcomes (3 months of usage)
- Ideal: 2000+ recommendations with outcomes (6-12 months)
- Balanced dataset: 30-40% accepted, 40-50% dismissed, 10-20% ignored

### A/B Testing Against Rule-Based

**Experiment Setup**:
```typescript
interface ABTestConfig {
  name: string;
  groups: {
    control: string; // "rule_based"
    treatment: string; // "ml_ranking"
  };
  trafficAllocation: {
    control: number; // 50% traffic
    treatment: number; // 50% traffic
  };
  metrics: string[]; // ["acceptance_rate", "time_to_action", "user_satisfaction"]
  duration: number; // 30 days
}
```

**Implementation**:
```typescript
// In RecommendationService
async getPendingRecommendations(userId: number, filters?: any) {
  const userGroup = this.abTestService.assignUserToGroup(userId, 'ml_ranking_experiment');

  let recommendations = await this.fetchRecommendations(filters);

  if (userGroup === 'treatment') {
    // ML ranking
    recommendations = await this.mlRankingService.rankRecommendations(recommendations, userId);
  } else {
    // Rule-based ranking (priority + confidence)
    recommendations = this.ruleBasedRanking(recommendations);
  }

  // Log for analysis
  await this.abTestService.logExposure(userId, userGroup, recommendations);

  return recommendations;
}
```

**Success Metrics for ML Model**:
- **Primary**: Acceptance rate increase >5% (statistically significant p < 0.05)
- **Secondary**: Time to action decrease >10%
- **Guardrail**: Dismissal rate does not increase >3%

---

## 12. Implementation Checklist

### Database & Schema
- [ ] Verify `Recommendation` model exists in Prisma schema
- [ ] Verify `RecommendationType` enum exists
- [ ] Verify `RecommendationStatus` enum exists
- [ ] Run `npx prisma db push` to apply schema
- [ ] Run `npx prisma generate` to update Prisma client

### Backend Services
- [ ] Create `server/src/services/recommendations/` directory
- [ ] Implement `ruleEngine.ts` (RuleEngine class)
- [ ] Create `server/src/services/recommendations/rules/` directory
- [ ] Implement 10 basic rule classes:
  - [ ] COST_001: Price Spike Alert
  - [ ] COST_002: Vendor Consolidation
  - [ ] COST_003: Bulk Purchase
  - [ ] PATTERN_001: Order Frequency
  - [ ] PATTERN_004: Reorder Point
  - [ ] WASTE_001: Spoilage Risk
  - [ ] RISK_001: Single-Source Dependency
  - [ ] RISK_003: Price Volatility
  - [ ] SEASONAL_001: Demand Forecasting
  - [ ] BENCHMARK_001: Cross-Location Variance
- [ ] Implement `recommendationService.ts`
- [ ] Add unit tests for RuleEngine (>90% coverage)
- [ ] Add unit tests for 3-5 rules (>80% coverage)
- [ ] Add integration tests for RecommendationService

### API Endpoints
- [ ] Create `server/src/routes/analyticsRecommendations.ts`
- [ ] Implement GET /api/analytics/recommendations
- [ ] Implement GET /api/analytics/recommendations/:id
- [ ] Implement POST /api/analytics/recommendations/:id/dismiss
- [ ] Implement POST /api/analytics/recommendations/:id/accept
- [ ] Implement GET /api/analytics/recommendations/history
- [ ] Implement GET /api/analytics/recommendations/stats
- [ ] Add permission checks (ANALYTICS_READ, ANALYTICS_WRITE)
- [ ] Update `server/src/index.ts` to register routes
- [ ] Test all endpoints with Postman/API client

### Frontend Components
- [ ] Create `client/src/pages/RecommendationsDashboard.tsx`
- [ ] Create `client/src/components/recommendations/` directory
- [ ] Implement RecommendationCard.tsx
- [ ] Implement RecommendationDetailModal.tsx
- [ ] Implement RecommendationFilters.tsx
- [ ] Implement RecommendationStats.tsx
- [ ] Implement RecommendationHistory.tsx
- [ ] Create `client/src/services/recommendationService.ts`
- [ ] Add route to React Router for `/recommendations`
- [ ] Add navigation link to main menu

### Testing & Validation
- [ ] Write unit tests for RuleEngine
- [ ] Write unit tests for 3-5 rule classes
- [ ] Write integration tests for API endpoints
- [ ] Perform manual testing of UI components
- [ ] Test recommendation generation with sample data
- [ ] Test accept/dismiss actions
- [ ] Test filters and pagination
- [ ] Verify responsive design (mobile/tablet/desktop)
- [ ] Test error handling (network errors, invalid data)

### Deployment & Documentation
- [ ] Update API documentation (if using OpenAPI/Swagger)
- [ ] Create user guide for Recommendations Dashboard
- [ ] Create admin guide for rule configuration
- [ ] Deploy to staging environment
- [ ] Collect initial user feedback (5-10 users)
- [ ] Tune rule thresholds based on feedback
- [ ] Deploy to production
- [ ] Monitor recommendation generation (daily job if implemented)
- [ ] Track metrics (acceptance rate, savings, engagement)

### Optional Enhancements (Phase 2+)
- [ ] Implement background job queue (Bull + Redis)
- [ ] Create `generate-recommendations` daily job
- [ ] Add rule configuration UI (admin page)
- [ ] Implement A/B testing framework
- [ ] Integrate ML ranking model (if Phase 2)
- [ ] Add email notifications for high-priority recommendations
- [ ] Implement recommendation feedback ratings (1-5 stars)
- [ ] Create analytics dashboard for rule performance metrics

---

## Appendix A: Example Rule Outputs

### Example 1: Price Spike Alert
```json
{
  "id": 123,
  "type": "COST_OPTIMIZATION",
  "category": "Cost Optimization",
  "title": "Price Spike Detected: Chicken Breast",
  "description": "Chicken Breast from Fresh Farms increased 22% (from $3.50 to $4.27). This is significantly above the 30-day average.",
  "reasoning": "Sudden price increases may indicate supply chain disruptions or vendor opportunism. Consider negotiating with vendor, seeking alternative suppliers, or adjusting order quantities.",
  "estimatedSavings": 2400,
  "confidenceScore": 0.9,
  "priority": 2,
  "context": {
    "itemId": 45,
    "vendorId": 12,
    "oldPrice": 3.50,
    "newPrice": 4.27,
    "percentChange": 22,
    "ruleId": "COST_001"
  },
  "status": "PENDING",
  "createdAt": "2025-12-10T08:00:00Z"
}
```

### Example 2: Vendor Consolidation
```json
{
  "id": 124,
  "type": "CONSOLIDATION",
  "category": "Cost Optimization",
  "title": "Vendor Consolidation: Combine Tomatoes orders",
  "description": "You purchase Tomatoes from both Fresh Farms ($2.10) and Local Produce Co ($2.25). Consolidating orders with Fresh Farms could simplify procurement and unlock volume discounts.",
  "reasoning": "Consolidating vendors reduces administrative overhead, improves negotiating leverage, and often qualifies for volume-based pricing tiers.",
  "estimatedSavings": 3600,
  "confidenceScore": 0.85,
  "priority": 3,
  "context": {
    "itemId": 56,
    "vendor1Id": 12,
    "vendor2Id": 18,
    "price1": 2.10,
    "price2": 2.25,
    "combinedAnnualSpending": 72000,
    "ruleId": "COST_002"
  },
  "status": "PENDING",
  "createdAt": "2025-12-10T08:00:00Z"
}
```

### Example 3: Single-Source Dependency
```json
{
  "id": 125,
  "type": "RISK_ALERT",
  "category": "Risk Alert",
  "title": "Supply Chain Risk: Single Vendor for Olive Oil",
  "description": "You source Olive Oil exclusively from Mediterranean Imports, representing $12,000 in annual spending. This creates supply chain vulnerability.",
  "reasoning": "Single-source dependencies risk business disruption if vendor faces issues (bankruptcy, natural disaster, price hikes). Establish backup vendors for critical items.",
  "estimatedSavings": null,
  "confidenceScore": 0.9,
  "priority": 2,
  "context": {
    "itemId": 78,
    "vendorId": 23,
    "annualSpending": 12000,
    "ordersPerYear": 24,
    "ruleId": "RISK_001"
  },
  "status": "PENDING",
  "createdAt": "2025-12-10T08:00:00Z"
}
```

---

**Document End**

**Ready for Implementation**: This document provides complete specification for implementing Feature 3: AI Smart Consultant. All sections are actionable with code examples, acceptance criteria, and verification steps.

**Questions for Product Owner**:
1. Has the Analytics Foundation (Phase 0) been completed? If not, we'll launch with basic rules using existing Invoice/Item/Vendor data.
2. What is the priority for background job implementation (daily auto-generation)? We can launch with manual generation initially.
3. Do you want email notifications for high-priority recommendations, or is in-app only sufficient for MVP?
4. What is the target go-live date? This will determine which phases are included in v1.0.

**Next Steps**:
1. Review and approve this implementation plan
2. Confirm foundation infrastructure status (SpendingMetric, PurchasePattern, PriceSnapshot tables)
3. Assign developer(s) to implementation
4. Begin Phase 1: Rule Engine + Basic Rules (estimated 4 days)
