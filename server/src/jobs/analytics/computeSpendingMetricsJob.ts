import { Job } from 'bull';
import { logger } from '../../utils/logger';
import { AggregationService } from '../../services/analytics/aggregationService';

/**
 * Job data for compute spending metrics job
 */
export interface ComputeSpendingMetricsJobData {
  /** Optional specific date to compute metrics for (defaults to yesterday) */
  date?: string;
}

/**
 * Create processor for computing daily spending metrics
 *
 * ARCHITECTURE: Job handlers are pure functions that receive dependencies
 * This allows for easy testing and dependency injection
 *
 * @param aggregationService - AggregationService instance
 * @returns Job processor function
 */
export function createComputeSpendingMetricsProcessor(
  aggregationService: AggregationService
) {
  const log = logger.child({ job: 'compute-spending-metrics' });

  return async (job: Job<ComputeSpendingMetricsJobData>): Promise<void> => {
    const startTime = Date.now();
    log.info({ jobId: job.id, data: job.data }, 'Starting spending metrics computation');

    try {
      // Determine the date to compute metrics for
      let targetDate: Date;

      if (job.data?.date) {
        // Use specified date if provided
        targetDate = new Date(job.data.date);
      } else {
        // Default to yesterday
        targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - 1);
      }

      // Validate the date
      if (isNaN(targetDate.getTime())) {
        throw new Error(`Invalid date provided: ${job.data?.date}`);
      }

      const dateStr = targetDate.toISOString().split('T')[0];
      log.info({ jobId: job.id, targetDate: dateStr }, 'Computing spending metrics for date');

      // Call the aggregation service
      await aggregationService.computeDailySpendingMetrics(targetDate);

      const durationMs = Date.now() - startTime;
      log.info(
        { jobId: job.id, targetDate: dateStr, durationMs },
        'Spending metrics computation completed successfully'
      );
    } catch (error) {
      const durationMs = Date.now() - startTime;
      log.error(
        { error, jobId: job.id, durationMs },
        'Spending metrics computation failed'
      );
      throw error; // Re-throw to trigger Bull's retry mechanism
    }
  };
}
