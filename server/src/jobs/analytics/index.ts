import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';
import { AnalyticsConfig, getRedisUrl } from '../../config/analytics';
import {
  JobQueueService,
  createJobQueueService,
} from '../../services/infrastructure/jobQueueService';
import { AggregationService } from '../../services/analytics/aggregationService';
import { PatternRecognitionService } from '../../services/analytics/patternRecognitionService';
import { RecommendationService } from '../../services/recommendations/recommendationService';
import { RuleEngine } from '../../services/recommendations/ruleEngine';
import { ICacheService } from '../../domain/analytics';

// Job processors
import { createComputeSpendingMetricsProcessor } from './computeSpendingMetricsJob';
import { createComputePriceBenchmarksProcessor } from './computePriceBenchmarksJob';
import { createAnalyzePurchasePatternsProcessor } from './analyzePurchasePatternsJob';
import { createDetectAnomaliesProcessor } from './detectAnomaliesJob';
import { createGenerateRecommendationsProcessor } from './generateRecommendationsJob';
import { createCleanupExpiredRecommendationsProcessor } from './cleanupExpiredRecommendationsJob';

/**
 * Dependencies required to set up analytics jobs
 */
export interface AnalyticsJobsDependencies {
  prisma: PrismaClient;
  cacheService: ICacheService;
  aggregationService: AggregationService;
  patternRecognitionService: PatternRecognitionService;
  recommendationService: RecommendationService;
  ruleEngine: RuleEngine;
}

/**
 * Analytics jobs setup result
 */
export interface AnalyticsJobsSetupResult {
  jobQueueService: JobQueueService;
  shutdown: () => Promise<void>;
}

const log = logger.child({ module: 'analytics-jobs' });

/**
 * Set up analytics background jobs
 *
 * ARCHITECTURE:
 * - Creates 3 separate Bull queues for different job types
 * - Registers processors for each job name
 * - Schedules recurring jobs with cron expressions from AnalyticsConfig
 * - Jobs on different queues can run in parallel
 *
 * @param dependencies - Required service dependencies
 * @returns Setup result with job queue service and shutdown function
 */
