import { PrismaClient, RecommendationType } from '@prisma/client';
import { logger } from '../../utils/logger';
import { RecommendationError } from '../../errors/AnalyticsError';
import {
  RecommendationService,
  CreateRecommendationInput,
} from './recommendationService';

/**
 * Context available to rules during evaluation
 */
export interface RuleContext {
  /** Prisma client for database queries */
  prisma: PrismaClient;
  /** Current date for time-based calculations */
  currentDate: Date;
  /** Optional item IDs to focus evaluation on */
  itemIds?: number[];
  /** Optional branch IDs to focus evaluation on */
  branchIds?: number[];
  /** Optional vendor IDs to focus evaluation on */
  vendorIds?: number[];
}

/**
 * Result from evaluating a single rule
 */
export interface RuleResult {
  /** Whether the rule generated recommendations */
  triggered: boolean;
  /** Recommendations to create */
  recommendations: CreateRecommendationInput[];
  /** Optional error if rule evaluation failed */
  error?: Error;
}

/**
 * Definition of a recommendation rule
 */
export interface Rule {
  /** Unique identifier for the rule */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what the rule detects */
  description: string;
  /** Type of recommendations this rule generates */
  recommendationType: RecommendationType;
  /** Category for UI grouping */
  category: string;
  /** Priority of generated recommendations (1=critical, 5=low) */
  defaultPriority: number;
  /** Minimum confidence score to trigger */
  minConfidenceThreshold: number;
  /** Whether the rule is currently active */
  isActive: boolean;
  /** The evaluation function */
  evaluate: (context: RuleContext) => Promise<RuleResult>;
}

/**
 * Summary of rule engine evaluation
 */
export interface EvaluationSummary {
  /** Total rules evaluated */
  rulesEvaluated: number;
  /** Rules that generated recommendations */
  rulesTriggered: number;
  /** Rules that failed to evaluate */
  rulesFailed: number;
  /** Total recommendations generated */
  recommendationsGenerated: number;
  /** Breakdown by recommendation type */
  byType: Record<string, number>;
  /** Duration in milliseconds */
  durationMs: number;
}

/**
 * Rule Engine for generating recommendations based on configurable rules
 *
 * ARCHITECTURE: Extensible rule system that allows adding new recommendation
 * logic without modifying core engine. Rules are pure functions that
 * receive context and return recommendations.
 */
