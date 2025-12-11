/**
 * Analytics Foundation Types
 *
 * Type definitions for the Analytics & Intelligence Foundation frontend.
 * These types match the backend API contracts for analytics endpoints.
 */

// ============================================================================
// Enums and Constants
// ============================================================================

/**
 * Status values for recommendations
 */
export type RecommendationStatus = 'PENDING' | 'VIEWED' | 'APPLIED' | 'DISMISSED' | 'EXPIRED';

/**
 * Types of recommendations the system can generate
 * NOTE: Must match backend Prisma enum RecommendationType in schema.prisma
 */
export type RecommendationType =
  | 'COST_OPTIMIZATION'
  | 'VENDOR_SWITCH'
  | 'CONSOLIDATION'
  | 'WASTE_PREVENTION'
  | 'RISK_ALERT'
  | 'SEASONAL_OPPORTUNITY'
  | 'INVENTORY_REORDER'
  | 'PRICE_NEGOTIATION';

/**
 * Priority levels for recommendations
 * NOTE: Backend uses numeric priority (1=critical to 5=low)
 * Keeping string type for display purposes, with helper functions to convert
 */
export type RecommendationPriority = 1 | 2 | 3 | 4 | 5;

/**
 * Helper to get priority label from numeric value
 */
export const getPriorityLabel = (priority: number): string => {
  switch (priority) {
    case 1:
      return 'Critical';
    case 2:
      return 'High';
    case 3:
      return 'Medium';
    case 4:
      return 'Low';
    case 5:
      return 'Very Low';
    default:
      return 'Unknown';
  }
};

/**
 * Time periods for aggregating spending metrics
 */
export type MetricPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

/**
 * Trend direction for pattern analysis
 */
export type TrendDirection = 'INCREASING' | 'DECREASING' | 'STABLE';

// ============================================================================
// Spending Metrics Types
// ============================================================================

/**
 * Aggregated spending metric for analytics
 * NOTE: Matches backend SpendingMetric Prisma model
 */
export interface SpendingMetric {
  id: number;
  dimensionHash: string;
  // Dimensions
  date: string;
  itemId: number | null;
  vendorId: number | null;
  branchId: number | null;
  departmentId: number | null;
  costCenterId: number | null;
  // Metrics
  totalAmount: number;
  invoiceCount: number;
  quantity: number | null;
  avgUnitPrice: number | null;
  // Metadata
  computedAt: string;
  // Relationships (populated when included)
  item?: {
    id: number;
    name: string;
  } | null;
  vendor?: {
    id: number;
    name: string;
  } | null;
  branch?: {
    id: number;
    name: string;
  } | null;
  department?: {
    id: number;
    name: string;
  } | null;
  costCenter?: {
    id: number;
    name: string;
  } | null;
}

/**
 * Summary of spending across a time period
 */
export interface SpendingSummary {
  totalSpending: number;
  totalTransactions: number;
  averageTransactionValue: number;
  topVendors: Array<{
    vendorId: number;
    vendorName: string;
    totalAmount: number;
    percentage: number;
  }>;
  topItems: Array<{
    itemId: number;
    itemName: string;
    totalAmount: number;
    percentage: number;
  }>;
  byBranch: Array<{
    branchId: number;
    branchName: string;
    totalAmount: number;
    percentage: number;
  }>;
}

/**
 * Filter parameters for spending metrics queries
 * NOTE: Matches backend SpendingMetricQuerySchema
 */
export interface SpendingMetricsFilters {
  startDate?: string;
  endDate?: string;
  itemId?: number;
  vendorId?: number;
  branchId?: number;
  departmentId?: number;
  costCenterId?: number;
}

// ============================================================================
// Price Variance Types
// ============================================================================

/**
 * Price snapshot for tracking prices across locations
 */
export interface PriceSnapshot {
  id: number;
  itemId: number;
  vendorId: number;
  branchId: number;
  price: number;
  snapshotDate: string;
  createdAt: string;
  item?: {
    id: number;
    name: string;
    item_code: string | null;
  };
  vendor?: {
    id: number;
    name: string;
  };
  branch?: {
    id: number;
    name: string;
  };
}

/**
 * Price variance data comparing prices across branches
 */
export interface PriceVariance {
  itemId: number;
  itemName: string;
  vendorId: number;
  vendorName: string;
  networkAverage: number;
  minPrice: number;
  maxPrice: number;
  priceRange: number;
  variancePercentage: number;
  branchPrices: Array<{
    branchId: number;
    branchName: string;
    price: number;
    deviationFromAverage: number;
    deviationPercentage: number;
  }>;
}

