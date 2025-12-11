/**
 * useRecommendations Hook
 *
 * Custom hook for fetching and managing recommendations.
 * Includes actions for viewing, dismissing, and applying recommendations.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { recommendationService } from '@/services/recommendationService';
import type {
  Recommendation,
  RecommendationFilters,
  RecommendationStatus,
  RecommendationType,
} from '@/types/analytics';

export interface UseRecommendationsOptions {
  /** Auto-fetch on mount */
  autoFetch?: boolean;
  /** Initial filters */
  initialFilters?: RecommendationFilters;
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

export interface UseRecommendationsReturn {
  /** Recommendations data */
  recommendations: Recommendation[];
  /** Pagination info */
  pagination: PaginationInfo | null;
  /** Total count */
  total: number;
  /** Loading state */
  isLoading: boolean;
  /** Action loading state (for view/dismiss/apply) */
  isActioning: boolean;
  /** Error state */
  error: string | null;
  /** Current filters */
  filters: RecommendationFilters;
  /** Current page */
  page: number;
  /** Fetch/refetch data */
  fetchRecommendations: (newFilters?: RecommendationFilters) => Promise<void>;
  /** Mark a recommendation as viewed */
  markAsViewed: (id: number) => Promise<void>;
  /** Dismiss a recommendation */
  dismiss: (id: number, reason?: string) => Promise<void>;
  /** Apply a recommendation */
  apply: (id: number, notes?: string) => Promise<void>;
  /** Update filters */
  setFilters: (filters: RecommendationFilters) => void;
  /** Set page */
  setPage: (page: number) => void;
  /** Reset filters to initial state */
  resetFilters: () => void;
  /** Refresh data with current filters */
  refresh: () => Promise<void>;
  /** Get pending recommendations */
  pendingRecommendations: Recommendation[];
  /** Get high priority recommendations (priority 1 or 2) */
  highPriorityRecommendations: Recommendation[];
}

/**
 * Hook for fetching and managing recommendations
 */
export function useRecommendations(
  options: UseRecommendationsOptions = {}
): UseRecommendationsReturn {
  const {
    autoFetch = true,
    initialFilters = {},
    pageSize = 20,
  } = options;

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isActioning, setIsActioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<RecommendationFilters>(initialFilters);
  const [page, setPageState] = useState(1);

  // Use ref to track if initial fetch has been done
  const initialFetchDone = useRef(false);

  const fetchRecommendations = useCallback(
    async (newFilters?: RecommendationFilters) => {
      setIsLoading(true);
      setError(null);

      try {
        const appliedFilters = newFilters ?? filters;
        const response = await recommendationService.getRecommendations({
          ...appliedFilters,
          page,
          limit: pageSize,
        });

        setRecommendations(response.data);
        setPagination(response.pagination);

        if (newFilters) {
          setFiltersState(newFilters);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch recommendations';
        setError(errorMessage);
        console.error('Error fetching recommendations:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [filters, page, pageSize]
  );

  const updateRecommendationInList = useCallback(
    (updatedRec: Recommendation) => {
      setRecommendations((prev) =>
        prev.map((rec) => (rec.id === updatedRec.id ? updatedRec : rec))
      );
    },
    []
  );

  const markAsViewed = useCallback(
    async (id: number) => {
      setIsActioning(true);
      setError(null);

      try {
        const updated = await recommendationService.markAsViewed(id);
        updateRecommendationInList(updated);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to mark recommendation as viewed';
        setError(errorMessage);
        console.error('Error marking as viewed:', err);
        throw err;
      } finally {
        setIsActioning(false);
      }
    },
    [updateRecommendationInList]
  );

  const dismiss = useCallback(
    async (id: number, reason?: string) => {
      setIsActioning(true);
      setError(null);

      try {
        const updated = await recommendationService.dismissRecommendation(id, {
          reason,
        });
        updateRecommendationInList(updated);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to dismiss recommendation';
        setError(errorMessage);
        console.error('Error dismissing recommendation:', err);
        throw err;
      } finally {
        setIsActioning(false);
      }
    },
    [updateRecommendationInList]
  );

  const apply = useCallback(
    async (id: number, notes?: string) => {
      setIsActioning(true);
      setError(null);

      try {
        const updated = await recommendationService.applyRecommendation(id, {
          notes,
        });
        updateRecommendationInList(updated);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to apply recommendation';
        setError(errorMessage);
        console.error('Error applying recommendation:', err);
        throw err;
      } finally {
        setIsActioning(false);
      }
    },
    [updateRecommendationInList]
  );

  const setFilters = useCallback((newFilters: RecommendationFilters) => {
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
    return fetchRecommendations();
  }, [fetchRecommendations]);

  // Computed properties
  const pendingRecommendations = recommendations.filter(
    (rec) => rec.status === 'PENDING'
  );

  // High priority: priority 1 (critical) or 2 (high)
  const highPriorityRecommendations = recommendations.filter(
    (rec) =>
      (rec.priority === 1 || rec.priority === 2) &&
      rec.status === 'PENDING'
  );

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch && !initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchRecommendations();
    }
  }, [autoFetch, fetchRecommendations]);

  // Refetch when page changes (after initial mount)
  useEffect(() => {
    if (initialFetchDone.current && page > 0) {
      fetchRecommendations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return {
    recommendations,
    pagination,
    total: pagination?.total ?? 0,
    isLoading,
    isActioning,
    error,
    filters,
    page,
    fetchRecommendations,
    markAsViewed,
    dismiss,
    apply,
    setFilters,
    setPage,
    resetFilters,
    refresh,
    pendingRecommendations,
    highPriorityRecommendations,
  };
}

/**
 * Hook for fetching pending recommendations only
 */
export function usePendingRecommendations() {
  return useRecommendations({
    autoFetch: true,
    initialFilters: { status: 'PENDING' as RecommendationStatus },
  });
}

/**
 * Hook for fetching recommendations by type
 */
export function useRecommendationsByType(type: RecommendationType) {
  return useRecommendations({
    autoFetch: true,
    initialFilters: { type },
  });
}

/**
 * Hook for fetching high priority recommendations
 * NOTE: Priority 1 = Critical, Priority 2 = High
 */
export function useHighPriorityRecommendations() {
  return useRecommendations({
    autoFetch: true,
    initialFilters: {
      status: 'PENDING' as RecommendationStatus,
      priority: 2, // High priority (1=critical, 2=high)
    },
  });
}
