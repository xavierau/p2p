/**
 * Analytics Foundation Configuration
 * Centralizes all analytics-related settings including job schedules,
 * queue names, timeouts, and cache TTLs.
 */
export const AnalyticsConfig = {
  /**
   * Job schedules using cron expressions
   * Override with environment variables if needed
   */
  SCHEDULES: {
    /** Compute spending metrics - every hour */
    COMPUTE_SPENDING_METRICS:
      process.env.SCHEDULE_SPENDING_METRICS || '0 * * * *',
    /** Compute price benchmarks - daily at 2 AM */
    COMPUTE_PRICE_BENCHMARKS:
      process.env.SCHEDULE_PRICE_BENCHMARKS || '0 2 * * *',
    /** Analyze purchase patterns - daily at 3 AM */
    ANALYZE_PURCHASE_PATTERNS:
      process.env.SCHEDULE_PURCHASE_PATTERNS || '0 3 * * *',
    /** Generate recommendations - daily at 4 AM */
    GENERATE_RECOMMENDATIONS:
      process.env.SCHEDULE_RECOMMENDATIONS || '0 4 * * *',
    /** Detect anomalies - every 6 hours */
    DETECT_ANOMALIES: process.env.SCHEDULE_ANOMALIES || '0 */6 * * *',
    /** Cleanup expired recommendations - daily at 1 AM */
    CLEANUP_EXPIRED_RECOMMENDATIONS:
      process.env.SCHEDULE_CLEANUP || '0 1 * * *',
  },

  /**
   * ARCHITECTURE: Use separate queues for independent job types
   * This prevents sequential blocking and allows parallel processing
   */
  QUEUES: {
    /** Queue for spending metrics and price benchmarks aggregation jobs */
    AGGREGATION: 'analytics:aggregation',
    /** Queue for purchase patterns and anomaly detection jobs */
    PATTERN: 'analytics:pattern',
    /** Queue for recommendation generation and cleanup jobs */
    RECOMMENDATIONS: 'analytics:recommendations',
  },

  /**
   * Job names - ARCHITECTURE: These are used as job.name, NOT jobId
   * Bull processes jobs by name, allowing different processors per job type
   */
  JOBS: {
    COMPUTE_SPENDING_METRICS: 'compute-spending-metrics',
    COMPUTE_PRICE_BENCHMARKS: 'compute-price-benchmarks',
    ANALYZE_PURCHASE_PATTERNS: 'analyze-purchase-patterns',
    GENERATE_RECOMMENDATIONS: 'generate-recommendations',
    DETECT_ANOMALIES: 'detect-anomalies',
    CLEANUP_EXPIRED_RECOMMENDATIONS: 'cleanup-expired-recommendations',
  },

  /**
   * ARCHITECTURE: Job-specific timeouts in milliseconds
   * Heavy jobs get longer timeouts to prevent premature termination
   */
  JOB_TIMEOUTS: {
    /** Spending metrics - 2 minutes */
    COMPUTE_SPENDING_METRICS: 120000,
    /** Price benchmarks - 5 minutes (heavy job) */
    COMPUTE_PRICE_BENCHMARKS: 300000,
    /** Purchase patterns - 5 minutes (heavy job) */
    ANALYZE_PURCHASE_PATTERNS: 300000,
    /** Recommendations - 3 minutes */
    GENERATE_RECOMMENDATIONS: 180000,
    /** Anomaly detection - 2 minutes */
    DETECT_ANOMALIES: 120000,
    /** Cleanup - 1 minute */
    CLEANUP_EXPIRED_RECOMMENDATIONS: 60000,
  },

  /**
   * Cache TTLs in seconds
   * Balance between freshness and performance
   */
  CACHE_TTL: {
    /** Spending metrics - 5 minutes */
    SPENDING_METRICS: 300,
    /** Price variance - 10 minutes */
    PRICE_VARIANCE: 600,
    /** Purchase patterns - 1 hour */
    PURCHASE_PATTERNS: 3600,
    /** Recommendations - 5 minutes */
    RECOMMENDATIONS: 300,
    /** Benchmarks - 1 day */
    BENCHMARKS: 86400,
  },

  /**
   * Analysis thresholds
   */
  THRESHOLDS: {
    /** Minimum invoices required for pattern analysis */
    MIN_INVOICES_FOR_PATTERN: 5,
    /** Standard deviations for anomaly detection */
    ANOMALY_STD_DEV: 2,
    /** Minimum confidence score to generate recommendation */
    MIN_RECOMMENDATION_CONFIDENCE: 0.6,
    /** Price variance percentage to trigger alert */
    PRICE_VARIANCE_ALERT_THRESHOLD: 10,
  },

  /**
   * Batch processing settings
   */
  BATCH: {
    /** Number of items to process per batch in aggregation */
    AGGREGATION_BATCH_SIZE: 100,
    /** Number of items to process per batch in pattern analysis */
    PATTERN_BATCH_SIZE: 50,
    /** Maximum concurrent database operations */
    MAX_CONCURRENT_DB_OPS: 10,
  },

  /**
   * Retry settings for failed jobs
   */
  RETRY: {
    /** Maximum retry attempts */
    MAX_ATTEMPTS: 3,
    /** Backoff type */
    BACKOFF_TYPE: 'exponential' as const,
    /** Initial delay in ms */
    BACKOFF_DELAY: 2000,
  },

  /**
   * Job cleanup settings
   */
  CLEANUP: {
    /** Keep last N completed jobs */
    KEEP_COMPLETED: 100,
    /** Keep last N failed jobs */
    KEEP_FAILED: 200,
    /** Recommendation expiry in days */
    RECOMMENDATION_EXPIRY_DAYS: 30,
  },
} as const;

/**
 * Type for analytics configuration
 */
export type AnalyticsConfigType = typeof AnalyticsConfig;

/**
 * Feature flags for analytics
 */
export const AnalyticsFeatureFlags = {
  /** Master switch for analytics */
  isEnabled: () => process.env.ANALYTICS_ENABLED === 'true',
  /** Whether background jobs should run */
  areJobsEnabled: () => process.env.ANALYTICS_JOBS_ENABLED === 'true',
  /** Whether to use Redis cache (vs in-memory) */
  useRedisCache: () => !!process.env.REDIS_URL,
} as const;

/**
 * Get Redis URL from environment
 */
export const getRedisUrl = (): string => {
  return process.env.REDIS_URL || 'redis://localhost:6379';
};

export default AnalyticsConfig;