export class RuleEngine {
  private readonly log = logger.child({ service: 'RuleEngine' });
  private rules: Map<string, Rule> = new Map();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly recommendationService: RecommendationService
  ) {}

  // ============================================================================
  // Rule Management
  // ============================================================================

  /**
   * Register a new rule with the engine
   *
   * @param rule - Rule definition to register
   * @throws Error if rule with same ID already exists
   */
  registerRule(rule: Rule): void {
    if (this.rules.has(rule.id)) {
      throw new Error(`Rule with ID '${rule.id}' is already registered`);
    }

    this.rules.set(rule.id, rule);
    this.log.info(
      { ruleId: rule.id, ruleName: rule.name },
      'Rule registered'
    );
  }

  /**
   * Register multiple rules at once
   *
   * @param rules - Array of rules to register
   */
  registerRules(rules: Rule[]): void {
    for (const rule of rules) {
      this.registerRule(rule);
    }
  }

  /**
   * Unregister a rule by ID
   *
   * @param ruleId - Rule ID to remove
   * @returns true if rule was removed, false if not found
   */
  unregisterRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      this.log.info({ ruleId }, 'Rule unregistered');
    }
    return removed;
  }

  /**
   * Get all registered rules
   *
   * @returns Array of registered rules
   */
  getRules(): Rule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get active rules only
   *
   * @returns Array of active rules
   */
  getActiveRules(): Rule[] {
    return this.getRules().filter((rule) => rule.isActive);
  }

  /**
   * Enable or disable a rule
   *
   * @param ruleId - Rule ID
   * @param isActive - Whether to enable or disable
   * @returns true if rule was updated, false if not found
   */
  setRuleActive(ruleId: string, isActive: boolean): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return false;
    }

    rule.isActive = isActive;
    this.log.info({ ruleId, isActive }, 'Rule active status updated');
    return true;
  }

  // ============================================================================
  // Rule Evaluation
  // ============================================================================

  /**
   * Evaluate a single rule
   *
   * @param ruleId - Rule ID to evaluate
   * @param context - Evaluation context
   * @returns Rule result
   */
  async evaluateRule(ruleId: string, context?: Partial<RuleContext>): Promise<RuleResult> {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new RecommendationError(
        'evaluateRule',
        `Rule with ID '${ruleId}' not found`
      );
    }

    const fullContext: RuleContext = {
      prisma: this.prisma,
      currentDate: new Date(),
      ...context,
    };

    this.log.info({ ruleId, ruleName: rule.name }, 'Evaluating single rule');

    try {
      const result = await rule.evaluate(fullContext);

      this.log.info(
        {
          ruleId,
          triggered: result.triggered,
          recommendationCount: result.recommendations.length,
        },
        'Rule evaluation completed'
      );

      return result;
    } catch (error) {
      this.log.error({ error, ruleId }, 'Rule evaluation failed');
      return {
        triggered: false,
        recommendations: [],
        error: error as Error,
      };
    }
  }

  /**
   * Evaluate all active rules and generate recommendations
   *
   * @param context - Optional context overrides
   * @returns Evaluation summary
   */
  async evaluateRules(context?: Partial<RuleContext>): Promise<EvaluationSummary> {
    const startTime = Date.now();
    const activeRules = this.getActiveRules();

    this.log.info(
      { ruleCount: activeRules.length },
      'Starting rule evaluation'
    );

    const fullContext: RuleContext = {
      prisma: this.prisma,
      currentDate: new Date(),
      ...context,
    };

    const summary: EvaluationSummary = {
      rulesEvaluated: activeRules.length,
      rulesTriggered: 0,
      rulesFailed: 0,
      recommendationsGenerated: 0,
      byType: {},
      durationMs: 0,
    };

    const allRecommendations: CreateRecommendationInput[] = [];

    // Evaluate rules sequentially to avoid overwhelming the database
    for (const rule of activeRules) {
      try {
        const result = await rule.evaluate(fullContext);

        if (result.triggered) {
          summary.rulesTriggered++;

          // Filter by minimum confidence threshold
          const validRecommendations = result.recommendations.filter(
            (rec) => (rec.confidenceScore ?? 0.5) >= rule.minConfidenceThreshold
          );

          for (const rec of validRecommendations) {
            allRecommendations.push(rec);
            summary.byType[rec.type] = (summary.byType[rec.type] ?? 0) + 1;
          }

          this.log.debug(
            {
              ruleId: rule.id,
              recommendationCount: validRecommendations.length,
            },
            'Rule generated recommendations'
          );
        }
      } catch (error) {
        summary.rulesFailed++;
        this.log.error({ error, ruleId: rule.id }, 'Rule evaluation failed');
      }
    }

    // Create all recommendations
    if (allRecommendations.length > 0) {
      try {
        const created = await this.recommendationService.createMany(allRecommendations);
        summary.recommendationsGenerated = created;
      } catch (error) {
        this.log.error(
          { error, recommendationCount: allRecommendations.length },
          'Failed to create recommendations'
        );
        throw new RecommendationError(
          'evaluateRules',
          'Failed to create recommendations',
          error as Error
        );
      }
    }

    summary.durationMs = Date.now() - startTime;

    this.log.info(
      {
        rulesEvaluated: summary.rulesEvaluated,
        rulesTriggered: summary.rulesTriggered,
        rulesFailed: summary.rulesFailed,
        recommendationsGenerated: summary.recommendationsGenerated,
        durationMs: summary.durationMs,
      },
      'Rule evaluation completed'
    );

    return summary;
  }

  /**
   * Evaluate rules for specific items only
   *
   * @param itemIds - Item IDs to focus on
   * @returns Evaluation summary
   */
  async evaluateRulesForItems(itemIds: number[]): Promise<EvaluationSummary> {
    return this.evaluateRules({ itemIds });
  }

  /**
   * Evaluate rules for specific branches only
   *
   * @param branchIds - Branch IDs to focus on
   * @returns Evaluation summary
   */
  async evaluateRulesForBranches(branchIds: number[]): Promise<EvaluationSummary> {
    return this.evaluateRules({ branchIds });
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Factory function to create RuleEngine
 * ARCHITECTURE: Use factory functions instead of singletons for testability
 *
 * @param prisma - PrismaClient instance
 * @param recommendationService - RecommendationService instance
 * @returns RuleEngine instance
 */
export function createRuleEngine(
  prisma: PrismaClient,
  recommendationService: RecommendationService
): RuleEngine {
  return new RuleEngine(prisma, recommendationService);
}

// ============================================================================
// Built-in Rule Helpers
// ============================================================================

/**
 * Helper to create a rule definition with defaults
 */
export function defineRule(
  config: Omit<Rule, 'isActive'> & { isActive?: boolean }
): Rule {
  return {
    isActive: true,
    ...config,
  };
}
