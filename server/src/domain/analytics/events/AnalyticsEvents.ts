/**
 * Analytics domain event constants
 * ARCHITECTURE: Strongly typed event names for pub/sub communication
 */
export const AnalyticsEvents = {
  /** Emitted when spending metrics have been computed for a date */
  SPENDING_METRICS_COMPUTED: 'analytics.spending-metrics-computed',
  /** Emitted when price benchmarks have been computed */
  PRICE_BENCHMARKS_COMPUTED: 'analytics.price-benchmarks-computed',
  /** Emitted when a purchase pattern has been detected or updated */
  PATTERN_DETECTED: 'analytics.pattern-detected',
  /** Emitted when an anomaly has been detected in ordering behavior */
  ANOMALY_DETECTED: 'analytics.anomaly-detected',
  /** Emitted when new recommendations have been generated */
  RECOMMENDATIONS_GENERATED: 'analytics.recommendations-generated',
  /** Emitted when a user views a recommendation */
  RECOMMENDATION_VIEWED: 'analytics.recommendation-viewed',
  /** Emitted when a user dismisses a recommendation */
  RECOMMENDATION_DISMISSED: 'analytics.recommendation-dismissed',
  /** Emitted when a user applies a recommendation */
  RECOMMENDATION_APPLIED: 'analytics.recommendation-applied',
} as const;

/**
 * Type representing all possible analytics event names
 */
export type AnalyticsEventType = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];

/**
 * Base payload for analytics events
 */
export interface AnalyticsEventPayload {
  /** Timestamp when the event occurred */
  timestamp: Date;
  /** Source of the event (e.g., job name, service name) */
  source: string;
}

/**
 * Payload for spending metrics computed event
 */
export interface SpendingMetricsComputedPayload extends AnalyticsEventPayload {
  /** Date for which metrics were computed */
  date: Date;
  /** Number of metrics computed */
  metricsCount: number;
  /** Duration of computation in ms */
  durationMs: number;
}

/**
 * Payload for price benchmarks computed event
 */
export interface PriceBenchmarksComputedPayload extends AnalyticsEventPayload {
  /** Date for which benchmarks were computed */
  date: Date;
  /** Number of price snapshots created/updated */
  snapshotCount: number;
  /** Duration of computation in ms */
  durationMs: number;
}

/**
 * Payload for pattern detected event
 */
export interface PatternDetectedPayload extends AnalyticsEventPayload {
  /** Item ID for which pattern was detected */
  itemId: number;
  /** Branch ID (null for company-wide) */
  branchId: number | null;
  /** Confidence score of the pattern */
  confidenceScore: number;
  /** Whether this is a new pattern or an update */
  isNewPattern: boolean;
}

/**
 * Payload for anomaly detected event
 */
export interface AnomalyDetectedPayload extends AnalyticsEventPayload {
  /** Invoice ID where anomaly was detected */
  invoiceId: number;
  /** Item ID involved in anomaly */
  itemId: number;
  /** Type of anomaly */
  anomalyType: 'QUANTITY_ANOMALY' | 'AMOUNT_ANOMALY' | 'BOTH';
  /** Deviation from expected value (in standard deviations) */
  deviation: number;
}

/**
 * Payload for recommendations generated event
 */
export interface RecommendationsGeneratedPayload extends AnalyticsEventPayload {
  /** Number of recommendations generated */
  count: number;
  /** Breakdown by type */
  byType: Record<string, number>;
}

/**
 * Payload for recommendation state change events (viewed, dismissed, applied)
 */
export interface RecommendationStateChangePayload extends AnalyticsEventPayload {
  /** Recommendation ID */
  recommendationId: number;
  /** User ID who performed the action */
  userId: number;
  /** New status */
  newStatus: 'VIEWED' | 'DISMISSED' | 'APPLIED';
  /** Reason for dismissal (if dismissed) */
  dismissReason?: string;
}
