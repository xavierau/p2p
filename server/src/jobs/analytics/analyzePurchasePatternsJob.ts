import { Job } from 'bull';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';
import { PatternRecognitionService } from '../../services/analytics/patternRecognitionService';
import { AnalyticsConfig } from '../../config/analytics';

/**
 * Job data for analyze purchase patterns job
 */
export interface AnalyzePurchasePatternsJobData {
  /** Optional specific item IDs to analyze (defaults to incremental update) */
  itemIds?: number[];
  /** Optional branch ID filter */
  branchId?: number;
  /** Force full analysis even if no recent invoices */
  forceFullAnalysis?: boolean;
}

/**
 * Create processor for analyzing purchase patterns
 *
 * ARCHITECTURE: Uses incremental updates by default - only processes
 * items with recent invoices since last analysis. This improves
 * performance for large datasets.
 *
 * @param prisma - PrismaClient instance
 * @param patternRecognitionService - PatternRecognitionService instance
 * @returns Job processor function
 */
export function createAnalyzePurchasePatternsProcessor(
  prisma: PrismaClient,
  patternRecognitionService: PatternRecognitionService
) {
  const log = logger.child({ job: 'analyze-purchase-patterns' });

  return async (job: Job<AnalyzePurchasePatternsJobData>): Promise<void> => {
    const startTime = Date.now();
    log.info({ jobId: job.id, data: job.data }, 'Starting purchase patterns analysis');

    try {
      let itemIds: number[];

      if (job.data?.itemIds && job.data.itemIds.length > 0) {
        // Use specified item IDs if provided
        itemIds = job.data.itemIds;
        log.info(
          { jobId: job.id, itemCount: itemIds.length },
          'Analyzing specified items'
        );
      } else if (job.data?.forceFullAnalysis) {
        // Full analysis: get all items
        const items = await prisma.item.findMany({
          where: { deletedAt: null },
          select: { id: true },
        });
        itemIds = items.map((item) => item.id);
        log.info(
          { jobId: job.id, itemCount: itemIds.length },
          'Running full pattern analysis for all items'
        );
      } else {
        // Incremental update: find items with recent invoices
        itemIds = await getItemsWithRecentInvoices(prisma);
        log.info(
          { jobId: job.id, itemCount: itemIds.length },
          'Running incremental pattern analysis for items with recent invoices'
        );
      }

      if (itemIds.length === 0) {
        log.info({ jobId: job.id }, 'No items to analyze, skipping');
        return;
      }

      // Process items in batches to avoid overwhelming the database
      const batchSize = AnalyticsConfig.BATCH.PATTERN_BATCH_SIZE;
      let processedCount = 0;
      let errorCount = 0;

      for (let i = 0; i < itemIds.length; i += batchSize) {
        const batch = itemIds.slice(i, i + batchSize);

        // Process batch items with controlled concurrency
        const batchPromises = batch.map(async (itemId) => {
          try {
            await patternRecognitionService.analyzePurchasePattern(
              itemId,
              job.data?.branchId
            );
            processedCount++;
          } catch (error) {
            // Log error but continue processing other items
            log.error(
              { error, itemId, jobId: job.id },
              'Failed to analyze pattern for item'
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
            'Pattern analysis progress'
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
          durationMs,
        },
        'Purchase patterns analysis completed'
      );

      // If there were errors but some succeeded, don't fail the job
      if (errorCount > 0 && processedCount === 0) {
        throw new Error(`All ${errorCount} items failed pattern analysis`);
      }
    } catch (error) {
      const durationMs = Date.now() - startTime;
      log.error(
        { error, jobId: job.id, durationMs },
        'Purchase patterns analysis failed'
      );
      throw error; // Re-throw to trigger Bull's retry mechanism
    }
  };
}

/**
 * Get item IDs that have invoices since the last pattern analysis
 *
 * @param prisma - PrismaClient instance
 * @returns Array of item IDs with recent invoices
 */
async function getItemsWithRecentInvoices(prisma: PrismaClient): Promise<number[]> {
  // Find items that have approved invoices since their last pattern analysis
  // or have never been analyzed
  const items = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT DISTINCT ii."itemId" as id
    FROM "InvoiceItem" ii
    JOIN "Invoice" i ON ii."invoiceId" = i.id
    LEFT JOIN "PurchasePattern" pp ON ii."itemId" = pp."itemId"
    WHERE i.status = 'APPROVED'
      AND i."deletedAt" IS NULL
      AND (
        pp.id IS NULL
        OR i.date > pp."analysisEndDate"
        OR i."updatedAt" > pp."computedAt"
      )
  `;

  return items.map((item) => item.id);
}
