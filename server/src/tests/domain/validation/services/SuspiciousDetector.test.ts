import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ValidationRuleType, ValidationSeverity } from '@prisma/client';
import { SuspiciousDetector } from '../../../../domain/validation/services/SuspiciousDetector';
import { ValidationConfigService } from '../../../../domain/validation/services/ValidationConfigService';
import { InvoiceWithRelations } from '../../../../domain/validation/types/Invoice';
import { ValidationContext } from '../../../../domain/validation/types/ValidationContext';
import { ValidationResult } from '../../../../domain/validation/value-objects/ValidationResult';

// Mock all rule classes at module level with factory functions
vi.mock('../../../../domain/validation/rules/MissingInvoiceNumberRule', () => ({
  MissingInvoiceNumberRule: vi.fn(),
}));
vi.mock('../../../../domain/validation/rules/AmountThresholdExceededRule', () => ({
  AmountThresholdExceededRule: vi.fn(),
}));
vi.mock('../../../../domain/validation/rules/RoundAmountPatternRule', () => ({
  RoundAmountPatternRule: vi.fn(),
}));
vi.mock('../../../../domain/validation/rules/POAmountVarianceRule', () => ({
  POAmountVarianceRule: vi.fn(),
}));
vi.mock('../../../../domain/validation/rules/POItemMismatchRule', () => ({
  POItemMismatchRule: vi.fn(),
}));
vi.mock('../../../../domain/validation/rules/DeliveryNoteMismatchRule', () => ({
  DeliveryNoteMismatchRule: vi.fn(),
}));
vi.mock('../../../../domain/validation/rules/PriceVarianceRule', () => ({
  PriceVarianceRule: vi.fn(),
}));

// Import mocked rule classes
import { MissingInvoiceNumberRule } from '../../../../domain/validation/rules/MissingInvoiceNumberRule';
import { AmountThresholdExceededRule } from '../../../../domain/validation/rules/AmountThresholdExceededRule';
import { RoundAmountPatternRule } from '../../../../domain/validation/rules/RoundAmountPatternRule';
import { POAmountVarianceRule } from '../../../../domain/validation/rules/POAmountVarianceRule';
import { POItemMismatchRule } from '../../../../domain/validation/rules/POItemMismatchRule';
import { DeliveryNoteMismatchRule } from '../../../../domain/validation/rules/DeliveryNoteMismatchRule';
import { PriceVarianceRule } from '../../../../domain/validation/rules/PriceVarianceRule';

