/**
 * Validation Configuration Service
 *
 * Provides merged configuration from environment variables and database.
 * Environment variables always take precedence over database settings.
 *
 * Environment Variable Schema:
 * - Enable/Disable: VALIDATION_RULE_{RULE_TYPE}_ENABLED=true|false
 * - Thresholds: VALIDATION_RULE_{RULE_TYPE}_{CONFIG_KEY}=value
 *
 * Examples:
 * - VALIDATION_RULE_DUPLICATE_INVOICE_NUMBER_ENABLED=true
 * - VALIDATION_RULE_AMOUNT_THRESHOLD_EXCEEDED_THRESHOLD=10000
 * - VALIDATION_RULE_PRICE_VARIANCE_VARIANCE_PERCENT=15
 * - VALIDATION_RULE_PRICE_VARIANCE_HISTORICAL_COUNT=5
 *
 * Caching: 5-minute TTL aligned with ValidationRuleCache
 */

import { ValidationRuleType, ValidationSeverity } from '@prisma/client';
import {
  IValidationRuleRepository,
  ValidationRule,
} from '../repositories/IValidationRuleRepository';
import {
  IValidationConfigService,
  ValidationRuleConfig,
} from './IValidationConfigService';

/**
 * Environment variable override data structure
 */
interface EnvOverride {
  enabled?: boolean;
  severity?: ValidationSeverity;
  config?: Record<string, unknown>;
}

/**
 * Validation Configuration Service Implementation
 *
 * Merges environment variable overrides with database configuration.
 * Validates environment configuration on startup.
 * Caches merged configuration for 5 minutes.
 */
export class ValidationConfigService implements IValidationConfigService {
  private cache: Map<ValidationRuleType, ValidationRuleConfig> | null = null;
  private cacheTimestamp: number = 0;
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(private ruleRepository: IValidationRuleRepository) {
    this.validateEnvConfig();
  }

  /**
   * Get merged configuration for a specific rule
   *
   * @param ruleType - The rule type to get config for
   * @returns Merged configuration (env + database)
   * @throws Error if no configuration found
   */
  async getRuleConfig(
    ruleType: ValidationRuleType
  ): Promise<ValidationRuleConfig> {
    const allConfigs = await this.getAllRuleConfigs();
    const config = allConfigs.get(ruleType);

    if (!config) {
      throw new Error(`No configuration found for rule type: ${ruleType}`);
    }

    return config;
  }

  /**
   * Get all rule configurations with env overrides applied
   * Uses cache if available and not expired
   *
   * @returns Map of all validation rule configurations
   */
  async getAllRuleConfigs(): Promise<
    Map<ValidationRuleType, ValidationRuleConfig>
  > {
    const now = Date.now();

    // Return cached configs if still valid
    if (this.cache && now - this.cacheTimestamp < this.TTL_MS) {
      return this.cache;
    }

    // Fetch from database
    const dbRules = await this.ruleRepository.findAll();

    // Parse environment overrides
    const envOverrides = this.parseEnvOverrides();

    // Merge configs (env overrides win)
    const mergedConfigs = new Map<ValidationRuleType, ValidationRuleConfig>();

    for (const dbRule of dbRules) {
      const envOverride = envOverrides.get(dbRule.ruleType);
      const merged = this.mergeConfig(dbRule, envOverride);
      mergedConfigs.set(dbRule.ruleType, merged);
    }

    // Handle case where env defines a rule not in DB
    for (const [ruleType, envOverride] of envOverrides) {
      if (!mergedConfigs.has(ruleType)) {
        // Use env override with default severity
        mergedConfigs.set(ruleType, {
          enabled: envOverride.enabled ?? false,
          severity: envOverride.severity ?? ValidationSeverity.WARNING,
          config: envOverride.config ?? {},
        });
      }
    }

    // Update cache
    this.cache = mergedConfigs;
    this.cacheTimestamp = now;

    return mergedConfigs;
  }

