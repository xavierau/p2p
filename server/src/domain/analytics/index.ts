/**
 * Analytics Domain Layer Exports
 * Bounded context for analytics infrastructure including spending metrics,
 * pattern recognition, cross-location analysis, and recommendations.
 */

// Service Interfaces
export type {
  ICacheService,
  IAggregationService,
  IPatternRecognitionService,
  Anomaly,
  AnomalyType,
  ICrossLocationService,
  PriceVarianceResult,
  BranchPrice,
  BenchmarkStats,
  BranchSpending,
  ConsolidationOpportunity,
  ConsolidationBranchDetail,
} from './services';

// Domain Events
export {
  AnalyticsEvents,
  type AnalyticsEventType,
  type AnalyticsEventPayload,
  type SpendingMetricsComputedPayload,
  type PriceBenchmarksComputedPayload,
  type PatternDetectedPayload,
  type AnomalyDetectedPayload,
  type RecommendationsGeneratedPayload,
  type RecommendationStateChangePayload,
} from './events';