describe('SuspiciousDetector', () => {
  let mockConfigService: jest.Mocked<ValidationConfigService>;
  let suspiciousDetector: SuspiciousDetector;
  let mockInvoice: InvoiceWithRelations;
  let mockContext: ValidationContext;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset all rule mocks
    vi.mocked(MissingInvoiceNumberRule).mockClear();
    vi.mocked(AmountThresholdExceededRule).mockClear();
    vi.mocked(RoundAmountPatternRule).mockClear();
    vi.mocked(POAmountVarianceRule).mockClear();
    vi.mocked(POItemMismatchRule).mockClear();
    vi.mocked(DeliveryNoteMismatchRule).mockClear();
    vi.mocked(PriceVarianceRule).mockClear();

    // Create mock config service
    mockConfigService = {
      getAllRuleConfigs: vi.fn(),
      getRuleConfig: vi.fn(),
      invalidateCache: vi.fn(),
      getStats: vi.fn(),
    } as any;

    // Create detector instance
    suspiciousDetector = new SuspiciousDetector(mockConfigService);

    // Create test invoice
    mockInvoice = {
      id: 1,
      invoiceNumber: 'INV-001',
      vendorId: 10,
      totalAmount: 1000,
      date: new Date('2024-01-15'),
      status: 'PENDING',
      deletedAt: null,
      items: [],
    } as InvoiceWithRelations;

    // Create test context
    mockContext = {
      purchaseOrder: null,
      deliveryNotes: [],
      priceHistory: [],
    } as ValidationContext;
  });

  // ==========================================================================
  // Basic Functionality
  // ==========================================================================
  describe('Basic Functionality', () => {
    it('should execute all enabled rules in parallel', async () => {
      // Arrange
      const allRuleConfigs = new Map([
        [
          ValidationRuleType.MISSING_INVOICE_NUMBER,
          {
            enabled: true,
            severity: ValidationSeverity.WARNING,
            config: {},
          },
        ],
        [
          ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED,
          {
            enabled: true,
            severity: ValidationSeverity.WARNING,
            config: { threshold: 10000 },
          },
        ],
      ]);

      mockConfigService.getAllRuleConfigs.mockResolvedValue(allRuleConfigs);

      const mockValidateRule1 = vi.fn().mockResolvedValue(
        ValidationResult.passed(
          ValidationRuleType.MISSING_INVOICE_NUMBER,
          ValidationSeverity.WARNING
        )
      );
      const mockValidateRule2 = vi.fn().mockResolvedValue(
        ValidationResult.passed(
          ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED,
          ValidationSeverity.WARNING
        )
      );

      vi.mocked(MissingInvoiceNumberRule).mockImplementation(function() { return {
        validate: mockValidateRule1,
      } as any; });
      vi.mocked(AmountThresholdExceededRule).mockImplementation(function() { return {
        validate: mockValidateRule2,
      } as any; });

      // Act
      const results = await suspiciousDetector.detectAnomalies(mockInvoice, mockContext);

      // Assert
      expect(mockConfigService.getAllRuleConfigs).toHaveBeenCalledOnce();
      expect(MissingInvoiceNumberRule).toHaveBeenCalledWith({
        enabled: true,
        severity: ValidationSeverity.WARNING,
        config: {},
      });
      expect(AmountThresholdExceededRule).toHaveBeenCalledWith({
        enabled: true,
        severity: ValidationSeverity.WARNING,
        config: { threshold: 10000 },
      });
      expect(mockValidateRule1).toHaveBeenCalledWith(mockInvoice, mockContext);
      expect(mockValidateRule2).toHaveBeenCalledWith(mockInvoice, mockContext);
      expect(results).toHaveLength(2);
    });

    it('should skip disabled rules', async () => {
      // Arrange
      const allRuleConfigs = new Map([
        [
          ValidationRuleType.MISSING_INVOICE_NUMBER,
          {
            enabled: true,
            severity: ValidationSeverity.WARNING,
            config: {},
          },
        ],
        [
          ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED,
          {
            enabled: false, // Disabled
            severity: ValidationSeverity.WARNING,
            config: { threshold: 10000 },
          },
        ],
        [
          ValidationRuleType.ROUND_AMOUNT_PATTERN,
          {
            enabled: true,
            severity: ValidationSeverity.INFO,
            config: {},
          },
        ],
      ]);

      mockConfigService.getAllRuleConfigs.mockResolvedValue(allRuleConfigs);

      const mockValidateRule1 = vi.fn().mockResolvedValue(
        ValidationResult.passed(
          ValidationRuleType.MISSING_INVOICE_NUMBER,
          ValidationSeverity.WARNING
        )
      );
      const mockValidateRule3 = vi.fn().mockResolvedValue(
        ValidationResult.passed(
          ValidationRuleType.ROUND_AMOUNT_PATTERN,
          ValidationSeverity.INFO
        )
      );

      vi.mocked(MissingInvoiceNumberRule).mockImplementation(function() { return {
        validate: mockValidateRule1,
      } as any; });
      vi.mocked(RoundAmountPatternRule).mockImplementation(function() { return {
        validate: mockValidateRule3,
      } as any; });

      // Act
      const results = await suspiciousDetector.detectAnomalies(mockInvoice, mockContext);

      // Assert
      expect(AmountThresholdExceededRule).not.toHaveBeenCalled();
      expect(MissingInvoiceNumberRule).toHaveBeenCalledOnce();
      expect(RoundAmountPatternRule).toHaveBeenCalledOnce();
      expect(results).toHaveLength(2);
    });

    it('should skip DUPLICATE_INVOICE_NUMBER rule (handled by DuplicateDetector)', async () => {
      // Arrange
      const allRuleConfigs = new Map([
        [
          ValidationRuleType.DUPLICATE_INVOICE_NUMBER,
          {
            enabled: true,
            severity: ValidationSeverity.CRITICAL,
            config: {},
          },
        ],
        [
          ValidationRuleType.MISSING_INVOICE_NUMBER,
          {
            enabled: true,
            severity: ValidationSeverity.WARNING,
            config: {},
          },
        ],
      ]);

      mockConfigService.getAllRuleConfigs.mockResolvedValue(allRuleConfigs);

      const mockValidateRule = vi.fn().mockResolvedValue(
        ValidationResult.passed(
          ValidationRuleType.MISSING_INVOICE_NUMBER,
          ValidationSeverity.WARNING
        )
      );

      vi.mocked(MissingInvoiceNumberRule).mockImplementation(function() { return {
        validate: mockValidateRule,
      } as any; });

      // Act
      const results = await suspiciousDetector.detectAnomalies(mockInvoice, mockContext);

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].ruleType).toBe(ValidationRuleType.MISSING_INVOICE_NUMBER);
    });

    it('should return array of ValidationResult objects', async () => {
      // Arrange
      const allRuleConfigs = new Map([
        [
          ValidationRuleType.MISSING_INVOICE_NUMBER,
          {
            enabled: true,
            severity: ValidationSeverity.WARNING,
            config: {},
          },
        ],
      ]);

      mockConfigService.getAllRuleConfigs.mockResolvedValue(allRuleConfigs);

      const expectedResult = ValidationResult.passed(
        ValidationRuleType.MISSING_INVOICE_NUMBER,
        ValidationSeverity.WARNING
      );

      vi.mocked(MissingInvoiceNumberRule).mockImplementation(function() { return {
        validate: vi.fn().mockResolvedValue(expectedResult),
      } as any; });

      // Act
      const results = await suspiciousDetector.detectAnomalies(mockInvoice, mockContext);

      // Assert
      expect(Array.isArray(results)).toBe(true);
      expect(results[0]).toBeInstanceOf(ValidationResult);
      expect(results[0].ruleType).toBe(ValidationRuleType.MISSING_INVOICE_NUMBER);
    });

    it('should return empty array when no rules are enabled', async () => {
      // Arrange
      const allRuleConfigs = new Map([
        [
          ValidationRuleType.MISSING_INVOICE_NUMBER,
          {
            enabled: false,
            severity: ValidationSeverity.WARNING,
            config: {},
          },
        ],
        [
          ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED,
          {
            enabled: false,
            severity: ValidationSeverity.WARNING,
            config: {},
          },
        ],
      ]);

      mockConfigService.getAllRuleConfigs.mockResolvedValue(allRuleConfigs);

      // Act
      const results = await suspiciousDetector.detectAnomalies(mockInvoice, mockContext);

      // Assert
      expect(results).toEqual([]);
    });
  });

  // ==========================================================================
  // Config Service Integration
  // ==========================================================================
  describe('Config Service Integration', () => {
    it('should call getAllRuleConfigs once per detectAnomalies call', async () => {
      // Arrange
      const allRuleConfigs = new Map([
        [
          ValidationRuleType.MISSING_INVOICE_NUMBER,
          {
            enabled: true,
            severity: ValidationSeverity.WARNING,
            config: {},
          },
        ],
      ]);

      mockConfigService.getAllRuleConfigs.mockResolvedValue(allRuleConfigs);

      vi.mocked(MissingInvoiceNumberRule).mockImplementation(function() { return {
        validate: vi.fn().mockResolvedValue(
          ValidationResult.passed(
            ValidationRuleType.MISSING_INVOICE_NUMBER,
            ValidationSeverity.WARNING
          )
        ),
      } as any; });

      // Act
      await suspiciousDetector.detectAnomalies(mockInvoice, mockContext);

      // Assert
      expect(mockConfigService.getAllRuleConfigs).toHaveBeenCalledTimes(1);
    });

    it('should use merged config from ValidationConfigService', async () => {
      // Arrange
      const mergedConfig = {
        enabled: true,
        severity: ValidationSeverity.CRITICAL, // Overridden from env
        config: { threshold: 5000 }, // Custom threshold
      };

      const allRuleConfigs = new Map([
        [ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED, mergedConfig],
      ]);

      mockConfigService.getAllRuleConfigs.mockResolvedValue(allRuleConfigs);

      vi.mocked(AmountThresholdExceededRule).mockImplementation(function() { return {
        validate: vi.fn().mockResolvedValue(
          ValidationResult.passed(
            ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED,
            ValidationSeverity.CRITICAL
          )
        ),
      } as any; });

      // Act
      await suspiciousDetector.detectAnomalies(mockInvoice, mockContext);

      // Assert
      expect(AmountThresholdExceededRule).toHaveBeenCalledWith(mergedConfig);
    });

    it('should handle all 7 rules (excluding DUPLICATE_INVOICE_NUMBER)', async () => {
      // Arrange
      const allRuleConfigs = new Map([
        [ValidationRuleType.DUPLICATE_INVOICE_NUMBER, { enabled: true, severity: ValidationSeverity.CRITICAL, config: {} }], // Skipped
        [ValidationRuleType.MISSING_INVOICE_NUMBER, { enabled: true, severity: ValidationSeverity.WARNING, config: {} }],
        [ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED, { enabled: true, severity: ValidationSeverity.WARNING, config: { threshold: 10000 } }],
        [ValidationRuleType.ROUND_AMOUNT_PATTERN, { enabled: true, severity: ValidationSeverity.INFO, config: {} }],
        [ValidationRuleType.PRICE_VARIANCE, { enabled: true, severity: ValidationSeverity.WARNING, config: {} }],
        [ValidationRuleType.PO_AMOUNT_VARIANCE, { enabled: true, severity: ValidationSeverity.WARNING, config: {} }],
        [ValidationRuleType.PO_ITEM_MISMATCH, { enabled: true, severity: ValidationSeverity.WARNING, config: {} }],
        [ValidationRuleType.DELIVERY_NOTE_MISMATCH, { enabled: true, severity: ValidationSeverity.WARNING, config: {} }],
      ]);

      mockConfigService.getAllRuleConfigs.mockResolvedValue(allRuleConfigs);

      // Mock all rule implementations
      vi.mocked(MissingInvoiceNumberRule).mockImplementation(function() { return {
        validate: vi.fn().mockResolvedValue(ValidationResult.passed(ValidationRuleType.MISSING_INVOICE_NUMBER, ValidationSeverity.WARNING)),
      } as any; });
      vi.mocked(AmountThresholdExceededRule).mockImplementation(function() { return {
        validate: vi.fn().mockResolvedValue(ValidationResult.passed(ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED, ValidationSeverity.WARNING)),
      } as any; });
      vi.mocked(RoundAmountPatternRule).mockImplementation(function() { return {
        validate: vi.fn().mockResolvedValue(ValidationResult.passed(ValidationRuleType.ROUND_AMOUNT_PATTERN, ValidationSeverity.INFO)),
      } as any; });
      vi.mocked(PriceVarianceRule).mockImplementation(function() { return {
        validate: vi.fn().mockResolvedValue(ValidationResult.passed(ValidationRuleType.PRICE_VARIANCE, ValidationSeverity.WARNING)),
      } as any; });
      vi.mocked(POAmountVarianceRule).mockImplementation(function() { return {
        validate: vi.fn().mockResolvedValue(ValidationResult.passed(ValidationRuleType.PO_AMOUNT_VARIANCE, ValidationSeverity.WARNING)),
      } as any; });
      vi.mocked(POItemMismatchRule).mockImplementation(function() { return {
        validate: vi.fn().mockResolvedValue(ValidationResult.passed(ValidationRuleType.PO_ITEM_MISMATCH, ValidationSeverity.WARNING)),
      } as any; });
      vi.mocked(DeliveryNoteMismatchRule).mockImplementation(function() { return {
        validate: vi.fn().mockResolvedValue(ValidationResult.passed(ValidationRuleType.DELIVERY_NOTE_MISMATCH, ValidationSeverity.WARNING)),
      } as any; });

      // Act
      const results = await suspiciousDetector.detectAnomalies(mockInvoice, mockContext);

      // Assert
      expect(results).toHaveLength(7); // 8 rules - 1 duplicate rule = 7
      expect(MissingInvoiceNumberRule).toHaveBeenCalledOnce();
      expect(AmountThresholdExceededRule).toHaveBeenCalledOnce();
      expect(RoundAmountPatternRule).toHaveBeenCalledOnce();
      expect(PriceVarianceRule).toHaveBeenCalledOnce();
      expect(POAmountVarianceRule).toHaveBeenCalledOnce();
      expect(POItemMismatchRule).toHaveBeenCalledOnce();
      expect(DeliveryNoteMismatchRule).toHaveBeenCalledOnce();
    });
  });

  // ==========================================================================
  // Rule Instantiation
  // ==========================================================================
  describe('Rule Instantiation', () => {
    it('should instantiate correct rule class for each rule type', async () => {
      // Arrange
      const allRuleConfigs = new Map([
        [ValidationRuleType.MISSING_INVOICE_NUMBER, { enabled: true, severity: ValidationSeverity.WARNING, config: {} }],
        [ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED, { enabled: true, severity: ValidationSeverity.WARNING, config: {} }],
        [ValidationRuleType.ROUND_AMOUNT_PATTERN, { enabled: true, severity: ValidationSeverity.INFO, config: {} }],
        [ValidationRuleType.PRICE_VARIANCE, { enabled: true, severity: ValidationSeverity.WARNING, config: {} }],
        [ValidationRuleType.PO_AMOUNT_VARIANCE, { enabled: true, severity: ValidationSeverity.WARNING, config: {} }],
        [ValidationRuleType.PO_ITEM_MISMATCH, { enabled: true, severity: ValidationSeverity.WARNING, config: {} }],
        [ValidationRuleType.DELIVERY_NOTE_MISMATCH, { enabled: true, severity: ValidationSeverity.WARNING, config: {} }],
      ]);

      mockConfigService.getAllRuleConfigs.mockResolvedValue(allRuleConfigs);

      // Mock all rules
      vi.mocked(MissingInvoiceNumberRule).mockImplementation(function() { return { validate: vi.fn().mockResolvedValue(ValidationResult.passed(ValidationRuleType.MISSING_INVOICE_NUMBER, ValidationSeverity.WARNING)) } as any; });
      vi.mocked(AmountThresholdExceededRule).mockImplementation(function() { return { validate: vi.fn().mockResolvedValue(ValidationResult.passed(ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED, ValidationSeverity.WARNING)) } as any; });
      vi.mocked(RoundAmountPatternRule).mockImplementation(function() { return { validate: vi.fn().mockResolvedValue(ValidationResult.passed(ValidationRuleType.ROUND_AMOUNT_PATTERN, ValidationSeverity.INFO)) } as any; });
      vi.mocked(PriceVarianceRule).mockImplementation(function() { return { validate: vi.fn().mockResolvedValue(ValidationResult.passed(ValidationRuleType.PRICE_VARIANCE, ValidationSeverity.WARNING)) } as any; });
      vi.mocked(POAmountVarianceRule).mockImplementation(function() { return { validate: vi.fn().mockResolvedValue(ValidationResult.passed(ValidationRuleType.PO_AMOUNT_VARIANCE, ValidationSeverity.WARNING)) } as any; });
      vi.mocked(POItemMismatchRule).mockImplementation(function() { return { validate: vi.fn().mockResolvedValue(ValidationResult.passed(ValidationRuleType.PO_ITEM_MISMATCH, ValidationSeverity.WARNING)) } as any; });
      vi.mocked(DeliveryNoteMismatchRule).mockImplementation(function() { return { validate: vi.fn().mockResolvedValue(ValidationResult.passed(ValidationRuleType.DELIVERY_NOTE_MISMATCH, ValidationSeverity.WARNING)) } as any; });

      // Act
      await suspiciousDetector.detectAnomalies(mockInvoice, mockContext);

      // Assert - Verify each rule class was instantiated
      expect(MissingInvoiceNumberRule).toHaveBeenCalled();
      expect(AmountThresholdExceededRule).toHaveBeenCalled();
      expect(RoundAmountPatternRule).toHaveBeenCalled();
      expect(PriceVarianceRule).toHaveBeenCalled();
      expect(POAmountVarianceRule).toHaveBeenCalled();
      expect(POItemMismatchRule).toHaveBeenCalled();
      expect(DeliveryNoteMismatchRule).toHaveBeenCalled();
    });

    it('should pass config object to rule constructor', async () => {
      // Arrange
      const customConfig = {
        enabled: true,
        severity: ValidationSeverity.CRITICAL,
        config: { threshold: 5000 },
      };

      const allRuleConfigs = new Map([
        [ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED, customConfig],
      ]);

      mockConfigService.getAllRuleConfigs.mockResolvedValue(allRuleConfigs);

      vi.mocked(AmountThresholdExceededRule).mockImplementation(function() { return {
        validate: vi.fn().mockResolvedValue(
          ValidationResult.passed(
            ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED,
            ValidationSeverity.CRITICAL
          )
        ),
      } as any; });

      // Act
      await suspiciousDetector.detectAnomalies(mockInvoice, mockContext);

      // Assert
      expect(AmountThresholdExceededRule).toHaveBeenCalledWith({
        enabled: true,
        severity: ValidationSeverity.CRITICAL,
        config: { threshold: 5000 },
      });
    });

    it('should pass config with enabled, severity, and config properties', async () => {
      // Arrange
      const ruleConfig = {
        enabled: true,
        severity: ValidationSeverity.WARNING,
        config: { variancePercent: 15, historicalCount: 5 },
      };

      const allRuleConfigs = new Map([
        [ValidationRuleType.PRICE_VARIANCE, ruleConfig],
      ]);

      mockConfigService.getAllRuleConfigs.mockResolvedValue(allRuleConfigs);

      vi.mocked(PriceVarianceRule).mockImplementation(function(config: any) {
        // Verify the structure of the config object
        expect(config).toHaveProperty('enabled');
        expect(config).toHaveProperty('severity');
        expect(config).toHaveProperty('config');
        expect(config.enabled).toBe(true);
        expect(config.severity).toBe(ValidationSeverity.WARNING);
        expect(config.config).toEqual({ variancePercent: 15, historicalCount: 5 });

        return {
          validate: vi.fn().mockResolvedValue(
            ValidationResult.passed(
              ValidationRuleType.PRICE_VARIANCE,
              ValidationSeverity.WARNING
            )
          ),
        };
      });

      // Act
      await suspiciousDetector.detectAnomalies(mockInvoice, mockContext);

      // Assert
      expect(PriceVarianceRule).toHaveBeenCalledWith(ruleConfig);
    });
  });

  // ==========================================================================
  // Parallel Execution
  // ==========================================================================
  describe('Parallel Execution', () => {
    it('should execute rules in parallel using Promise.all pattern', async () => {
      // Arrange
      const allRuleConfigs = new Map([
        [ValidationRuleType.MISSING_INVOICE_NUMBER, { enabled: true, severity: ValidationSeverity.WARNING, config: {} }],
        [ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED, { enabled: true, severity: ValidationSeverity.WARNING, config: {} }],
        [ValidationRuleType.ROUND_AMOUNT_PATTERN, { enabled: true, severity: ValidationSeverity.INFO, config: {} }],
      ]);

      mockConfigService.getAllRuleConfigs.mockResolvedValue(allRuleConfigs);

      const executionOrder: string[] = [];

      vi.mocked(MissingInvoiceNumberRule).mockImplementation(function() { return {
        validate: vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          executionOrder.push('rule1');
          return ValidationResult.passed(ValidationRuleType.MISSING_INVOICE_NUMBER, ValidationSeverity.WARNING);
        }),
      } as any; });

      vi.mocked(AmountThresholdExceededRule).mockImplementation(function() { return {
        validate: vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 5));
          executionOrder.push('rule2');
          return ValidationResult.passed(ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED, ValidationSeverity.WARNING);
        }),
      } as any; });

      vi.mocked(RoundAmountPatternRule).mockImplementation(function() { return {
        validate: vi.fn().mockImplementation(async () => {
          executionOrder.push('rule3');
          return ValidationResult.passed(ValidationRuleType.ROUND_AMOUNT_PATTERN, ValidationSeverity.INFO);
        }),
      } as any; });

      // Act
      const results = await suspiciousDetector.detectAnomalies(mockInvoice, mockContext);

      // Assert
      expect(results).toHaveLength(3);
      // Rule3 should finish first (no delay), then rule2 (5ms), then rule1 (10ms)
      expect(executionOrder).toEqual(['rule3', 'rule2', 'rule1']);
    });

    it('should handle rule validation failures without stopping other rules', async () => {
      // Arrange
      const allRuleConfigs = new Map([
        [ValidationRuleType.MISSING_INVOICE_NUMBER, { enabled: true, severity: ValidationSeverity.WARNING, config: {} }],
        [ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED, { enabled: true, severity: ValidationSeverity.WARNING, config: {} }],
      ]);

      mockConfigService.getAllRuleConfigs.mockResolvedValue(allRuleConfigs);

      vi.mocked(MissingInvoiceNumberRule).mockImplementation(function() { return {
        validate: vi.fn().mockResolvedValue(
          ValidationResult.failed(
            ValidationRuleType.MISSING_INVOICE_NUMBER,
            ValidationSeverity.WARNING,
            { message: 'Missing invoice number' }
          )
        ),
      } as any; });

      vi.mocked(AmountThresholdExceededRule).mockImplementation(function() { return {
        validate: vi.fn().mockResolvedValue(
          ValidationResult.passed(
            ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED,
            ValidationSeverity.WARNING
          )
        ),
      } as any; });

      // Act
      const results = await suspiciousDetector.detectAnomalies(mockInvoice, mockContext);

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].isPassed()).toBe(false);
      expect(results[1].isPassed()).toBe(true);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================
  describe('Edge Cases', () => {
    it('should handle empty config map', async () => {
      // Arrange
      mockConfigService.getAllRuleConfigs.mockResolvedValue(new Map());

      // Act
      const results = await suspiciousDetector.detectAnomalies(mockInvoice, mockContext);

      // Assert
      expect(results).toEqual([]);
    });

    it('should handle config service errors gracefully', async () => {
      // Arrange
      mockConfigService.getAllRuleConfigs.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act & Assert
      await expect(
        suspiciousDetector.detectAnomalies(mockInvoice, mockContext)
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle rule validation errors by propagating them', async () => {
      // Arrange
      const allRuleConfigs = new Map([
        [ValidationRuleType.MISSING_INVOICE_NUMBER, { enabled: true, severity: ValidationSeverity.WARNING, config: {} }],
      ]);

      mockConfigService.getAllRuleConfigs.mockResolvedValue(allRuleConfigs);

      vi.mocked(MissingInvoiceNumberRule).mockImplementation(function() { return {
        validate: vi.fn().mockRejectedValue(new Error('Rule execution failed')),
      } as any; });

      // Act & Assert
      await expect(
        suspiciousDetector.detectAnomalies(mockInvoice, mockContext)
      ).rejects.toThrow('Rule execution failed');
    });

    it('should handle only DUPLICATE_INVOICE_NUMBER in config', async () => {
      // Arrange
      const allRuleConfigs = new Map([
        [ValidationRuleType.DUPLICATE_INVOICE_NUMBER, { enabled: true, severity: ValidationSeverity.CRITICAL, config: {} }],
      ]);

      mockConfigService.getAllRuleConfigs.mockResolvedValue(allRuleConfigs);

      // Act
      const results = await suspiciousDetector.detectAnomalies(mockInvoice, mockContext);

      // Assert
      expect(results).toEqual([]);
    });

    it('should efficiently skip disabled rules without instantiation', async () => {
      // Arrange
      const allRuleConfigs = new Map([
        [ValidationRuleType.MISSING_INVOICE_NUMBER, { enabled: false, severity: ValidationSeverity.WARNING, config: {} }],
        [ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED, { enabled: true, severity: ValidationSeverity.WARNING, config: {} }],
      ]);

      mockConfigService.getAllRuleConfigs.mockResolvedValue(allRuleConfigs);

      vi.mocked(AmountThresholdExceededRule).mockImplementation(function() { return {
        validate: vi.fn().mockResolvedValue(
          ValidationResult.passed(
            ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED,
            ValidationSeverity.WARNING
          )
        ),
      } as any; });

      // Act
      await suspiciousDetector.detectAnomalies(mockInvoice, mockContext);

      // Assert - Disabled rule should not be instantiated
      expect(MissingInvoiceNumberRule).not.toHaveBeenCalled();
      expect(AmountThresholdExceededRule).toHaveBeenCalledOnce();
    });
  });
});
