/**
 * Analytics Domain Events Index
 * Exports all event types and payloads for the analytics bounded context
 */

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
} from './AnalyticsEvents';
