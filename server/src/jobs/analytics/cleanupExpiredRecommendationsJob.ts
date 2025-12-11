import { Job } from 'bull';
import { logger } from '../../utils/logger';
import { RecommendationService } from '../../services/recommendations/recommendationService';
import { AnalyticsConfig } from '../../config/analytics';

/**
 * Job data for cleanup expired recommendations job
 */
export interface CleanupExpiredRecommendationsJobData {
  /** Optional override for days to keep expired recommendations */
  daysToKeep?: number;
  /** Whether to also delete old dismissed recommendations */
  cleanupDismissed?: boolean;
}

/**
 * Create processor for cleaning up expired recommendations
 *
 * ARCHITECTURE: Two-phase cleanup:
 * 1. Mark recommendations as EXPIRED based on expiresAt date
 * 2. Delete old EXPIRED and DISMISSED recommendations based on retention policy
 *
 * @param recommendationService - RecommendationService instance
 * @returns Job processor function
 */
export function createCleanupExpiredRecommendationsProcessor(
  recommendationService: RecommendationService
) {
  const log = logger.child({ job: 'cleanup-expired-recommendations' });

  return async (job: Job<CleanupExpiredRecommendationsJobData>): Promise<void> => {
    const startTime = Date.now();
    log.info({ jobId: job.id, data: job.data }, 'Starting recommendation cleanup');

    try {
      // Phase 1: Expire recommendations that have passed their expiry date
      log.info({ jobId: job.id }, 'Phase 1: Expiring recommendations past expiry date');
      const expiredCount = await recommendationService.expireRecommendations();

      log.info(
        { jobId: job.id, expiredCount },
        'Recommendations marked as expired'
      );

      // Phase 2: Delete old expired/dismissed recommendations
      const daysToKeep = job.data?.daysToKeep ?? AnalyticsConfig.CLEANUP.RECOMMENDATION_EXPIRY_DAYS;
      log.info(
        { jobId: job.id, daysToKeep },
        'Phase 2: Cleaning up old expired/dismissed recommendations'
      );

      const deletedCount = await recommendationService.cleanupOldRecommendations(daysToKeep);

      const durationMs = Date.now() - startTime;
      log.info(
        {
          jobId: job.id,
          expiredCount,
          deletedCount,
          daysToKeep,
          durationMs,
        },
        'Recommendation cleanup completed'
      );
    } catch (error) {
      const durationMs = Date.now() - startTime;
      log.error(
        { error, jobId: job.id, durationMs },
        'Recommendation cleanup failed'
      );
      throw error; // Re-throw to trigger Bull's retry mechanism
    }
  };
}
