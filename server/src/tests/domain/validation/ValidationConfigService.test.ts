/**
 * ValidationConfigService Unit Tests
 *
 * Tests comprehensive coverage of environment variable parsing,
 * config merging, caching, and validation logic.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ValidationRuleType, ValidationSeverity } from '@prisma/client';
import { ValidationConfigService } from '../../../domain/validation/services/ValidationConfigService';
import {
  IValidationRuleRepository,
  ValidationRule,
} from '../../../domain/validation/repositories/IValidationRuleRepository';

/**
 * Mock repository for testing
 */
const createMockRepository = (): IValidationRuleRepository => {
  return {
    findAll: vi.fn(),
    findEnabled: vi.fn(),
    findById: vi.fn(),
    findByType: vi.fn(),
    update: vi.fn(),
  };
};

/**
 * Create mock validation rule
 */
const createMockRule = (
  overrides: Partial<ValidationRule> = {}
): ValidationRule => {
  return {
    id: 1,
    ruleType: ValidationRuleType.DUPLICATE_INVOICE_NUMBER,
    name: 'Duplicate Invoice Number',
    description: 'Test rule',
    enabled: true,
    severity: ValidationSeverity.ERROR,
    config: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
};

/**
 * Clear all validation rule environment variables
 */
const clearEnvVariables = (): void => {
  const ruleTypes = Object.values(ValidationRuleType);

  for (const ruleType of ruleTypes) {
    const prefix = `VALIDATION_RULE_${ruleType}_`;

    // Clear enabled flag
    delete process.env[`${prefix}ENABLED`];

    // Clear config variables
    delete process.env[`${prefix}THRESHOLD`];
    delete process.env[`${prefix}VARIANCE_PERCENT`];
    delete process.env[`${prefix}HISTORICAL_COUNT`];
    delete process.env[`${prefix}MINIMUM_AMOUNT`];
  }
};

describe('ValidationConfigService', () => {
  let mockRepository: IValidationRuleRepository;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockRepository = createMockRepository();
    clearEnvVariables();

    // Spy on console.warn to verify startup validation warnings
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    clearEnvVariables();
    consoleWarnSpy.mockRestore();
    vi.clearAllMocks();
  });

  // ==========================================================================
  // 1. Environment Variable Parsing Tests
  // ==========================================================================

  describe('parseEnvOverrides - Boolean Parsing', () => {
    it('should parse enabled=true correctly', async () => {
      // Arrange
      process.env.VALIDATION_RULE_DUPLICATE_INVOICE_NUMBER_ENABLED = 'true';
      vi.mocked(mockRepository.findAll).mockResolvedValue([
        createMockRule({ enabled: false }),
      ]);

      // Act
      const service = new ValidationConfigService(mockRepository);
      const config = await service.getRuleConfig(
        ValidationRuleType.DUPLICATE_INVOICE_NUMBER
      );

      // Assert
      expect(config.enabled).toBe(true);
    });

    it('should parse enabled=false correctly', async () => {
      // Arrange
      process.env.VALIDATION_RULE_DUPLICATE_INVOICE_NUMBER_ENABLED = 'false';
      vi.mocked(mockRepository.findAll).mockResolvedValue([
        createMockRule({ enabled: true }),
      ]);

      // Act
      const service = new ValidationConfigService(mockRepository);
      const config = await service.getRuleConfig(
        ValidationRuleType.DUPLICATE_INVOICE_NUMBER
      );

      // Assert
      expect(config.enabled).toBe(false);
    });

    it('should handle missing env variable (use DB value)', async () => {
      // Arrange
      vi.mocked(mockRepository.findAll).mockResolvedValue([
        createMockRule({ enabled: true }),
      ]);

      // Act
      const service = new ValidationConfigService(mockRepository);
      const config = await service.getRuleConfig(
        ValidationRuleType.DUPLICATE_INVOICE_NUMBER
      );

      // Assert
      expect(config.enabled).toBe(true);
    });

    it('should handle invalid boolean values (empty string)', async () => {
      // Arrange
      process.env.VALIDATION_RULE_DUPLICATE_INVOICE_NUMBER_ENABLED = '';
      vi.mocked(mockRepository.findAll).mockResolvedValue([
        createMockRule({ enabled: true }),
      ]);

      // Act
      const service = new ValidationConfigService(mockRepository);
      const config = await service.getRuleConfig(
        ValidationRuleType.DUPLICATE_INVOICE_NUMBER
      );

      // Assert - should use DB value and warn
      expect(config.enabled).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should handle invalid boolean values (yes/no)', async () => {
      // Arrange
      process.env.VALIDATION_RULE_DUPLICATE_INVOICE_NUMBER_ENABLED = 'yes';
      vi.mocked(mockRepository.findAll).mockResolvedValue([
        createMockRule({ enabled: false }),
      ]);

      // Act
      const service = new ValidationConfigService(mockRepository);
      const config = await service.getRuleConfig(
        ValidationRuleType.DUPLICATE_INVOICE_NUMBER
      );

      // Assert - should use DB value and warn
      expect(config.enabled).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('parseEnvOverrides - Numeric Parsing', () => {
    it('should parse AMOUNT_THRESHOLD_EXCEEDED threshold correctly', async () => {
      // Arrange
      process.env.VALIDATION_RULE_AMOUNT_THRESHOLD_EXCEEDED_THRESHOLD = '10000';
      vi.mocked(mockRepository.findAll).mockResolvedValue([
        createMockRule({
          ruleType: ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED,
          config: { threshold: 5000 },
        }),
      ]);

      // Act
      const service = new ValidationConfigService(mockRepository);
      const config = await service.getRuleConfig(
        ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED
      );

      // Assert
      expect(config.config.threshold).toBe(10000);
    });

    it('should parse PRICE_VARIANCE config (variancePercent, historicalCount)', async () => {
      // Arrange
      process.env.VALIDATION_RULE_PRICE_VARIANCE_VARIANCE_PERCENT = '15.5';
      process.env.VALIDATION_RULE_PRICE_VARIANCE_HISTORICAL_COUNT = '5';
      vi.mocked(mockRepository.findAll).mockResolvedValue([
        createMockRule({
          ruleType: ValidationRuleType.PRICE_VARIANCE,
          config: { variancePercent: 10, historicalCount: 3 },
        }),
      ]);

      // Act
      const service = new ValidationConfigService(mockRepository);
      const config = await service.getRuleConfig(
        ValidationRuleType.PRICE_VARIANCE
      );

      // Assert
      expect(config.config.variancePercent).toBe(15.5);
      expect(config.config.historicalCount).toBe(5);
    });

    it('should parse PO_AMOUNT_VARIANCE variancePercent', async () => {
      // Arrange
      process.env.VALIDATION_RULE_PO_AMOUNT_VARIANCE_VARIANCE_PERCENT = '20';
      vi.mocked(mockRepository.findAll).mockResolvedValue([
        createMockRule({
          ruleType: ValidationRuleType.PO_AMOUNT_VARIANCE,
          config: { variancePercent: 10 },
        }),
      ]);

      // Act
      const service = new ValidationConfigService(mockRepository);
      const config = await service.getRuleConfig(
        ValidationRuleType.PO_AMOUNT_VARIANCE
      );

      // Assert
      expect(config.config.variancePercent).toBe(20);
    });

    it('should parse ROUND_AMOUNT_PATTERN minimumAmount', async () => {
      // Arrange
      process.env.VALIDATION_RULE_ROUND_AMOUNT_PATTERN_MINIMUM_AMOUNT = '500';
      vi.mocked(mockRepository.findAll).mockResolvedValue([
        createMockRule({
          ruleType: ValidationRuleType.ROUND_AMOUNT_PATTERN,
          config: { minimumAmount: 100 },
        }),
      ]);

      // Act
      const service = new ValidationConfigService(mockRepository);
      const config = await service.getRuleConfig(
        ValidationRuleType.ROUND_AMOUNT_PATTERN
      );

      // Assert
      expect(config.config.minimumAmount).toBe(500);
    });

    it('should handle invalid numeric values (non-numeric strings)', async () => {
      // Arrange
      process.env.VALIDATION_RULE_AMOUNT_THRESHOLD_EXCEEDED_THRESHOLD =
        'invalid';
      vi.mocked(mockRepository.findAll).mockResolvedValue([
        createMockRule({
          ruleType: ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED,
          config: { threshold: 5000 },
        }),
      ]);

      // Act
      const service = new ValidationConfigService(mockRepository);
      const config = await service.getRuleConfig(
        ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED
      );

      // Assert - should use DB value and warn
      expect(config.config.threshold).toBe(5000);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should handle negative numbers with warning', async () => {
      // Arrange
      process.env.VALIDATION_RULE_AMOUNT_THRESHOLD_EXCEEDED_THRESHOLD = '-100';
      vi.mocked(mockRepository.findAll).mockResolvedValue([
        createMockRule({
          ruleType: ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED,
          config: { threshold: 5000 },
        }),
      ]);

      // Act
      const service = new ValidationConfigService(mockRepository);
      await service.getRuleConfig(ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED);

      // Assert - should warn about negative value
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should handle invalid integer value (historicalCount)', async () => {
      // Arrange
      process.env.VALIDATION_RULE_PRICE_VARIANCE_HISTORICAL_COUNT = 'not-a-number';
      vi.mocked(mockRepository.findAll).mockResolvedValue([
        createMockRule({
          ruleType: ValidationRuleType.PRICE_VARIANCE,
          config: { historicalCount: 3 },
        }),
      ]);

      // Act
      const service = new ValidationConfigService(mockRepository);
      const config = await service.getRuleConfig(ValidationRuleType.PRICE_VARIANCE);

      // Assert - should use DB value and warn
      expect(config.config.historicalCount).toBe(3);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should handle negative integer value (historicalCount)', async () => {
      // Arrange
      process.env.VALIDATION_RULE_PRICE_VARIANCE_HISTORICAL_COUNT = '-5';
      vi.mocked(mockRepository.findAll).mockResolvedValue([
        createMockRule({
          ruleType: ValidationRuleType.PRICE_VARIANCE,
          config: { historicalCount: 3 },
        }),
      ]);

      // Act
      const service = new ValidationConfigService(mockRepository);
      await service.getRuleConfig(ValidationRuleType.PRICE_VARIANCE);

      // Assert - should warn about negative integer
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should return empty map when no env variables set', async () => {
      // Arrange
      vi.mocked(mockRepository.findAll).mockResolvedValue([]);

      // Act
      const service = new ValidationConfigService(mockRepository);
      const allConfigs = await service.getAllRuleConfigs();

      // Assert
      expect(allConfigs.size).toBe(0);
    });
  });

  // ==========================================================================
  // 2. Config Merging Tests
  // ==========================================================================

  describe('getRuleConfig - Config Merging', () => {
    it('should return DB config when no env override', async () => {
      // Arrange
      vi.mocked(mockRepository.findAll).mockResolvedValue([
        createMockRule({
          enabled: true,
          severity: ValidationSeverity.ERROR,
          config: { threshold: 5000 },
        }),
      ]);

      // Act
      const service = new ValidationConfigService(mockRepository);
      const config = await service.getRuleConfig(
        ValidationRuleType.DUPLICATE_INVOICE_NUMBER
      );

      // Assert
      expect(config.enabled).toBe(true);
      expect(config.severity).toBe(ValidationSeverity.ERROR);
      expect(config.config).toEqual({ threshold: 5000 });
    });

    it('should return merged config when env override exists', async () => {
      // Arrange
      process.env.VALIDATION_RULE_DUPLICATE_INVOICE_NUMBER_ENABLED = 'false';
      vi.mocked(mockRepository.findAll).mockResolvedValue([
        createMockRule({
          enabled: true,
          severity: ValidationSeverity.WARNING,
        }),
      ]);

      // Act
      const service = new ValidationConfigService(mockRepository);
      const config = await service.getRuleConfig(
        ValidationRuleType.DUPLICATE_INVOICE_NUMBER
      );

      // Assert
      expect(config.enabled).toBe(false); // env override
      expect(config.severity).toBe(ValidationSeverity.WARNING); // DB value
    });

    it('should have env override take precedence over DB (enabled flag)', async () => {
      // Arrange
      process.env.VALIDATION_RULE_DUPLICATE_INVOICE_NUMBER_ENABLED = 'false';
      vi.mocked(mockRepository.findAll).mockResolvedValue([
        createMockRule({ enabled: true }),
      ]);

      // Act
      const service = new ValidationConfigService(mockRepository);
      const config = await service.getRuleConfig(
        ValidationRuleType.DUPLICATE_INVOICE_NUMBER
      );

      // Assert
      expect(config.enabled).toBe(false);
    });

    it('should have env override take precedence over DB (config values)', async () => {
      // Arrange
      process.env.VALIDATION_RULE_AMOUNT_THRESHOLD_EXCEEDED_THRESHOLD = '15000';
      vi.mocked(mockRepository.findAll).mockResolvedValue([
        createMockRule({
          ruleType: ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED,
          config: { threshold: 5000 },
        }),
      ]);

      // Act
      const service = new ValidationConfigService(mockRepository);
      const config = await service.getRuleConfig(
        ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED
      );

      // Assert
      expect(config.config.threshold).toBe(15000);
    });

    it('should deep merge config objects (env + DB configs combined)', async () => {
      // Arrange
      process.env.VALIDATION_RULE_PRICE_VARIANCE_VARIANCE_PERCENT = '20';
      vi.mocked(mockRepository.findAll).mockResolvedValue([
        createMockRule({
          ruleType: ValidationRuleType.PRICE_VARIANCE,
          config: { variancePercent: 10, historicalCount: 3 },
        }),
      ]);

      // Act
      const service = new ValidationConfigService(mockRepository);
      const config = await service.getRuleConfig(
        ValidationRuleType.PRICE_VARIANCE
      );

      // Assert - env overrides variancePercent, DB keeps historicalCount
      expect(config.config.variancePercent).toBe(20);
      expect(config.config.historicalCount).toBe(3);
    });

    it('should handle partial env override (enabled only, no thresholds)', async () => {
      // Arrange
      process.env.VALIDATION_RULE_AMOUNT_THRESHOLD_EXCEEDED_ENABLED = 'false';
      vi.mocked(mockRepository.findAll).mockResolvedValue([
        createMockRule({
          ruleType: ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED,
          enabled: true,
          config: { threshold: 5000 },
        }),
      ]);

      // Act
      const service = new ValidationConfigService(mockRepository);
      const config = await service.getRuleConfig(
        ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED
      );

      // Assert
      expect(config.enabled).toBe(false); // env override
      expect(config.config.threshold).toBe(5000); // DB value
    });

    it('should handle missing DB record (use env with default severity)', async () => {
      // Arrange
      process.env.VALIDATION_RULE_DUPLICATE_INVOICE_NUMBER_ENABLED = 'true';
      vi.mocked(mockRepository.findAll).mockResolvedValue([]); // No DB record

      // Act
      const service = new ValidationConfigService(mockRepository);
      const config = await service.getRuleConfig(
        ValidationRuleType.DUPLICATE_INVOICE_NUMBER
      );

      // Assert
      expect(config.enabled).toBe(true);
      expect(config.severity).toBe(ValidationSeverity.WARNING); // default
      expect(config.config).toEqual({});
    });
  });

  // ==========================================================================
  // 3. Caching Tests
  // ==========================================================================

  describe('getAllRuleConfigs - Caching', () => {
    it('should cache merged config for TTL period (5 minutes)', async () => {
      // Arrange
      vi.mocked(mockRepository.findAll).mockResolvedValue([
        createMockRule(),
      ]);

      // Act
      const service = new ValidationConfigService(mockRepository);
      await service.getAllRuleConfigs();
      await service.getAllRuleConfigs();

      // Assert - findAll should only be called once
      expect(mockRepository.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return cached value on subsequent calls within TTL', async () => {
      // Arrange
      vi.mocked(mockRepository.findAll).mockResolvedValue([
        createMockRule({ enabled: true }),
      ]);

      // Act
      const service = new ValidationConfigService(mockRepository);
      const config1 = await service.getAllRuleConfigs();
      const config2 = await service.getAllRuleConfigs();

      // Assert
      expect(config1).toBe(config2); // Same reference
      expect(mockRepository.findAll).toHaveBeenCalledTimes(1);
    });

    it('should refresh cache after TTL expiry', async () => {
      // Arrange
      vi.mocked(mockRepository.findAll)
        .mockResolvedValueOnce([createMockRule({ enabled: true })])
        .mockResolvedValueOnce([createMockRule({ enabled: false })]);

      // Act
      const service = new ValidationConfigService(mockRepository);

      // First call - populate cache
      const config1 = await service.getRuleConfig(
        ValidationRuleType.DUPLICATE_INVOICE_NUMBER
      );

      // Manually expire cache by advancing time
      // @ts-expect-error - Accessing private property for testing
      service.cacheTimestamp = Date.now() - (6 * 60 * 1000); // 6 minutes ago

      // Second call - should refresh
      const config2 = await service.getRuleConfig(
        ValidationRuleType.DUPLICATE_INVOICE_NUMBER
      );

      // Assert
      expect(config1.enabled).toBe(true);
      expect(config2.enabled).toBe(false);
      expect(mockRepository.findAll).toHaveBeenCalledTimes(2);
    });

    it('should invalidate cache on demand via invalidateCache()', async () => {
      // Arrange
      vi.mocked(mockRepository.findAll)
        .mockResolvedValueOnce([createMockRule({ enabled: true })])
        .mockResolvedValueOnce([createMockRule({ enabled: false })]);

      // Act
      const service = new ValidationConfigService(mockRepository);

      // First call
      const config1 = await service.getRuleConfig(
        ValidationRuleType.DUPLICATE_INVOICE_NUMBER
      );

      // Invalidate cache
      service.invalidateCache();

      // Second call - should fetch from DB again
      const config2 = await service.getRuleConfig(
        ValidationRuleType.DUPLICATE_INVOICE_NUMBER
      );

      // Assert
      expect(config1.enabled).toBe(true);
      expect(config2.enabled).toBe(false);
      expect(mockRepository.findAll).toHaveBeenCalledTimes(2);
    });

    it('should reduce DB calls when cache hit', async () => {
      // Arrange
      vi.mocked(mockRepository.findAll).mockResolvedValue([
        createMockRule(),
      ]);

      // Act
      const service = new ValidationConfigService(mockRepository);

      // Multiple calls within TTL
      await service.getAllRuleConfigs();
      await service.getAllRuleConfigs();
      await service.getAllRuleConfigs();

      // Assert
      expect(mockRepository.findAll).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // 4. Startup Validation Tests
  // ==========================================================================

  describe('validateEnvConfig - Startup Validation', () => {
    it('should log warning for invalid boolean values', () => {
      // Arrange
      process.env.VALIDATION_RULE_DUPLICATE_INVOICE_NUMBER_ENABLED = 'yes';
      vi.mocked(mockRepository.findAll).mockResolvedValue([]);

      // Act
      new ValidationConfigService(mockRepository);

      // Assert
      expect(consoleWarnSpy).toHaveBeenCalled();
      const warnCalls = consoleWarnSpy.mock.calls.flat();
      const hasWarning = warnCalls.some((call) =>
        String(call).includes('VALIDATION_RULE_DUPLICATE_INVOICE_NUMBER_ENABLED')
      );
      expect(hasWarning).toBe(true);
    });

    it('should log warning for invalid numeric values (NaN)', () => {
      // Arrange
      process.env.VALIDATION_RULE_AMOUNT_THRESHOLD_EXCEEDED_THRESHOLD =
        'not-a-number';
      vi.mocked(mockRepository.findAll).mockResolvedValue([]);

      // Act
      new ValidationConfigService(mockRepository);

      // Assert
      expect(consoleWarnSpy).toHaveBeenCalled();
      const warnCalls = consoleWarnSpy.mock.calls.flat();
      const hasWarning = warnCalls.some((call) =>
        String(call).includes('VALIDATION_RULE_AMOUNT_THRESHOLD_EXCEEDED_THRESHOLD')
      );
      expect(hasWarning).toBe(true);
    });

    it('should log warning for negative threshold values', () => {
      // Arrange
      process.env.VALIDATION_RULE_AMOUNT_THRESHOLD_EXCEEDED_THRESHOLD = '-500';
      vi.mocked(mockRepository.findAll).mockResolvedValue([]);

      // Act
      new ValidationConfigService(mockRepository);

      // Assert
      expect(consoleWarnSpy).toHaveBeenCalled();
      const warnCalls = consoleWarnSpy.mock.calls.flat();
      const hasWarning = warnCalls.some((call) =>
        String(call).includes('must be >= 0')
      );
      expect(hasWarning).toBe(true);
    });

    it('should not throw errors, only warn', () => {
      // Arrange
      process.env.VALIDATION_RULE_DUPLICATE_INVOICE_NUMBER_ENABLED = 'invalid';
      process.env.VALIDATION_RULE_AMOUNT_THRESHOLD_EXCEEDED_THRESHOLD =
        'not-a-number';
      vi.mocked(mockRepository.findAll).mockResolvedValue([]);

      // Act & Assert - should not throw
      expect(() => {
        new ValidationConfigService(mockRepository);
      }).not.toThrow();
    });

    it('should not warn when env values are valid', () => {
      // Arrange
      process.env.VALIDATION_RULE_DUPLICATE_INVOICE_NUMBER_ENABLED = 'true';
      process.env.VALIDATION_RULE_AMOUNT_THRESHOLD_EXCEEDED_THRESHOLD = '5000';
      vi.mocked(mockRepository.findAll).mockResolvedValue([]);

      // Act
      new ValidationConfigService(mockRepository);

      // Assert - no validation warnings
      const warnCalls = consoleWarnSpy.mock.calls.flat();
      const hasValidationWarning = warnCalls.some((call) =>
        String(call).includes('Environment configuration issues')
      );
      expect(hasValidationWarning).toBe(false);
    });
  });

  // ==========================================================================
  // 5. Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should treat empty string for ENABLED as undefined', async () => {
      // Arrange
      process.env.VALIDATION_RULE_DUPLICATE_INVOICE_NUMBER_ENABLED = '';
      vi.mocked(mockRepository.findAll).mockResolvedValue([
        createMockRule({ enabled: true }),
      ]);

      // Act
      const service = new ValidationConfigService(mockRepository);
      const config = await service.getRuleConfig(
        ValidationRuleType.DUPLICATE_INVOICE_NUMBER
      );

      // Assert - should use DB value
      expect(config.enabled).toBe(true);
    });

    it('should accept zero threshold as valid value', async () => {
      // Arrange
      process.env.VALIDATION_RULE_AMOUNT_THRESHOLD_EXCEEDED_THRESHOLD = '0';
      vi.mocked(mockRepository.findAll).mockResolvedValue([
        createMockRule({
          ruleType: ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED,
          config: { threshold: 5000 },
        }),
      ]);

      // Act
      const service = new ValidationConfigService(mockRepository);
      const config = await service.getRuleConfig(
        ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED
      );

      // Assert
      expect(config.config.threshold).toBe(0);
    });

    it('should use env with WARNING severity when ENABLED=true but rule not in DB', async () => {
      // Arrange
      process.env.VALIDATION_RULE_DUPLICATE_INVOICE_NUMBER_ENABLED = 'true';
      vi.mocked(mockRepository.findAll).mockResolvedValue([]); // No DB records

      // Act
      const service = new ValidationConfigService(mockRepository);
      const config = await service.getRuleConfig(
        ValidationRuleType.DUPLICATE_INVOICE_NUMBER
      );

      // Assert
      expect(config.enabled).toBe(true);
      expect(config.severity).toBe(ValidationSeverity.WARNING);
    });

    it('should handle multiple rules with mixed env/DB config', async () => {
      // Arrange
      process.env.VALIDATION_RULE_DUPLICATE_INVOICE_NUMBER_ENABLED = 'false';
      process.env.VALIDATION_RULE_AMOUNT_THRESHOLD_EXCEEDED_THRESHOLD = '10000';

      vi.mocked(mockRepository.findAll).mockResolvedValue([
        createMockRule({
          ruleType: ValidationRuleType.DUPLICATE_INVOICE_NUMBER,
          enabled: true,
        }),
        createMockRule({
          ruleType: ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED,
          config: { threshold: 5000 },
        }),
      ]);

      // Act
      const service = new ValidationConfigService(mockRepository);
      const allConfigs = await service.getAllRuleConfigs();

      // Assert
      const dupConfig = allConfigs.get(
        ValidationRuleType.DUPLICATE_INVOICE_NUMBER
      );
      const thresholdConfig = allConfigs.get(
        ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED
      );

      expect(dupConfig?.enabled).toBe(false); // env override
      expect(thresholdConfig?.config.threshold).toBe(10000); // env override
    });

    it('should support all 8 validation rules', async () => {
      // Arrange
      const allRules = [
        ValidationRuleType.DUPLICATE_INVOICE_NUMBER,
        ValidationRuleType.MISSING_INVOICE_NUMBER,
        ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED,
        ValidationRuleType.ROUND_AMOUNT_PATTERN,
        ValidationRuleType.PRICE_VARIANCE,
        ValidationRuleType.PO_AMOUNT_VARIANCE,
        ValidationRuleType.PO_ITEM_MISMATCH,
        ValidationRuleType.DELIVERY_NOTE_MISMATCH,
      ];

      vi.mocked(mockRepository.findAll).mockResolvedValue(
        allRules.map((ruleType, index) =>
          createMockRule({ id: index + 1, ruleType })
        )
      );

      // Act
      const service = new ValidationConfigService(mockRepository);
      const allConfigs = await service.getAllRuleConfigs();

      // Assert
      expect(allConfigs.size).toBe(8);
      allRules.forEach((ruleType) => {
        expect(allConfigs.has(ruleType)).toBe(true);
      });
    });
  });

  // ==========================================================================
  // 6. getStats Tests
  // ==========================================================================

  describe('getStats - Cache Statistics', () => {
    it('should return isCached=false when cache empty', () => {
      // Arrange
      vi.mocked(mockRepository.findAll).mockResolvedValue([]);
      const service = new ValidationConfigService(mockRepository);

      // Act
      const stats = service.getStats();

      // Assert
      expect(stats.isCached).toBe(false);
      expect(stats.age).toBe(0);
      expect(stats.ttl).toBe(5 * 60 * 1000);
    });

    it('should return isCached=true when cache populated', async () => {
      // Arrange
      vi.mocked(mockRepository.findAll).mockResolvedValue([
        createMockRule(),
      ]);
      const service = new ValidationConfigService(mockRepository);

      // Populate cache
      await service.getAllRuleConfigs();

      // Act
      const stats = service.getStats();

      // Assert
      expect(stats.isCached).toBe(true);
    });

    it('should have age increase over time', async () => {
      // Arrange
      vi.mocked(mockRepository.findAll).mockResolvedValue([
        createMockRule(),
      ]);
      const service = new ValidationConfigService(mockRepository);

      // Populate cache
      await service.getAllRuleConfigs();
      const stats1 = service.getStats();

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      const stats2 = service.getStats();

      // Assert
      expect(stats2.age).toBeGreaterThan(stats1.age);
    });

    it('should have ttl constant at 5 minutes (300000ms)', async () => {
      // Arrange
      vi.mocked(mockRepository.findAll).mockResolvedValue([
        createMockRule(),
      ]);
      const service = new ValidationConfigService(mockRepository);

      // Act
      const stats1 = service.getStats();
      await service.getAllRuleConfigs();
      const stats2 = service.getStats();

      // Assert
      expect(stats1.ttl).toBe(5 * 60 * 1000);
      expect(stats2.ttl).toBe(5 * 60 * 1000);
    });
  });

  // ==========================================================================
  // 7. Error Handling
  // ==========================================================================

  describe('Error Handling', () => {
    it('should throw error when getRuleConfig called for non-existent rule', async () => {
      // Arrange
      vi.mocked(mockRepository.findAll).mockResolvedValue([]);
      const service = new ValidationConfigService(mockRepository);

      // Act & Assert
      await expect(
        service.getRuleConfig(ValidationRuleType.DUPLICATE_INVOICE_NUMBER)
      ).rejects.toThrow('No configuration found for rule type');
    });

    it('should handle repository errors gracefully', async () => {
      // Arrange
      vi.mocked(mockRepository.findAll).mockRejectedValue(
        new Error('Database connection failed')
      );
      const service = new ValidationConfigService(mockRepository);

      // Act & Assert
      await expect(service.getAllRuleConfigs()).rejects.toThrow(
        'Database connection failed'
      );
    });
  });
});