/**
 * Filter parameters for price variance queries
 */
export interface PriceVarianceFilters {
  itemId?: number;
  vendorId?: number;
  branchId?: number;
  minVariance?: number;
  snapshotDate?: string;
}

// ============================================================================
// Purchase Pattern Types
// ============================================================================

/**
 * Detected purchase pattern for an item
 */
export interface PurchasePattern {
  id: number;
  itemId: number;
  branchId: number | null;
  averageCycleDays: number;
  cycleDaysStdDev: number;
  averageQuantity: number;
  quantityStdDev: number;
  lastOrderDate: string | null;
  predictedNextOrder: string | null;
  trend: TrendDirection;
  seasonalityDetected: boolean;
  confidence: number;
  dataPoints: number;
  createdAt: string;
  updatedAt: string;
  item?: {
    id: number;
    name: string;
    item_code: string | null;
  };
  branch?: {
    id: number;
    name: string;
  };
}

/**
 * Filter parameters for purchase pattern queries
 */
export interface PurchasePatternFilters {
  itemId?: number;
  branchId?: number;
  trend?: TrendDirection;
  minConfidence?: number;
}

// ============================================================================
// Benchmark Types
// ============================================================================

/**
 * Benchmark statistics for an item across the network
 */
export interface BenchmarkStats {
  itemId: number;
  itemName: string;
  networkAveragePrice: number;
  networkMinPrice: number;
  networkMaxPrice: number;
  standardDeviation: number;
  branchCount: number;
  vendorCount: number;
  totalVolume: number;
  lastUpdated: string;
}

// ============================================================================
// Consolidation Opportunity Types
// ============================================================================

/**
 * Identified opportunity for vendor/volume consolidation
 */
export interface ConsolidationOpportunity {
  id: string;
  itemId: number;
  itemName: string;
  currentVendorCount: number;
  recommendedVendorId: number;
  recommendedVendorName: string;
  currentTotalSpend: number;
  projectedSavings: number;
  savingsPercentage: number;
  affectedBranches: Array<{
    branchId: number;
    branchName: string;
    currentVendorId: number;
    currentVendorName: string;
    currentPrice: number;
    recommendedPrice: number;
    savings: number;
  }>;
  confidence: number;
}

// ============================================================================
// Recommendation Types
// ============================================================================

/**
 * Generated recommendation from analytics
 * NOTE: Matches backend Recommendation Prisma model
 */
export interface Recommendation {
  id: number;
  type: RecommendationType;
  category: string;
  title: string;
  description: string;
  reasoning: string;
  // Impact estimates
  estimatedSavings: number | null;
  confidenceScore: number;
  priority: number; // 1=critical, 5=low (backend uses number, not enum)
  // Context data (JSON string from backend)
  context: string;
  // State
  status: RecommendationStatus;
  createdBy: string;
  // User interaction
  viewedAt: string | null;
  viewedBy: number | null;
  dismissedAt: string | null;
  dismissedBy: number | null;
  dismissReason: string | null;
  appliedAt: string | null;
  appliedBy: number | null;
  // Metadata
  createdAt: string;
  expiresAt: string | null;
}

/**
 * Filter parameters for recommendation queries
 * NOTE: Matches backend RecommendationQuerySchema
 */
export interface RecommendationFilters {
  type?: RecommendationType;
  priority?: number;
  status?: RecommendationStatus;
  minConfidence?: number;
}

/**
 * Input for dismissing a recommendation
 */
export interface DismissRecommendationInput {
  reason?: string;
}

/**
 * Input for applying a recommendation
 */
export interface ApplyRecommendationInput {
  notes?: string;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Paginated response wrapper for analytics lists
 */
export interface AnalyticsPaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

/**
 * Response for spending metrics list endpoint
 * NOTE: Backend returns {data, pagination} only - no summary
 */
export interface SpendingMetricsResponse {
  data: SpendingMetric[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

/**
 * Response for price variance endpoint
 */
export interface PriceVarianceResponse {
  data: PriceVariance[];
  summary: {
    totalItemsAnalyzed: number;
    itemsWithHighVariance: number;
    averageVariance: number;
    potentialSavings: number;
  };
}

/**
 * Response for recommendations list endpoint
 * NOTE: Backend returns {data, pagination} only - no summary
 */
export interface RecommendationsResponse {
  data: Recommendation[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}
