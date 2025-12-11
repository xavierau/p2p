import { Job } from 'bull';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';
import { PatternRecognitionService } from '../../services/analytics/patternRecognitionService';
import { AnalyticsConfig } from '../../config/analytics';

/**
 * Job data for detect anomalies job
 */
export interface DetectAnomaliesJobData {
  /** Optional specific item IDs to check for anomalies */
  itemIds?: number[];
  /** Optional branch ID filter */
  branchId?: number;
}

/**
 * Create processor for detecting ordering anomalies
 *
 * ARCHITECTURE: Detects anomalies by comparing recent orders against
 * established purchase patterns. Only processes items that have
 * existing patterns to compare against.
 *
 * @param prisma - PrismaClient instance
 * @param patternRecognitionService - PatternRecognitionService instance
 * @returns Job processor function
 */
export function createDetectAnomaliesProcessor(
  prisma: PrismaClient,
  patternRecognitionService: PatternRecognitionService
) {
  const log = logger.child({ job: 'detect-anomalies' });

  return async (job: Job<DetectAnomaliesJobData>): Promise<void> => {
    const startTime = Date.now();
    log.info({ jobId: job.id, data: job.data }, 'Starting anomaly detection');

    try {
      let itemIds: number[];

      if (job.data?.itemIds && job.data.itemIds.length > 0) {
        // Use specified item IDs if provided
        itemIds = job.data.itemIds;
        log.info(
          { jobId: job.id, itemCount: itemIds.length },
          'Detecting anomalies for specified items'
        );
      } else {
        // Get all items that have existing purchase patterns
        const patterns = await prisma.purchasePattern.findMany({
          where: job.data?.branchId
            ? { branchId: job.data.branchId }
            : {},
          select: { itemId: true },
        });

        // Get unique item IDs
        itemIds = [...new Set(patterns.map((p) => p.itemId))];
        log.info(
          { jobId: job.id, itemCount: itemIds.length },
          'Detecting anomalies for items with purchase patterns'
        );
      }

      if (itemIds.length === 0) {
        log.info(
          { jobId: job.id },
          'No items with purchase patterns found, skipping anomaly detection'
        );
        return;
      }

      // Process items in batches
      const batchSize = AnalyticsConfig.BATCH.PATTERN_BATCH_SIZE;
      let totalAnomalies = 0;
      let processedCount = 0;
      let errorCount = 0;

      for (let i = 0; i < itemIds.length; i += batchSize) {
        const batch = itemIds.slice(i, i + batchSize);

        // Process batch items with controlled concurrency
        const batchPromises = batch.map(async (itemId) => {
          try {
            const anomalies = await patternRecognitionService.detectAnomalies(
              itemId,
              job.data?.branchId
            );
            totalAnomalies += anomalies.length;
            processedCount++;
          } catch (error) {
            // Log error but continue processing other items
            log.error(
              { error, itemId, jobId: job.id },
              'Failed to detect anomalies for item'
            );
            errorCount++;
          }
        });

        // Wait for batch to complete
        await Promise.all(batchPromises);

        // Log progress for large datasets
        if (itemIds.length > batchSize) {
          const progress = Math.round(((i + batch.length) / itemIds.length) * 100);
          log.info(
            { jobId: job.id, progress, processed: i + batch.length, total: itemIds.length },
            'Anomaly detection progress'
          );
        }
      }

      const durationMs = Date.now() - startTime;
      log.info(
        {
          jobId: job.id,
          processedCount,
          errorCount,
          totalItems: itemIds.length,
          totalAnomalies,
          durationMs,
        },
        'Anomaly detection completed'
      );

      // If there were errors but some succeeded, don't fail the job
      if (errorCount > 0 && processedCount === 0) {
        throw new Error(`All ${errorCount} items failed anomaly detection`);
      }
    } catch (error) {
      const durationMs = Date.now() - startTime;
      log.error(
        { error, jobId: job.id, durationMs },
        'Anomaly detection failed'
      );
      throw error; // Re-throw to trigger Bull's retry mechanism
    }
  };
}
