/**
 * Analytics Foundation Service
 *
 * API client for the Analytics & Intelligence Foundation endpoints.
 * Handles spending metrics, price variance, purchase patterns, and benchmarks.
 */

import api from '@/lib/api';
import type {
  SpendingMetric,
  SpendingMetricsFilters,
  SpendingMetricsResponse,
  PriceVariance,
  PriceVarianceFilters,
  PriceVarianceResponse,
  PurchasePattern,
  PurchasePatternFilters,
  BenchmarkStats,
  ConsolidationOpportunity,
  AnalyticsPaginatedResponse,
} from '@/types/analytics';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build query string from filter parameters
 */
const buildQueryString = (params: Record<string, string | number | boolean | undefined>): string => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
};

// ============================================================================
// Spending Metrics API
// ============================================================================

/**
 * Fetch spending metrics with optional filters
 */
const getSpendingMetrics = async (
  filters?: SpendingMetricsFilters & { page?: number; limit?: number }
): Promise<SpendingMetricsResponse> => {
  const queryString = buildQueryString({
    startDate: filters?.startDate,
    endDate: filters?.endDate,
    itemId: filters?.itemId,
    vendorId: filters?.vendorId,
    branchId: filters?.branchId,
    departmentId: filters?.departmentId,
    costCenterId: filters?.costCenterId,
    page: filters?.page ?? 1,
    limit: filters?.limit ?? 20,
  });

  const response = await api.get<SpendingMetricsResponse>(
    `/analytics/foundation/spending-metrics${queryString}`
  );
  return response.data;
};

/**
 * Fetch a single spending metric by ID
 * TODO: Backend endpoint not yet implemented - GET /analytics/foundation/spending-metrics/:id
 * @throws Error - Always throws until backend is implemented
 */
const getSpendingMetricById = async (_id: number): Promise<SpendingMetric> => {
  throw new Error('getSpendingMetricById: Backend endpoint not yet implemented');
};

// ============================================================================
// Price Variance API
// ============================================================================

/**
 * Fetch price variance data across branches
 */
const getPriceVariance = async (
  filters?: PriceVarianceFilters & { page?: number; limit?: number }
): Promise<PriceVarianceResponse> => {
  const queryString = buildQueryString({
    itemId: filters?.itemId,
    vendorId: filters?.vendorId,
    branchId: filters?.branchId,
    minVariance: filters?.minVariance,
    snapshotDate: filters?.snapshotDate,
    page: filters?.page,
    limit: filters?.limit,
  });

  const response = await api.get<PriceVarianceResponse>(
    `/analytics/foundation/price-variance${queryString}`
  );
  return response.data;
};

// ============================================================================
// Purchase Patterns API
// ============================================================================

/**
 * Fetch purchase patterns with optional filters
 */
const getPurchasePatterns = async (
  filters?: PurchasePatternFilters & { page?: number; limit?: number }
): Promise<AnalyticsPaginatedResponse<PurchasePattern>> => {
  const queryString = buildQueryString({
    itemId: filters?.itemId,
    branchId: filters?.branchId,
    trend: filters?.trend,
    minConfidence: filters?.minConfidence,
    page: filters?.page,
    limit: filters?.limit,
  });

  const response = await api.get<AnalyticsPaginatedResponse<PurchasePattern>>(
    `/analytics/foundation/purchase-patterns${queryString}`
  );
  return response.data;
};

/**
 * Fetch a single purchase pattern by ID
 */
const getPurchasePatternById = async (id: number): Promise<PurchasePattern> => {
  const response = await api.get<PurchasePattern>(
    `/analytics/foundation/purchase-patterns/${id}`
  );
  return response.data;
};

// ============================================================================
// Benchmarks API
// ============================================================================

/**
 * Fetch benchmark statistics for a specific item
 */
const getBenchmarks = async (itemId: number): Promise<BenchmarkStats> => {
  const response = await api.get<BenchmarkStats>(
    `/analytics/foundation/benchmarks/${itemId}`
  );
  return response.data;
};

/**
 * Fetch benchmark statistics for multiple items
 */
const getBenchmarksList = async (
  itemIds?: number[]
): Promise<BenchmarkStats[]> => {
  const queryString = itemIds?.length
    ? `?itemIds=${itemIds.join(',')}`
    : '';

  const response = await api.get<BenchmarkStats[]>(
    `/analytics/foundation/benchmarks${queryString}`
  );
  return response.data;
};

// ============================================================================
// Consolidation Opportunities API
// ============================================================================

/**
 * Fetch consolidation opportunities
 */
const getConsolidationOpportunities = async (
  filters?: { minSavings?: number; page?: number; limit?: number }
): Promise<AnalyticsPaginatedResponse<ConsolidationOpportunity>> => {
  const queryString = buildQueryString({
    minSavings: filters?.minSavings,
    page: filters?.page,
    limit: filters?.limit,
  });

  const response = await api.get<AnalyticsPaginatedResponse<ConsolidationOpportunity>>(
    `/analytics/foundation/consolidation-opportunities${queryString}`
  );
  return response.data;
};

// ============================================================================
// Export Service Object
// ============================================================================

export const analyticsFoundationService = {
  // Spending Metrics
  getSpendingMetrics,
  getSpendingMetricById,

  // Price Variance
  getPriceVariance,

  // Purchase Patterns
  getPurchasePatterns,
  getPurchasePatternById,

  // Benchmarks
  getBenchmarks,
  getBenchmarksList,

  // Consolidation
  getConsolidationOpportunities,
};
