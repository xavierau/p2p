/**
 * useSpendingMetrics Hook
 *
 * Custom hook for fetching and managing spending metrics data.
 * Uses React state management with async data fetching.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { analyticsFoundationService } from '@/services/analyticsFoundationService';
import type {
  SpendingMetric,
  SpendingMetricsFilters,
} from '@/types/analytics';

export interface UseSpendingMetricsOptions {
  /** Auto-fetch on mount */
  autoFetch?: boolean;
  /** Initial filters */
  initialFilters?: SpendingMetricsFilters;
  /** Page size for pagination */
  pageSize?: number;
}

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface UseSpendingMetricsReturn {
  /** Spending metrics data */
  metrics: SpendingMetric[];
  /** Pagination info */
  pagination: PaginationInfo | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Current filters */
  filters: SpendingMetricsFilters;
  /** Current page */
  page: number;
  /** Total count */
  total: number;
  /** Fetch/refetch data */
  fetchMetrics: (newFilters?: SpendingMetricsFilters) => Promise<void>;
  /** Update filters */
  setFilters: (filters: SpendingMetricsFilters) => void;
  /** Set page */
  setPage: (page: number) => void;
  /** Reset filters to initial state */
  resetFilters: () => void;
  /** Refresh data with current filters */
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching and managing spending metrics
 */
export function useSpendingMetrics(
  options: UseSpendingMetricsOptions = {}
): UseSpendingMetricsReturn {
  const {
    autoFetch = true,
    initialFilters = {},
    pageSize = 20,
  } = options;

  const [metrics, setMetrics] = useState<SpendingMetric[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<SpendingMetricsFilters>(initialFilters);
  const [page, setPageState] = useState(1);

  // Use ref to track if initial fetch has been done
  const initialFetchDone = useRef(false);

  const fetchMetrics = useCallback(
    async (newFilters?: SpendingMetricsFilters) => {
      setIsLoading(true);
      setError(null);

      try {
        const appliedFilters = newFilters ?? filters;
        const response = await analyticsFoundationService.getSpendingMetrics({
          ...appliedFilters,
          page,
          limit: pageSize,
        });

        setMetrics(response.data);
        setPagination(response.pagination);

        if (newFilters) {
          setFiltersState(newFilters);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch spending metrics';
        setError(errorMessage);
        console.error('Error fetching spending metrics:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [filters, page, pageSize]
  );

  const setFilters = useCallback((newFilters: SpendingMetricsFilters) => {
    setFiltersState(newFilters);
    setPageState(1); // Reset to first page when filters change
  }, []);

  const setPage = useCallback((newPage: number) => {
    setPageState(newPage);
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(initialFilters);
    setPageState(1);
  }, [initialFilters]);

  const refresh = useCallback(() => {
    return fetchMetrics();
  }, [fetchMetrics]);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch && !initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchMetrics();
    }
  }, [autoFetch, fetchMetrics]);

  // Refetch when page changes (after initial mount)
  useEffect(() => {
    if (initialFetchDone.current && page > 0) {
      fetchMetrics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return {
    metrics,
    pagination,
    isLoading,
    error,
    filters,
    page,
    total: pagination?.total ?? 0,
    fetchMetrics,
    setFilters,
    setPage,
    resetFilters,
    refresh,
  };
}

/**
 * Hook for fetching spending metrics with date range (simplified)
 * NOTE: Period filtering is not supported by the backend.
 * Use startDate and endDate for filtering by time range.
 */
export function useSpendingByDateRange(startDate?: string, endDate?: string) {
  return useSpendingMetrics({
    autoFetch: true,
    initialFilters: { startDate, endDate },
  });
}
