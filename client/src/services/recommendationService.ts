/**
 * Recommendation Service
 *
 * API client for the Recommendations endpoints.
 * Handles fetching, viewing, dismissing, and applying recommendations.
 */

import api from '@/lib/api';
import type {
  Recommendation,
  RecommendationFilters,
  RecommendationsResponse,
  DismissRecommendationInput,
  ApplyRecommendationInput,
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
// Recommendations API
// ============================================================================

/**
 * Fetch recommendations with optional filters
 */
const getRecommendations = async (
  filters?: RecommendationFilters & { page?: number; limit?: number }
): Promise<RecommendationsResponse> => {
  const queryString = buildQueryString({
    type: filters?.type,
    priority: filters?.priority,
    status: filters?.status,
    targetEntityType: filters?.targetEntityType,
    targetEntityId: filters?.targetEntityId,
    minSavings: filters?.minSavings,
    minConfidence: filters?.minConfidence,
    page: filters?.page,
    limit: filters?.limit,
  });

  const response = await api.get<RecommendationsResponse>(
    `/recommendations${queryString}`
  );
  return response.data;
};

/**
 * Fetch a single recommendation by ID
 */
const getRecommendationById = async (id: number): Promise<Recommendation> => {
  const response = await api.get<Recommendation>(`/recommendations/${id}`);
  return response.data;
};

/**
 * Mark a recommendation as viewed
 * Uses PATCH as per REST conventions for partial state changes
 */
const markAsViewed = async (id: number): Promise<Recommendation> => {
  const response = await api.patch<Recommendation>(
    `/recommendations/${id}/view`
  );
  return response.data;
};

/**
 * Dismiss a recommendation with optional reason
 * Uses PATCH as per REST conventions for partial state changes
 */
const dismissRecommendation = async (
  id: number,
  input?: DismissRecommendationInput
): Promise<Recommendation> => {
  const response = await api.patch<Recommendation>(
    `/recommendations/${id}/dismiss`,
    input
  );
  return response.data;
};

/**
 * Apply a recommendation with optional notes
 * Uses PATCH as per REST conventions for partial state changes
 */
const applyRecommendation = async (
  id: number,
  input?: ApplyRecommendationInput
): Promise<Recommendation> => {
  const response = await api.patch<Recommendation>(
    `/recommendations/${id}/apply`,
    input
  );
  return response.data;
};

/**
 * Get pending recommendations count (for badges/notifications)
 * TODO: Backend endpoint not yet implemented - GET /recommendations/pending-count
 * @throws Error - Always throws until backend is implemented
 */
const getPendingCount = async (): Promise<{ count: number }> => {
  throw new Error('getPendingCount: Backend endpoint not yet implemented');
};

// ============================================================================
// Export Service Object
// ============================================================================

export const recommendationService = {
  // Read operations
  getRecommendations,
  getRecommendationById,
  getPendingCount,

  // State change operations (using PATCH)
  markAsViewed,
  dismissRecommendation,
  applyRecommendation,
};
