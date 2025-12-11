/**
 * Hooks Index
 *
 * Barrel export for all custom hooks.
 */

// Analytics Foundation Hooks
export {
  useSpendingMetrics,
  useSpendingByPeriod,
  type UseSpendingMetricsOptions,
  type UseSpendingMetricsReturn,
} from './useSpendingMetrics';

export {
  usePriceVariance,
  usePriceVarianceForItem,
  useHighVarianceItems,
  type UsePriceVarianceOptions,
  type UsePriceVarianceReturn,
  type PriceVarianceSummary,
} from './usePriceVariance';

export {
  useRecommendations,
  usePendingRecommendations,
  useRecommendationsByType,
  useHighPriorityRecommendations,
  type UseRecommendationsOptions,
  type UseRecommendationsReturn,
  type RecommendationsSummary,
} from './useRecommendations';