export async function setupAnalyticsJobs(
  dependencies: AnalyticsJobsDependencies
): Promise<AnalyticsJobsSetupResult> {
  log.info('Setting up analytics jobs...');

  const {
    prisma,
    aggregationService,
    patternRecognitionService,
    recommendationService,
    ruleEngine,
  } = dependencies;

  // Create job queue service
  const jobQueueService = createJobQueueService(getRedisUrl());

  // ============================================================================
  // Create Queues
  // ============================================================================

  // Queue for spending metrics and price benchmarks (aggregation jobs)
  const aggregationQueue = jobQueueService.createQueue(
    AnalyticsConfig.QUEUES.AGGREGATION
  );
  log.info(
    { queue: AnalyticsConfig.QUEUES.AGGREGATION },
    'Aggregation queue created'
  );

  // Queue for purchase patterns and anomaly detection (pattern jobs)
  const patternQueue = jobQueueService.createQueue(
    AnalyticsConfig.QUEUES.PATTERN
  );
  log.info(
    { queue: AnalyticsConfig.QUEUES.PATTERN },
    'Pattern queue created'
  );

  // Queue for recommendation generation and cleanup
  const recommendationsQueue = jobQueueService.createQueue(
    AnalyticsConfig.QUEUES.RECOMMENDATIONS
  );
  log.info(
    { queue: AnalyticsConfig.QUEUES.RECOMMENDATIONS },
    'Recommendations queue created'
  );

  // ============================================================================
  // Register Processors (by job NAME, not jobId)
  // ============================================================================

  // Aggregation queue processors
  jobQueueService.registerProcessor(
    AnalyticsConfig.QUEUES.AGGREGATION,
    AnalyticsConfig.JOBS.COMPUTE_SPENDING_METRICS,
    createComputeSpendingMetricsProcessor(aggregationService)
  );

  jobQueueService.registerProcessor(
    AnalyticsConfig.QUEUES.AGGREGATION,
    AnalyticsConfig.JOBS.COMPUTE_PRICE_BENCHMARKS,
    createComputePriceBenchmarksProcessor(aggregationService)
  );

  // Pattern queue processors
  jobQueueService.registerProcessor(
    AnalyticsConfig.QUEUES.PATTERN,
    AnalyticsConfig.JOBS.ANALYZE_PURCHASE_PATTERNS,
    createAnalyzePurchasePatternsProcessor(prisma, patternRecognitionService)
  );

  jobQueueService.registerProcessor(
    AnalyticsConfig.QUEUES.PATTERN,
    AnalyticsConfig.JOBS.DETECT_ANOMALIES,
    createDetectAnomaliesProcessor(prisma, patternRecognitionService)
  );

  // Recommendations queue processors
  jobQueueService.registerProcessor(
    AnalyticsConfig.QUEUES.RECOMMENDATIONS,
    AnalyticsConfig.JOBS.GENERATE_RECOMMENDATIONS,
    createGenerateRecommendationsProcessor(ruleEngine)
  );

  jobQueueService.registerProcessor(
    AnalyticsConfig.QUEUES.RECOMMENDATIONS,
    AnalyticsConfig.JOBS.CLEANUP_EXPIRED_RECOMMENDATIONS,
    createCleanupExpiredRecommendationsProcessor(recommendationService)
  );

  log.info('All job processors registered');

  // ============================================================================
  // Schedule Recurring Jobs
  // ============================================================================

  // Schedule spending metrics computation (hourly)
  await jobQueueService.addRecurringJob(AnalyticsConfig.QUEUES.AGGREGATION, {
    name: AnalyticsConfig.JOBS.COMPUTE_SPENDING_METRICS,
    cron: AnalyticsConfig.SCHEDULES.COMPUTE_SPENDING_METRICS,
    options: {
      timeout: AnalyticsConfig.JOB_TIMEOUTS.COMPUTE_SPENDING_METRICS,
    },
  });

  // Schedule price benchmarks computation (daily at 2 AM)
  await jobQueueService.addRecurringJob(AnalyticsConfig.QUEUES.AGGREGATION, {
    name: AnalyticsConfig.JOBS.COMPUTE_PRICE_BENCHMARKS,
    cron: AnalyticsConfig.SCHEDULES.COMPUTE_PRICE_BENCHMARKS,
    options: {
      timeout: AnalyticsConfig.JOB_TIMEOUTS.COMPUTE_PRICE_BENCHMARKS,
    },
  });

  // Schedule purchase patterns analysis (daily at 3 AM)
  await jobQueueService.addRecurringJob(AnalyticsConfig.QUEUES.PATTERN, {
    name: AnalyticsConfig.JOBS.ANALYZE_PURCHASE_PATTERNS,
    cron: AnalyticsConfig.SCHEDULES.ANALYZE_PURCHASE_PATTERNS,
    options: {
      timeout: AnalyticsConfig.JOB_TIMEOUTS.ANALYZE_PURCHASE_PATTERNS,
    },
  });

  // Schedule anomaly detection (every 6 hours)
  await jobQueueService.addRecurringJob(AnalyticsConfig.QUEUES.PATTERN, {
    name: AnalyticsConfig.JOBS.DETECT_ANOMALIES,
    cron: AnalyticsConfig.SCHEDULES.DETECT_ANOMALIES,
    options: {
      timeout: AnalyticsConfig.JOB_TIMEOUTS.DETECT_ANOMALIES,
    },
  });

  // Schedule recommendation generation (daily at 4 AM)
  await jobQueueService.addRecurringJob(AnalyticsConfig.QUEUES.RECOMMENDATIONS, {
    name: AnalyticsConfig.JOBS.GENERATE_RECOMMENDATIONS,
    cron: AnalyticsConfig.SCHEDULES.GENERATE_RECOMMENDATIONS,
    options: {
      timeout: AnalyticsConfig.JOB_TIMEOUTS.GENERATE_RECOMMENDATIONS,
    },
  });

  // Schedule cleanup of expired recommendations (daily at 1 AM)
  await jobQueueService.addRecurringJob(AnalyticsConfig.QUEUES.RECOMMENDATIONS, {
    name: AnalyticsConfig.JOBS.CLEANUP_EXPIRED_RECOMMENDATIONS,
    cron: AnalyticsConfig.SCHEDULES.CLEANUP_EXPIRED_RECOMMENDATIONS,
    options: {
      timeout: AnalyticsConfig.JOB_TIMEOUTS.CLEANUP_EXPIRED_RECOMMENDATIONS,
    },
  });

  log.info('All recurring jobs scheduled');

  // Log scheduled jobs summary
  const aggregationJobs = await jobQueueService.getRepeatableJobs(
    AnalyticsConfig.QUEUES.AGGREGATION
  );
  const patternJobs = await jobQueueService.getRepeatableJobs(
    AnalyticsConfig.QUEUES.PATTERN
  );
  const recommendationJobs = await jobQueueService.getRepeatableJobs(
    AnalyticsConfig.QUEUES.RECOMMENDATIONS
  );

  log.info(
    {
      aggregationJobs: aggregationJobs.map((j) => ({ name: j.name, cron: j.cron })),
      patternJobs: patternJobs.map((j) => ({ name: j.name, cron: j.cron })),
      recommendationJobs: recommendationJobs.map((j) => ({ name: j.name, cron: j.cron })),
    },
    'Analytics jobs setup complete'
  );

  // Return shutdown function
  const shutdown = async (): Promise<void> => {
    log.info('Shutting down analytics jobs...');
    await jobQueueService.closeAll();
    log.info('Analytics jobs shutdown complete');
  };

  return {
    jobQueueService,
    shutdown,
  };
}

// ============================================================================
// Re-exports
// ============================================================================

export {
  JobQueueService,
  createJobQueueService,
} from '../../services/infrastructure/jobQueueService';

export { createComputeSpendingMetricsProcessor } from './computeSpendingMetricsJob';
export { createComputePriceBenchmarksProcessor } from './computePriceBenchmarksJob';
export { createAnalyzePurchasePatternsProcessor } from './analyzePurchasePatternsJob';
export { createDetectAnomaliesProcessor } from './detectAnomaliesJob';
export { createGenerateRecommendationsProcessor } from './generateRecommendationsJob';
export { createCleanupExpiredRecommendationsProcessor } from './cleanupExpiredRecommendationsJob';

export type { ComputeSpendingMetricsJobData } from './computeSpendingMetricsJob';
export type { ComputePriceBenchmarksJobData } from './computePriceBenchmarksJob';
export type { AnalyzePurchasePatternsJobData } from './analyzePurchasePatternsJob';
export type { DetectAnomaliesJobData } from './detectAnomaliesJob';
export type { GenerateRecommendationsJobData } from './generateRecommendationsJob';
export type { CleanupExpiredRecommendationsJobData } from './cleanupExpiredRecommendationsJob';