  /**
   * Invalidate cache (call when rules are updated via API)
   */
  invalidateCache(): void {
    this.cache = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Get cache statistics for monitoring
   */
  getStats(): { isCached: boolean; age: number; ttl: number } {
    const now = Date.now();
    const age = this.cache ? now - this.cacheTimestamp : 0;
    return {
      isCached: this.cache !== null,
      age,
      ttl: this.TTL_MS,
    };
  }

  /**
   * Parse environment variable overrides for all validation rules
   *
   * Parses VALIDATION_RULE_* environment variables into structured config.
   * Invalid values are logged as warnings and ignored (DB fallback used).
   *
   * @private
   * @returns Map of rule types to their environment overrides
   */
  private parseEnvOverrides(): Map<ValidationRuleType, EnvOverride> {
    const overrides = new Map<ValidationRuleType, EnvOverride>();

    for (const ruleType of Object.values(ValidationRuleType)) {
      const prefix = `VALIDATION_RULE_${ruleType}_`;
      const override: EnvOverride = {};

      // Check enabled flag
      const enabledKey = `${prefix}ENABLED`;
      if (process.env[enabledKey] !== undefined) {
        const value = process.env[enabledKey];
        if (value === 'true') {
          override.enabled = true;
        } else if (value === 'false') {
          override.enabled = false;
        } else {
          console.warn(
            `[ValidationConfig] Invalid value for ${enabledKey}: "${value}". Must be "true" or "false". Using database value.`
          );
        }
      }

      // Parse rule-specific configs
      const ruleConfig = this.parseRuleSpecificConfig(ruleType, prefix);
      if (Object.keys(ruleConfig).length > 0) {
        override.config = ruleConfig;
      }

      // Only add to overrides if we found something
      if (Object.keys(override).length > 0) {
        overrides.set(ruleType, override);
      }
    }

    return overrides;
  }

  /**
   * Parse rule-specific configuration from environment variables
   *
   * Extracts threshold and config values specific to each rule type.
   * Invalid numeric values are logged and ignored (DB fallback used).
   *
   * @private
   * @param ruleType - The validation rule type
   * @param prefix - Environment variable prefix for this rule
   * @returns Rule-specific configuration object
   */
  private parseRuleSpecificConfig(
    ruleType: ValidationRuleType,
    prefix: string
  ): Record<string, unknown> {
    const config: Record<string, unknown> = {};

    switch (ruleType) {
      case ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED:
        this.parseNumericConfig(config, prefix, 'THRESHOLD', 'threshold');
        break;

      case ValidationRuleType.PRICE_VARIANCE:
        this.parseNumericConfig(
          config,
          prefix,
          'VARIANCE_PERCENT',
          'variancePercent'
        );
        this.parseIntegerConfig(
          config,
          prefix,
          'HISTORICAL_COUNT',
          'historicalCount'
        );
        break;

      case ValidationRuleType.PO_AMOUNT_VARIANCE:
        this.parseNumericConfig(
          config,
          prefix,
          'VARIANCE_PERCENT',
          'variancePercent'
        );
        break;

      case ValidationRuleType.ROUND_AMOUNT_PATTERN:
        this.parseNumericConfig(
          config,
          prefix,
          'MINIMUM_AMOUNT',
          'minimumAmount'
        );
        break;

      // Rules without config parameters
      case ValidationRuleType.DUPLICATE_INVOICE_NUMBER:
      case ValidationRuleType.MISSING_INVOICE_NUMBER:
      case ValidationRuleType.PO_ITEM_MISMATCH:
      case ValidationRuleType.DELIVERY_NOTE_MISMATCH:
        break;
    }

    return config;
  }

  /**
   * Parse numeric (float) environment variable
   *
   * @private
   * @param config - Config object to populate
   * @param prefix - Environment variable prefix
   * @param envKey - Environment variable suffix
   * @param configKey - Key to use in config object
   */
  private parseNumericConfig(
    config: Record<string, unknown>,
    prefix: string,
    envKey: string,
    configKey: string
  ): void {
    const fullKey = `${prefix}${envKey}`;
    const value = process.env[fullKey];

    if (value !== undefined) {
      const parsed = parseFloat(value);
      if (isNaN(parsed)) {
        console.warn(
          `[ValidationConfig] Invalid numeric value for ${fullKey}: "${value}". Using database value.`
        );
      } else {
        config[configKey] = parsed;
      }
    }
  }

  /**
   * Parse integer environment variable
   *
   * @private
   * @param config - Config object to populate
   * @param prefix - Environment variable prefix
   * @param envKey - Environment variable suffix
   * @param configKey - Key to use in config object
   */
  private parseIntegerConfig(
    config: Record<string, unknown>,
    prefix: string,
    envKey: string,
    configKey: string
  ): void {
    const fullKey = `${prefix}${envKey}`;
    const value = process.env[fullKey];

    if (value !== undefined) {
      const parsed = parseInt(value, 10);
      if (isNaN(parsed)) {
        console.warn(
          `[ValidationConfig] Invalid integer value for ${fullKey}: "${value}". Using database value.`
        );
      } else {
        config[configKey] = parsed;
      }
    }
  }

  /**
   * Merge database config with environment overrides
   *
   * Environment overrides take precedence over database values.
   * Config objects are deep merged (env keys override DB keys).
   *
   * @private
   * @param dbRule - Database validation rule
   * @param envOverride - Environment variable overrides (if any)
   * @returns Merged configuration
   */
  private mergeConfig(
    dbRule: ValidationRule,
    envOverride?: EnvOverride
  ): ValidationRuleConfig {
    // Start with database config as base
    const baseConfig = (dbRule.config as Record<string, unknown>) || {};

    // Apply env overrides for config parameters
    const mergedConfig = {
      ...baseConfig,
      ...(envOverride?.config || {}),
    };

    return {
      enabled: envOverride?.enabled ?? dbRule.enabled,
      severity: envOverride?.severity ?? dbRule.severity,
      config: mergedConfig,
    };
  }

  /**
   * Validate environment configuration on startup
   *
   * Checks for invalid values and logs warnings.
   * Does not prevent startup - invalid values fall back to database.
   *
   * @private
   */
  private validateEnvConfig(): void {
    const issues: string[] = [];

    // Check all VALIDATION_RULE_* environment variables
    for (const ruleType of Object.values(ValidationRuleType)) {
      const prefix = `VALIDATION_RULE_${ruleType}_`;

      // Validate enabled flag
      const enabledKey = `${prefix}ENABLED`;
      const enabledValue = process.env[enabledKey];
      if (
        enabledValue !== undefined &&
        enabledValue !== 'true' &&
        enabledValue !== 'false'
      ) {
        issues.push(
          `${enabledKey}: "${enabledValue}" (must be "true" or "false")`
        );
      }

      // Validate numeric configs
      this.validateNumericEnvVar(
        issues,
        prefix,
        'THRESHOLD',
        ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED === ruleType
      );
      this.validateNumericEnvVar(
        issues,
        prefix,
        'VARIANCE_PERCENT',
        ValidationRuleType.PRICE_VARIANCE === ruleType ||
          ValidationRuleType.PO_AMOUNT_VARIANCE === ruleType
      );
      this.validateIntegerEnvVar(
        issues,
        prefix,
        'HISTORICAL_COUNT',
        ValidationRuleType.PRICE_VARIANCE === ruleType
      );
      this.validateNumericEnvVar(
        issues,
        prefix,
        'MINIMUM_AMOUNT',
        ValidationRuleType.ROUND_AMOUNT_PATTERN === ruleType
      );
    }

    if (issues.length > 0) {
      console.warn('');
      console.warn(
        '========================================================================='
      );
      console.warn(
        '[ValidationConfig] Environment configuration issues detected:'
      );
      console.warn(
        '========================================================================='
      );
      issues.forEach((issue) => console.warn(`  - ${issue}`));
      console.warn(
        'Falling back to database configuration for invalid values.'
      );
      console.warn(
        '========================================================================='
      );
      console.warn('');
    }
  }

  /**
   * Validate numeric environment variable
   *
   * @private
   * @param issues - Array to collect validation issues
   * @param prefix - Environment variable prefix
   * @param key - Environment variable suffix
   * @param shouldExist - Whether this variable should exist for this rule
   */
  private validateNumericEnvVar(
    issues: string[],
    prefix: string,
    key: string,
    shouldExist: boolean
  ): void {
    const fullKey = `${prefix}${key}`;
    const value = process.env[fullKey];

    if (value !== undefined) {
      const parsed = parseFloat(value);
      if (isNaN(parsed)) {
        issues.push(`${fullKey}: "${value}" (must be a valid number)`);
      } else if (parsed < 0) {
        issues.push(`${fullKey}: ${parsed} (must be >= 0)`);
      }
    }
  }

  /**
   * Validate integer environment variable
   *
   * @private
   * @param issues - Array to collect validation issues
   * @param prefix - Environment variable prefix
   * @param key - Environment variable suffix
   * @param shouldExist - Whether this variable should exist for this rule
   */
  private validateIntegerEnvVar(
    issues: string[],
    prefix: string,
    key: string,
    shouldExist: boolean
  ): void {
    const fullKey = `${prefix}${key}`;
    const value = process.env[fullKey];

    if (value !== undefined) {
      const parsed = parseInt(value, 10);
      if (isNaN(parsed)) {
        issues.push(`${fullKey}: "${value}" (must be a valid integer)`);
      } else if (parsed < 0) {
        issues.push(`${fullKey}: ${parsed} (must be >= 0)`);
      }
    }
  }
}
