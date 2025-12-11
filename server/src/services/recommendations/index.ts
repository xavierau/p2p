/**
 * Recommendations Services Index
 * Re-exports all recommendation service implementations and factory functions
 *
 * ARCHITECTURE: Services use dependency injection for testability
 */

// Recommendation Service
export {
  RecommendationService,
  createRecommendationService,
  type CreateRecommendationInput,
  type UpdateRecommendationInput,
  type RecommendationFilters,
  type PaginationOptions,
  type PaginatedResult,
} from './recommendationService';

// Rule Engine
export {
  RuleEngine,
  createRuleEngine,
  defineRule,
  type Rule,
  type RuleContext,
  type RuleResult,
  type EvaluationSummary,
} from './ruleEngine';
