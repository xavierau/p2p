/**
 * usePriceVariance Hook
 *
 * Custom hook for fetching and managing price variance data across branches.
 * Uses React state management with async data fetching.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { analyticsFoundationService } from '@/services/analyticsFoundationService';
import type {
  PriceVariance,
  PriceVarianceFilters,
} from '@/types/analytics';

export interface UsePriceVarianceOptions {
  /** Auto-fetch on mount */
  autoFetch?: boolean;
  /** Initial filters */
  initialFilters?: PriceVarianceFilters;
  /** Page size for pagination */
  pageSize?: number;
  /** Minimum variance threshold to display */
  minVarianceThreshold?: number;
}

export interface PriceVarianceSummary {
  totalItemsAnalyzed: number;
  itemsWithHighVariance: number;
  averageVariance: number;
  potentialSavings: number;
}

export interface UsePriceVarianceReturn {
  /** Price variance data */
  variances: PriceVariance[];
  /** Summary statistics */
  summary: PriceVarianceSummary | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Current filters */
  filters: PriceVarianceFilters;
  /** Current page */
  page: number;
  /** Fetch/refetch data */
  fetchVariances: (newFilters?: PriceVarianceFilters) => Promise<void>;
  /** Update filters */
  setFilters: (filters: PriceVarianceFilters) => void;
  /** Set page */
  setPage: (page: number) => void;
  /** Reset filters to initial state */
  resetFilters: () => void;
  /** Refresh data with current filters */
  refresh: () => Promise<void>;
  /** Get items with variance above threshold */
  highVarianceItems: PriceVariance[];
}

/**
 * Hook for fetching and managing price variance data
 */
export function usePriceVariance(
  options: UsePriceVarianceOptions = {}
): UsePriceVarianceReturn {
  const {
    autoFetch = true,
    initialFilters = {},
    pageSize = 20,
    minVarianceThreshold = 10, // 10% variance threshold
  } = options;

  const [variances, setVariances] = useState<PriceVariance[]>([]);
  const [summary, setSummary] = useState<PriceVarianceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<PriceVarianceFilters>(initialFilters);
  const [page, setPage] = useState(1);

  const fetchVariances = useCallback(
    async (newFilters?: PriceVarianceFilters) => {
      setIsLoading(true);
      setError(null);

      try {
        const appliedFilters = newFilters ?? filters;
        const response = await analyticsFoundationService.getPriceVariance({
          ...appliedFilters,
          page,
          limit: pageSize,
        });

        setVariances(response.data);
        setSummary(response.summary);

        if (newFilters) {
          setFiltersState(newFilters);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch price variance data';
        setError(errorMessage);
        console.error('Error fetching price variance:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [filters, page, pageSize]
  );

  const setFilters = useCallback((newFilters: PriceVarianceFilters) => {
    setFiltersState(newFilters);
    setPage(1); // Reset to first page when filters change
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(initialFilters);
    setPage(1);
  }, [initialFilters]);

  const refresh = useCallback(() => {
    return fetchVariances();
  }, [fetchVariances]);

  // Computed property for high variance items
  const highVarianceItems = variances.filter(
    (v) => v.variancePercentage >= minVarianceThreshold
  );

  // Use ref to track if initial fetch has been done
  const initialFetchDone = useRef(false);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch && !initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchVariances();
    }
  }, [autoFetch, fetchVariances]);

  // Refetch when page changes (after initial mount)
  useEffect(() => {
    if (initialFetchDone.current && page > 0) {
      fetchVariances();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return {
    variances,
    summary,
    isLoading,
    error,
    filters,
    page,
    fetchVariances,
    setFilters,
    setPage,
    resetFilters,
    refresh,
    highVarianceItems,
  };
}

/**
 * Hook for fetching price variance for a specific item
 */
export function usePriceVarianceForItem(itemId: number) {
  return usePriceVariance({
    autoFetch: true,
    initialFilters: { itemId },
  });
}

/**
 * Hook for fetching high variance items only
 */
export function useHighVarianceItems(minVariance: number = 10) {
  return usePriceVariance({
    autoFetch: true,
    initialFilters: { minVariance },
    minVarianceThreshold: minVariance,
  });
}
