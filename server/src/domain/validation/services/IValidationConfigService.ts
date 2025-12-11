/**
 * Validation Configuration Service Interface
 *
 * Domain layer interface for validation rule configuration management.
 * Provides merged configuration from environment variables and database.
 *
 * Configuration Hierarchy (highest to lowest priority):
 * 1. Environment variables (.env) - Runtime overrides
 * 2. Database (ValidationRule table) - Persistent defaults
 * 3. Hard-coded defaults - Fallback values
 */

import { ValidationRuleType, ValidationSeverity } from '@prisma/client';

/**
 * Merged validation rule configuration
 * Combines database settings with environment variable overrides
 */
export interface ValidationRuleConfig {
  /** Whether the rule is enabled */
  enabled: boolean;

  /** Severity level for validation failures */
  severity: ValidationSeverity;

  /** Rule-specific configuration parameters */
  config: Record<string, unknown>;
}

/**
 * Validation configuration service interface
 *
 * Responsibilities:
 * - Parse environment variable overrides
 * - Fetch database configuration
 * - Merge configurations (env takes precedence)
 * - Cache merged results (5-minute TTL)
 * - Validate configuration on startup
 */
export interface IValidationConfigService {
  /**
   * Get merged configuration for a specific validation rule
   *
   * @param ruleType - The validation rule type
   * @returns Merged configuration with env overrides applied
   * @throws Error if rule configuration not found
   */
  getRuleConfig(ruleType: ValidationRuleType): Promise<ValidationRuleConfig>;

  /**
   * Get all validation rule configurations with env overrides applied
   *
   * Uses cache if available and not expired (5-minute TTL).
   * Environment variable overrides are applied to database config.
   *
   * @returns Map of rule types to their merged configurations
   */
  getAllRuleConfigs(): Promise<Map<ValidationRuleType, ValidationRuleConfig>>;

  /**
   * Invalidate configuration cache
   *
   * Call this when validation rules are updated via API
   * to force fresh read from database on next access.
   */
  invalidateCache(): void;

  /**
   * Get cache statistics for monitoring
   *
   * @returns Cache state, age in milliseconds, and TTL
   */
  getStats(): {
    isCached: boolean;
    age: number;
    ttl: number;
  };
}
