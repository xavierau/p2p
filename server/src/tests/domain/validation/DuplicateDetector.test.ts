import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ValidationRuleType, ValidationSeverity } from '@prisma/client';
import { DuplicateDetector } from '../../../domain/validation/services/DuplicateDetector';
import { ValidationConfigService } from '../../../domain/validation/services/ValidationConfigService';
import { IInvoiceRepository } from '../../../domain/validation/repositories/IInvoiceRepository';
import { InvoiceWithRelations } from '../../../domain/validation/types/Invoice';

describe('DuplicateDetector', () => {
  let mockInvoiceRepository: {
    findDuplicateByNumberAndVendor: ReturnType<typeof vi.fn>;
  };
  let mockConfigService: {
    getRuleConfig: ReturnType<typeof vi.fn>;
  };
  let detector: DuplicateDetector;

  const createMockInvoice = (
    overrides: Partial<InvoiceWithRelations> = {}
  ): InvoiceWithRelations => ({
    id: 1,
    invoiceNumber: 'INV-001',
    vendorId: 10,
    date: new Date('2024-01-15'),
    status: 'PENDING',
    totalAmount: 1000,
    userId: 1,
    project: null,
    accountingId: null,
    syncStatus: 'PENDING',
    syncError: null,
    deletedAt: null,
    purchaseOrderId: null,
    branchId: null,
    departmentId: null,
    costCenterId: null,
    items: [],
    ...overrides,
  });

  beforeEach(() => {
    mockInvoiceRepository = {
      findDuplicateByNumberAndVendor: vi.fn(),
    };

    mockConfigService = {
      getRuleConfig: vi.fn(),
    };

    vi.clearAllMocks();
  });

  // ==========================================================================
  // WITH ValidationConfigService - Rule Enabled/Disabled Tests
  // ==========================================================================
  describe('with ValidationConfigService', () => {
    describe('when rule is enabled', () => {
      beforeEach(() => {
        mockConfigService.getRuleConfig.mockResolvedValue({
          enabled: true,
          severity: ValidationSeverity.CRITICAL,
          config: {},
        });

        detector = new DuplicateDetector(
          mockInvoiceRepository as unknown as IInvoiceRepository,
          mockConfigService as unknown as ValidationConfigService
        );
      });

      it('should execute duplicate check when enabled', async () => {
        const invoice = createMockInvoice();
        mockInvoiceRepository.findDuplicateByNumberAndVendor.mockResolvedValue(
          null
        );

        const result = await detector.checkDuplicate(invoice);

        expect(mockConfigService.getRuleConfig).toHaveBeenCalledWith(
          ValidationRuleType.DUPLICATE_INVOICE_NUMBER
        );
        expect(
          mockInvoiceRepository.findDuplicateByNumberAndVendor
        ).toHaveBeenCalledWith('INV-001', 10, 1);
        expect(result.passed).toBe(true);
        expect(result.severity).toBe(ValidationSeverity.CRITICAL);
      });

      it('should detect duplicate when found', async () => {
        const invoice = createMockInvoice();
        const duplicate = {
          id: 2,
          invoiceNumber: 'INV-001',
          vendorId: 10,
          date: new Date('2024-01-10'),
          totalAmount: 1000,
          status: 'APPROVED',
          deletedAt: null,
        };

        mockInvoiceRepository.findDuplicateByNumberAndVendor.mockResolvedValue(
          duplicate
        );

        const result = await detector.checkDuplicate(invoice);

        expect(result.passed).toBe(false);
        expect(result.ruleType).toBe(
          ValidationRuleType.DUPLICATE_INVOICE_NUMBER
        );
        expect(result.severity).toBe(ValidationSeverity.CRITICAL);
        expect(result.details.message).toContain('Duplicate invoice number');
        expect(result.details.message).toContain('INV-001');
        expect(result.details.duplicateInvoiceId).toBe(2);
        expect(result.details.duplicateDate).toEqual(
          new Date('2024-01-10')
        );
        expect(result.details.duplicateAmount).toBe(1000);
        expect(result.details.duplicateStatus).toBe('APPROVED');
      });

      it('should pass when no duplicate found', async () => {
        const invoice = createMockInvoice();
        mockInvoiceRepository.findDuplicateByNumberAndVendor.mockResolvedValue(
          null
        );

        const result = await detector.checkDuplicate(invoice);

        expect(result.passed).toBe(true);
        expect(result.details.reason).toBe('No duplicate found');
      });
    });

    describe('when rule is disabled', () => {
      beforeEach(() => {
        mockConfigService.getRuleConfig.mockResolvedValue({
          enabled: false,
          severity: ValidationSeverity.CRITICAL,
          config: {},
        });

        detector = new DuplicateDetector(
          mockInvoiceRepository as unknown as IInvoiceRepository,
          mockConfigService as unknown as ValidationConfigService
        );
      });

      it('should return passed result without checking repository', async () => {
        const invoice = createMockInvoice();

        const result = await detector.checkDuplicate(invoice);

        expect(mockConfigService.getRuleConfig).toHaveBeenCalledWith(
          ValidationRuleType.DUPLICATE_INVOICE_NUMBER
        );
        expect(
          mockInvoiceRepository.findDuplicateByNumberAndVendor
        ).not.toHaveBeenCalled();
        expect(result.passed).toBe(true);
        expect(result.ruleType).toBe(
          ValidationRuleType.DUPLICATE_INVOICE_NUMBER
        );
        expect(result.severity).toBe(ValidationSeverity.CRITICAL);
        expect(result.details.reason).toBe('Rule disabled via configuration');
      });

      it('should skip repository check for all invoices when disabled', async () => {
        const invoices = [
          createMockInvoice({ id: 1, invoiceNumber: 'INV-001' }),
          createMockInvoice({ id: 2, invoiceNumber: 'INV-002' }),
          createMockInvoice({ id: 3, invoiceNumber: 'INV-003' }),
        ];

        for (const invoice of invoices) {
          const result = await detector.checkDuplicate(invoice);
          expect(result.passed).toBe(true);
          expect(result.details.reason).toBe(
            'Rule disabled via configuration'
          );
        }

        expect(
          mockInvoiceRepository.findDuplicateByNumberAndVendor
        ).not.toHaveBeenCalled();
      });

      it('should use correct severity in passed result', async () => {
        const invoice = createMockInvoice();

        const result = await detector.checkDuplicate(invoice);

        expect(result.severity).toBe(ValidationSeverity.CRITICAL);
        expect(result.passed).toBe(true);
      });
    });

    describe('when rule config changes', () => {
      it('should respect config changes from enabled to disabled', async () => {
        mockConfigService.getRuleConfig
          .mockResolvedValueOnce({
            enabled: true,
            severity: ValidationSeverity.CRITICAL,
            config: {},
          })
          .mockResolvedValueOnce({
            enabled: false,
            severity: ValidationSeverity.CRITICAL,
            config: {},
          });

        detector = new DuplicateDetector(
          mockInvoiceRepository as unknown as IInvoiceRepository,
          mockConfigService as unknown as ValidationConfigService
        );

        const invoice = createMockInvoice();
        mockInvoiceRepository.findDuplicateByNumberAndVendor.mockResolvedValue(
          null
        );

        // First call - enabled
        const result1 = await detector.checkDuplicate(invoice);
        expect(
          mockInvoiceRepository.findDuplicateByNumberAndVendor
        ).toHaveBeenCalledTimes(1);
        expect(result1.passed).toBe(true);

        // Second call - disabled
        const result2 = await detector.checkDuplicate(invoice);
        expect(
          mockInvoiceRepository.findDuplicateByNumberAndVendor
        ).toHaveBeenCalledTimes(1); // Still 1, not called again
        expect(result2.details.reason).toBe(
          'Rule disabled via configuration'
        );
      });
    });
  });

  // ==========================================================================
  // WITHOUT ValidationConfigService - Backward Compatibility Tests
  // ==========================================================================
  describe('without ValidationConfigService', () => {
    beforeEach(() => {
      detector = new DuplicateDetector(
        mockInvoiceRepository as unknown as IInvoiceRepository
      );
    });

    it('should always execute duplicate check when no config service', async () => {
      const invoice = createMockInvoice();
      mockInvoiceRepository.findDuplicateByNumberAndVendor.mockResolvedValue(
        null
      );

      const result = await detector.checkDuplicate(invoice);

      expect(
        mockInvoiceRepository.findDuplicateByNumberAndVendor
      ).toHaveBeenCalledWith('INV-001', 10, 1);
      expect(result.passed).toBe(true);
      expect(result.details.reason).toBe('No duplicate found');
    });

    it('should detect duplicates without config service', async () => {
      const invoice = createMockInvoice();
      const duplicate = {
        id: 99,
        invoiceNumber: 'INV-001',
        vendorId: 10,
        date: new Date('2024-01-05'),
        totalAmount: 1500,
        status: 'APPROVED',
        deletedAt: null,
      };

      mockInvoiceRepository.findDuplicateByNumberAndVendor.mockResolvedValue(
        duplicate
      );

      const result = await detector.checkDuplicate(invoice);

      expect(result.passed).toBe(false);
      expect(result.details.duplicateInvoiceId).toBe(99);
    });

    it('should work with undefined config service', async () => {
      const detectorWithUndefined = new DuplicateDetector(
        mockInvoiceRepository as unknown as IInvoiceRepository,
        undefined
      );

      const invoice = createMockInvoice();
      mockInvoiceRepository.findDuplicateByNumberAndVendor.mockResolvedValue(
        null
      );

      const result = await detectorWithUndefined.checkDuplicate(invoice);

      expect(
        mockInvoiceRepository.findDuplicateByNumberAndVendor
      ).toHaveBeenCalled();
      expect(result.passed).toBe(true);
    });
  });

  // ==========================================================================
  // Duplicate Detection Logic Tests (Core Functionality)
  // ==========================================================================
  describe('duplicate detection logic', () => {
    beforeEach(() => {
      // Use detector without config service for these tests
      detector = new DuplicateDetector(
        mockInvoiceRepository as unknown as IInvoiceRepository
      );
    });

    describe('validation with vendor and invoice number', () => {
      it('should detect duplicate with same vendorId and invoiceNumber', async () => {
        const invoice = createMockInvoice({
          id: 1,
          invoiceNumber: 'INV-123',
          vendorId: 50,
        });

        const duplicate = {
          id: 2,
          invoiceNumber: 'INV-123',
          vendorId: 50,
          date: new Date(),
          totalAmount: 2000,
          status: 'APPROVED',
          deletedAt: null,
        };

        mockInvoiceRepository.findDuplicateByNumberAndVendor.mockResolvedValue(
          duplicate
        );

        const result = await detector.checkDuplicate(invoice);

        expect(result.passed).toBe(false);
        expect(
          mockInvoiceRepository.findDuplicateByNumberAndVendor
        ).toHaveBeenCalledWith('INV-123', 50, 1);
      });

      it('should exclude self (same invoice ID)', async () => {
        const invoice = createMockInvoice({ id: 42 });

        mockInvoiceRepository.findDuplicateByNumberAndVendor.mockResolvedValue(
          null
        );

        await detector.checkDuplicate(invoice);

        expect(
          mockInvoiceRepository.findDuplicateByNumberAndVendor
        ).toHaveBeenCalledWith('INV-001', 10, 42);
      });

      it('should exclude deleted invoices (handled by repository)', async () => {
        const invoice = createMockInvoice();

        // Repository should filter out deleted invoices
        mockInvoiceRepository.findDuplicateByNumberAndVendor.mockResolvedValue(
          null
        );

        const result = await detector.checkDuplicate(invoice);

        expect(result.passed).toBe(true);
        expect(
          mockInvoiceRepository.findDuplicateByNumberAndVendor
        ).toHaveBeenCalled();
      });

      it('should return all duplicate details when found', async () => {
        const invoice = createMockInvoice();
        const duplicate = {
          id: 999,
          invoiceNumber: 'INV-001',
          vendorId: 10,
          date: new Date('2024-12-01'),
          totalAmount: 5000,
          status: 'PAID',
          deletedAt: null,
        };

        mockInvoiceRepository.findDuplicateByNumberAndVendor.mockResolvedValue(
          duplicate
        );

        const result = await detector.checkDuplicate(invoice);

        expect(result.details).toEqual({
          message: "Duplicate invoice number 'INV-001' found for this vendor",
          duplicateInvoiceId: 999,
          duplicateDate: new Date('2024-12-01'),
          duplicateAmount: 5000,
          duplicateStatus: 'PAID',
        });
      });
    });

    describe('null/empty invoice number handling', () => {
      it('should pass when invoice number is null', async () => {
        const invoice = createMockInvoice({ invoiceNumber: null });

        const result = await detector.checkDuplicate(invoice);

        expect(result.passed).toBe(true);
        expect(result.ruleType).toBe(
          ValidationRuleType.DUPLICATE_INVOICE_NUMBER
        );
        expect(result.severity).toBe(ValidationSeverity.CRITICAL);
        expect(result.details.reason).toBe(
          'No invoice number or vendor to check'
        );
        expect(
          mockInvoiceRepository.findDuplicateByNumberAndVendor
        ).not.toHaveBeenCalled();
      });

      it('should pass when invoice number is empty string', async () => {
        const invoice = createMockInvoice({ invoiceNumber: '' });

        const result = await detector.checkDuplicate(invoice);

        expect(result.passed).toBe(true);
        expect(result.details.reason).toBe(
          'No invoice number or vendor to check'
        );
        expect(
          mockInvoiceRepository.findDuplicateByNumberAndVendor
        ).not.toHaveBeenCalled();
      });

      it('should pass when vendorId is null', async () => {
        const invoice = createMockInvoice({ vendorId: null });

        const result = await detector.checkDuplicate(invoice);

        expect(result.passed).toBe(true);
        expect(result.details.reason).toBe(
          'No invoice number or vendor to check'
        );
        expect(
          mockInvoiceRepository.findDuplicateByNumberAndVendor
        ).not.toHaveBeenCalled();
      });

      it('should pass when both invoice number and vendorId are null', async () => {
        const invoice = createMockInvoice({
          invoiceNumber: null,
          vendorId: null,
        });

        const result = await detector.checkDuplicate(invoice);

        expect(result.passed).toBe(true);
        expect(result.details.reason).toBe(
          'No invoice number or vendor to check'
        );
        expect(
          mockInvoiceRepository.findDuplicateByNumberAndVendor
        ).not.toHaveBeenCalled();
      });
    });

    describe('validation result structure', () => {
      it('should return correct ValidationResult structure for passed check', async () => {
        const invoice = createMockInvoice();
        mockInvoiceRepository.findDuplicateByNumberAndVendor.mockResolvedValue(
          null
        );

        const result = await detector.checkDuplicate(invoice);

        expect(result).toMatchObject({
          ruleType: ValidationRuleType.DUPLICATE_INVOICE_NUMBER,
          severity: ValidationSeverity.CRITICAL,
          passed: true,
          details: { reason: 'No duplicate found' },
        });
        expect(result.isPassed()).toBe(true);
        expect(result.isBlocking()).toBe(false);
      });

      it('should return correct ValidationResult structure for failed check', async () => {
        const invoice = createMockInvoice();
        const duplicate = {
          id: 2,
          invoiceNumber: 'INV-001',
          vendorId: 10,
          date: new Date('2024-01-10'),
          totalAmount: 1000,
          status: 'APPROVED',
          deletedAt: null,
        };

        mockInvoiceRepository.findDuplicateByNumberAndVendor.mockResolvedValue(
          duplicate
        );

        const result = await detector.checkDuplicate(invoice);

        expect(result).toMatchObject({
          ruleType: ValidationRuleType.DUPLICATE_INVOICE_NUMBER,
          severity: ValidationSeverity.CRITICAL,
          passed: false,
        });
        expect(result.isPassed()).toBe(false);
        expect(result.isBlocking()).toBe(true); // CRITICAL + failed = blocking
      });
    });

    describe('edge cases', () => {
      it('should handle whitespace-only invoice number', async () => {
        const invoice = createMockInvoice({ invoiceNumber: '   ' });

        const result = await detector.checkDuplicate(invoice);

        // Empty/whitespace treated as valid, should still check
        expect(
          mockInvoiceRepository.findDuplicateByNumberAndVendor
        ).toHaveBeenCalledWith('   ', 10, 1);
      });

      it('should handle special characters in invoice number', async () => {
        const invoice = createMockInvoice({
          invoiceNumber: 'INV-2024/12-001',
        });
        mockInvoiceRepository.findDuplicateByNumberAndVendor.mockResolvedValue(
          null
        );

        const result = await detector.checkDuplicate(invoice);

        expect(
          mockInvoiceRepository.findDuplicateByNumberAndVendor
        ).toHaveBeenCalledWith('INV-2024/12-001', 10, 1);
        expect(result.passed).toBe(true);
      });

      it('should treat vendorId of 0 as invalid (falsy check)', async () => {
        const invoice = createMockInvoice({ vendorId: 0 });

        const result = await detector.checkDuplicate(invoice);

        // vendorId: 0 is treated as falsy, so check is skipped
        expect(
          mockInvoiceRepository.findDuplicateByNumberAndVendor
        ).not.toHaveBeenCalled();
        expect(result.passed).toBe(true);
        expect(result.details.reason).toBe(
          'No invoice number or vendor to check'
        );
      });

      it('should handle very long invoice numbers', async () => {
        const longInvoiceNumber = 'INV-' + '0'.repeat(1000);
        const invoice = createMockInvoice({ invoiceNumber: longInvoiceNumber });
        mockInvoiceRepository.findDuplicateByNumberAndVendor.mockResolvedValue(
          null
        );

        const result = await detector.checkDuplicate(invoice);

        expect(
          mockInvoiceRepository.findDuplicateByNumberAndVendor
        ).toHaveBeenCalledWith(longInvoiceNumber, 10, 1);
        expect(result.passed).toBe(true);
      });
    });

    describe('repository interaction', () => {
      it('should call repository with correct parameters', async () => {
        const invoice = createMockInvoice({
          id: 123,
          invoiceNumber: 'TEST-456',
          vendorId: 789,
        });
        mockInvoiceRepository.findDuplicateByNumberAndVendor.mockResolvedValue(
          null
        );

        await detector.checkDuplicate(invoice);

        expect(
          mockInvoiceRepository.findDuplicateByNumberAndVendor
        ).toHaveBeenCalledTimes(1);
        expect(
          mockInvoiceRepository.findDuplicateByNumberAndVendor
        ).toHaveBeenCalledWith('TEST-456', 789, 123);
      });

      it('should handle repository errors', async () => {
        const invoice = createMockInvoice();
        const repositoryError = new Error('Database connection failed');
        mockInvoiceRepository.findDuplicateByNumberAndVendor.mockRejectedValue(
          repositoryError
        );

        await expect(detector.checkDuplicate(invoice)).rejects.toThrow(
          'Database connection failed'
        );
      });
    });
  });
});
