import { Job } from 'bull';
import { logger } from '../../utils/logger';
import { RuleEngine, RuleContext } from '../../services/recommendations/ruleEngine';

/**
 * Job data for generate recommendations job
 */
export interface GenerateRecommendationsJobData {
  /** Optional specific item IDs to generate recommendations for */
  itemIds?: number[];
  /** Optional branch IDs to focus on */
  branchIds?: number[];
  /** Optional vendor IDs to focus on */
  vendorIds?: number[];
}

/**
 * Create processor for generating recommendations via rule engine
 *
 * ARCHITECTURE: Delegates to RuleEngine.evaluateRules() which evaluates
 * all active rules and creates recommendations. Rules are registered
 * separately and can be enabled/disabled dynamically.
 *
 * @param ruleEngine - RuleEngine instance with registered rules
 * @returns Job processor function
 */
export function createGenerateRecommendationsProcessor(
  ruleEngine: RuleEngine
) {
  const log = logger.child({ job: 'generate-recommendations' });

  return async (job: Job<GenerateRecommendationsJobData>): Promise<void> => {
    const startTime = Date.now();
    log.info({ jobId: job.id, data: job.data }, 'Starting recommendation generation');

    try {
      // Build context from job data
      const context: Partial<RuleContext> = {};

      if (job.data?.itemIds && job.data.itemIds.length > 0) {
        context.itemIds = job.data.itemIds;
      }

      if (job.data?.branchIds && job.data.branchIds.length > 0) {
        context.branchIds = job.data.branchIds;
      }

      if (job.data?.vendorIds && job.data.vendorIds.length > 0) {
        context.vendorIds = job.data.vendorIds;
      }

      // Log active rules
      const activeRules = ruleEngine.getActiveRules();
      log.info(
        { jobId: job.id, activeRuleCount: activeRules.length },
        'Evaluating active rules'
      );

      if (activeRules.length === 0) {
        log.warn(
          { jobId: job.id },
          'No active rules registered, skipping recommendation generation'
        );
        return;
      }

      // Evaluate all rules
      const summary = await ruleEngine.evaluateRules(context);

      const durationMs = Date.now() - startTime;
      log.info(
        {
          jobId: job.id,
          rulesEvaluated: summary.rulesEvaluated,
          rulesTriggered: summary.rulesTriggered,
          rulesFailed: summary.rulesFailed,
          recommendationsGenerated: summary.recommendationsGenerated,
          byType: summary.byType,
          durationMs,
        },
        'Recommendation generation completed'
      );

      // If all rules failed, throw to trigger retry
      if (summary.rulesFailed === summary.rulesEvaluated && summary.rulesEvaluated > 0) {
        throw new Error('All rules failed to evaluate');
      }
    } catch (error) {
      const durationMs = Date.now() - startTime;
      log.error(
        { error, jobId: job.id, durationMs },
        'Recommendation generation failed'
      );
      throw error; // Re-throw to trigger Bull's retry mechanism
    }
  };
}
