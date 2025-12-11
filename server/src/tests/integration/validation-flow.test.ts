import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ValidationStatus, ValidationSeverity, ValidationRuleType } from '@prisma/client';
import { getPrismaMock } from '../helpers/prisma-mock';
import {
  createTestUser,
  createTestInvoice,
  createTestVendor,
  createTestItem,
} from '../helpers/test-factories';

// Import services
import {
  validateInvoice,
  getValidationSummary,
  overrideValidation,
  reviewValidation
} from '../../services/invoiceValidationService';

const prismaMock = getPrismaMock();

describe('Invoice Validation Flow Integration Tests', () => {
  // All validation rules that must be present for ValidationConfigService
  const allValidationRules = [
    {
      id: 1,
      ruleType: ValidationRuleType.DUPLICATE_INVOICE_NUMBER,
      severity: ValidationSeverity.CRITICAL,
      enabled: true,
      config: {},
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 2,
      ruleType: ValidationRuleType.MISSING_INVOICE_NUMBER,
      severity: ValidationSeverity.WARNING,
      enabled: true,
      config: {},
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 3,
      ruleType: ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED,
      severity: ValidationSeverity.WARNING,
      enabled: true,
      config: { threshold: 10000 },
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 4,
      ruleType: ValidationRuleType.ROUND_AMOUNT_PATTERN,
      severity: ValidationSeverity.INFO,
      enabled: true,
      config: { minimumAmount: 1000 },
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 5,
      ruleType: ValidationRuleType.PRICE_VARIANCE,
      severity: ValidationSeverity.INFO,
      enabled: true,
      config: { variancePercent: 15, historicalCount: 5 },
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 6,
      ruleType: ValidationRuleType.PO_AMOUNT_VARIANCE,
      severity: ValidationSeverity.WARNING,
      enabled: true,
      config: { variancePercent: 10 },
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 7,
      ruleType: ValidationRuleType.PO_ITEM_MISMATCH,
      severity: ValidationSeverity.WARNING,
      enabled: true,
      config: {},
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 8,
      ruleType: ValidationRuleType.DELIVERY_NOTE_MISMATCH,
      severity: ValidationSeverity.WARNING,
      enabled: true,
      config: {},
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock all validation rules for ValidationConfigService
    // This must be set before any test that calls validateInvoice()
    prismaMock.validationRule.findMany.mockResolvedValue(allValidationRules as any);
  });

  describe('Complete Validation Lifecycle', () => {
    it('should execute full validation flow: create -> validate -> override -> review', async () => {
      // ========== SETUP ==========
      const user = createTestUser({ id: 1, role: 'USER', name: 'John Doe' });
      const vendor = createTestVendor({ id: 1, name: 'ACME Corp' });
      const item1 = createTestItem({ id: 1, name: 'Widget A', price: 100 });
      const item2 = createTestItem({ id: 2, name: 'Widget B', price: 200 });

      const invoice = createTestInvoice({
        id: 1,
        userId: user.id,
        vendorId: vendor.id,
        invoiceNumber: '', // Missing invoice number - should trigger validation
        totalAmount: 15000, // Exceeds threshold - should trigger validation
        status: 'PENDING'
      });

      const invoiceWithRelations = {
        ...invoice,
        items: [
          {
            id: 1,
            invoiceId: invoice.id,
            itemId: item1.id,
            quantity: 50,
            price: 100,
            item: item1
          },
          {
            id: 2,
            invoiceId: invoice.id,
            itemId: item2.id,
            quantity: 50,
            price: 200,
            item: item2
          }
        ],
        purchaseOrder: null,
        deliveryNotes: [],
        vendor
      };

      // ========== STEP 1: VALIDATE INVOICE ==========
      // Mock repository calls for validation
      // validationRule.findMany is already mocked in beforeEach with all rules
      // Mock the findFirst used by PrismaInvoiceRepository.findById
      prismaMock.invoice.findFirst.mockImplementation((args: any) => {
        // If looking for invoice by ID (findById)
        if (args.where?.id === invoice.id) {
          return Promise.resolve(invoiceWithRelations as any);
        }
        // If looking for duplicates (by invoiceNumber and vendorId)
        if (args.where?.invoiceNumber && args.where?.vendorId) {
          return Promise.resolve(null); // No duplicates
        }
        return Promise.resolve(null);
      });

      const createdValidations = [
        {
          id: 1,
          invoiceId: invoice.id,
          ruleType: ValidationRuleType.MISSING_INVOICE_NUMBER,
          severity: ValidationSeverity.WARNING,
          status: ValidationStatus.FLAGGED,
          details: { message: 'Invoice number is missing' },
          metadata: {},
          createdAt: new Date(),
          reviewedAt: null,
          reviewedBy: null
        },
        {
          id: 2,
          invoiceId: invoice.id,
          ruleType: ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED,
          severity: ValidationSeverity.WARNING,
          status: ValidationStatus.FLAGGED,
          details: {
            message: 'Invoice amount 15000.00 exceeds threshold 10000.00',
            amount: 15000,
            threshold: 10000,
            excess: 5000
          },
          metadata: {},
          createdAt: new Date(),
          reviewedAt: null,
          reviewedBy: null
        }
      ];

      prismaMock.invoiceValidation.createMany.mockResolvedValue({ count: 2 });
      prismaMock.invoiceValidation.findMany.mockResolvedValue(createdValidations as any);

      // Act: Validate invoice
      const validationSummary = await validateInvoice(invoice.id);

      // Assert: Validations created
      expect(validationSummary.invoiceId).toBe(invoice.id);
      expect(validationSummary.isValid).toBe(false);
      expect(validationSummary.flagCount).toBeGreaterThan(0);

      // ========== STEP 2: GET VALIDATION SUMMARY ==========
      prismaMock.invoiceValidation.findMany.mockResolvedValue(createdValidations as any);

      // Act: Fetch validation summary
      const summary = await getValidationSummary(invoice.id);

      // Assert: Summary contains all validations
      expect(summary.invoiceId).toBe(invoice.id);
      expect(summary.flagCount).toBe(2);
      expect(summary.validations).toHaveLength(2);

      // ========== STEP 3: OVERRIDE ONE VALIDATION ==========
      const validationToOverride = createdValidations[0]; // Missing invoice number
      const overrideReason = 'Vendor confirmed invoice number will be added on final copy';

      const overriddenValidation = {
        ...validationToOverride,
        status: ValidationStatus.OVERRIDDEN,
        reviewedAt: new Date(),
        reviewedBy: user.id
      };

      const override = {
        id: 1,
        validationId: validationToOverride.id,
        userId: user.id,
        reason: overrideReason,
        createdAt: new Date()
      };

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        prismaMock.invoiceValidation.findUnique.mockResolvedValue({
          ...validationToOverride,
          invoice: {
            id: invoice.id,
            userId: user.id,
            status: 'PENDING'
          }
        } as any);
        prismaMock.user.findUnique.mockResolvedValue(user as any);
        prismaMock.invoiceValidation.update.mockResolvedValue(overriddenValidation as any);
        prismaMock.validationOverride.create.mockResolvedValue(override as any);
        prismaMock.auditLog.create.mockResolvedValue({} as any);

        return callback(prismaMock);
      });

      // Act: Override validation
      const overrideResult = await overrideValidation(
        validationToOverride.id,
        user.id,
        overrideReason
      );

      // Assert: Validation overridden
      expect(overrideResult.validation.status).toBe(ValidationStatus.OVERRIDDEN);
      expect(overrideResult.override.reason).toBe(overrideReason);
      expect(overrideResult.override.userId).toBe(user.id);

      // ========== STEP 4: REVIEW ANOTHER VALIDATION ==========
      const validationToReview = createdValidations[1]; // Amount threshold
      const reviewedValidation = {
        ...validationToReview,
        status: ValidationStatus.DISMISSED,
        reviewedAt: new Date(),
        reviewedBy: user.id
      };

      prismaMock.invoiceValidation.update.mockResolvedValue(reviewedValidation as any);
      prismaMock.auditLog.create.mockResolvedValue({} as any);

      // Act: Review (dismiss) validation
      const reviewResult = await reviewValidation(
        validationToReview.id,
        user.id,
        'DISMISS'
      );

      // Assert: Validation dismissed
      expect(reviewResult.status).toBe(ValidationStatus.DISMISSED);
      expect(reviewResult.reviewedBy).toBe(user.id);

      // ========== STEP 5: VERIFY FINAL STATE ==========
      const finalValidations = [
        overriddenValidation,
        reviewedValidation
      ];

      prismaMock.invoiceValidation.findMany.mockResolvedValue(finalValidations as any);

      // Act: Get final summary
      const finalSummary = await getValidationSummary(invoice.id);

      // Assert: Both validations have been addressed
      expect(finalSummary.validations).toHaveLength(2);
      expect(finalSummary.validations.every(v =>
        v.status === ValidationStatus.OVERRIDDEN || v.status === ValidationStatus.DISMISSED
      )).toBe(true);
    });

    it('should handle invoice with no validation issues', async () => {
      // ========== SETUP ==========
      const user = createTestUser({ id: 1, role: 'USER' });
      const vendor = createTestVendor({ id: 1 });
      const item = createTestItem({ id: 1, price: 100 });

      const invoice = createTestInvoice({
        id: 1,
        userId: user.id,
        vendorId: vendor.id,
        invoiceNumber: 'INV-2024-001', // Has invoice number
        totalAmount: 5250, // Within threshold and NOT round (avoids ROUND_AMOUNT_PATTERN)
        status: 'PENDING'
      });

      const invoiceWithRelations = {
        ...invoice,
        items: [
          {
            id: 1,
            invoiceId: invoice.id,
            itemId: item.id,
            quantity: 50,
            price: 100,
            item
          }
        ],
        purchaseOrder: null,
        deliveryNotes: [],
        vendor
      };

      // Mock repository calls
      // validationRule.findMany is already mocked in beforeEach with all rules
      prismaMock.invoice.findFirst.mockImplementation((args: any) => {
        if (args.where?.id === invoice.id) {
          return Promise.resolve(invoiceWithRelations as any);
        }
        return Promise.resolve(null); // No duplicates
      });
      prismaMock.invoiceValidation.createMany.mockResolvedValue({ count: 0 });
      prismaMock.invoiceValidation.findMany.mockResolvedValue([]);

      // Act: Validate invoice
      const summary = await validateInvoice(invoice.id);

      // Assert: No issues found
      expect(summary.invoiceId).toBe(invoice.id);
      expect(summary.isValid).toBe(true);
      expect(summary.flagCount).toBe(0);
      expect(summary.hasBlockingIssues).toBe(false);
    });

    it('should detect blocking issues for critical validations', async () => {
      // ========== SETUP ==========
      const user = createTestUser({ id: 1, role: 'USER' });
      const vendor = createTestVendor({ id: 1 });
      const item = createTestItem({ id: 1, price: 100 });

      const invoice = createTestInvoice({
        id: 1,
        userId: user.id,
        vendorId: vendor.id,
        invoiceNumber: 'DUP-001', // Duplicate invoice
        totalAmount: 1250, // NOT round to avoid ROUND_AMOUNT_PATTERN triggering
        status: 'PENDING'
      });

      const invoiceWithRelations = {
        ...invoice,
        items: [
          {
            id: 1,
            invoiceId: invoice.id,
            itemId: item.id,
            quantity: 10,
            price: 100,
            item
          }
        ],
        purchaseOrder: null,
        deliveryNotes: [],
        vendor
      };

      const duplicateInvoice = {
        id: 2,
        invoiceNumber: 'DUP-001',
        vendorId: vendor.id,
        date: new Date('2024-01-15'),
        totalAmount: 1250,
        status: 'APPROVED'
      };

      const createdValidations = [
        {
          id: 1,
          invoiceId: invoice.id,
          ruleType: ValidationRuleType.DUPLICATE_INVOICE_NUMBER,
          severity: ValidationSeverity.CRITICAL,
          status: ValidationStatus.FLAGGED,
          details: {
            message: 'Duplicate invoice number DUP-001 found for this vendor',
            duplicateInvoiceId: duplicateInvoice.id
          },
          metadata: {},
          createdAt: new Date(),
          reviewedAt: null,
          reviewedBy: null
        }
      ];

      // Mock repository calls
      // validationRule.findMany is already mocked in beforeEach with all rules
      prismaMock.invoice.findFirst.mockImplementation((args: any) => {
        if (args.where?.id === invoice.id) {
          return Promise.resolve(invoiceWithRelations as any);
        }
        if (args.where?.invoiceNumber && args.where?.vendorId) {
          return Promise.resolve(duplicateInvoice as any);
        }
        return Promise.resolve(null);
      });
      prismaMock.invoiceValidation.createMany.mockResolvedValue({ count: 1 });
      prismaMock.invoiceValidation.findMany.mockResolvedValue(createdValidations as any);

      // Act: Validate invoice
      const summary = await validateInvoice(invoice.id);

      // Assert: Has blocking issues
      expect(summary.invoiceId).toBe(invoice.id);
      expect(summary.isValid).toBe(false);
      expect(summary.hasBlockingIssues).toBe(true);
      expect(summary.flagCount).toBe(1);
      expect(summary.highestSeverity).toBe(ValidationSeverity.CRITICAL);
    });

    it('should enforce role-based access control in override flow', async () => {
      // ========== SETUP ==========
      const ownerUser = createTestUser({ id: 1, role: 'USER', name: 'Invoice Owner' });
      const otherUser = createTestUser({ id: 2, role: 'USER', name: 'Other User' });
      const manager = createTestUser({ id: 3, role: 'MANAGER', name: 'Manager' });

      const vendor = createTestVendor({ id: 1 });
      const invoice = createTestInvoice({
        id: 1,
        userId: ownerUser.id,
        vendorId: vendor.id,
        status: 'PENDING'
      });

      const validation = {
        id: 1,
        invoiceId: invoice.id,
        ruleType: ValidationRuleType.MISSING_INVOICE_NUMBER,
        severity: ValidationSeverity.WARNING,
        status: ValidationStatus.FLAGGED,
        details: { message: 'Missing invoice number' },
        metadata: {},
        createdAt: new Date(),
        reviewedAt: null,
        reviewedBy: null,
        invoice: {
          id: invoice.id,
          userId: ownerUser.id,
          status: 'PENDING'
        }
      };

      // ========== TEST 1: Other user cannot override ==========
      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        prismaMock.invoiceValidation.findUnique.mockResolvedValue(validation as any);
        prismaMock.user.findUnique.mockResolvedValue(otherUser as any);
        return callback(prismaMock);
      });

      await expect(
        overrideValidation(1, otherUser.id, 'Trying to override')
      ).rejects.toThrow(/Unauthorized/);

      // ========== TEST 2: Owner can override ==========
      const overriddenByOwner = {
        ...validation,
        status: ValidationStatus.OVERRIDDEN,
        reviewedAt: new Date(),
        reviewedBy: ownerUser.id
      };

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        prismaMock.invoiceValidation.findUnique.mockResolvedValue(validation as any);
        prismaMock.user.findUnique.mockResolvedValue(ownerUser as any);
        prismaMock.invoiceValidation.update.mockResolvedValue(overriddenByOwner as any);
        prismaMock.validationOverride.create.mockResolvedValue({
          id: 1,
          validationId: 1,
          userId: ownerUser.id,
          reason: 'Owner override',
          createdAt: new Date()
        } as any);
        prismaMock.auditLog.create.mockResolvedValue({} as any);
        return callback(prismaMock);
      });

      const ownerResult = await overrideValidation(1, ownerUser.id, 'Owner override');
      expect(ownerResult.validation.status).toBe(ValidationStatus.OVERRIDDEN);

      // ========== TEST 3: Manager can override any invoice ==========
      const freshValidation = { ...validation, status: ValidationStatus.FLAGGED };
      const overriddenByManager = {
        ...freshValidation,
        status: ValidationStatus.OVERRIDDEN,
        reviewedAt: new Date(),
        reviewedBy: manager.id
      };

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        prismaMock.invoiceValidation.findUnique.mockResolvedValue(freshValidation as any);
        prismaMock.user.findUnique.mockResolvedValue(manager as any);
        prismaMock.invoiceValidation.update.mockResolvedValue(overriddenByManager as any);
        prismaMock.validationOverride.create.mockResolvedValue({
          id: 2,
          validationId: 1,
          userId: manager.id,
          reason: 'Manager override',
          createdAt: new Date()
        } as any);
        prismaMock.auditLog.create.mockResolvedValue({} as any);
        return callback(prismaMock);
      });

      const managerResult = await overrideValidation(1, manager.id, 'Manager override');
      expect(managerResult.validation.status).toBe(ValidationStatus.OVERRIDDEN);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle validation of invoice with purchase order', async () => {
      // Setup invoice with linked PO
      const user = createTestUser({ id: 1, role: 'USER' });
      const vendor = createTestVendor({ id: 1 });
      const item1 = createTestItem({ id: 1, price: 100 });

      const purchaseOrder = {
        id: 1,
        vendorId: vendor.id,
        date: new Date(),
        status: 'APPROVED',
        deletedAt: null,
        items: [
          { id: 1, purchaseOrderId: 1, itemId: 1, quantity: 10, price: 100 }
        ]
      };

      const invoice = createTestInvoice({
        id: 1,
        userId: user.id,
        vendorId: vendor.id,
        invoiceNumber: 'INV-001',
        totalAmount: 1500, // 50% more than PO (should trigger variance)
        purchaseOrderId: purchaseOrder.id,
        status: 'PENDING'
      });

      const invoiceWithRelations = {
        ...invoice,
        items: [
          {
            id: 1,
            invoiceId: invoice.id,
            itemId: item1.id,
            quantity: 15, // More than PO quantity
            price: 100,
            item: item1
          }
        ],
        purchaseOrder,
        deliveryNotes: [],
        vendor
      };

      const createdValidations = [
        {
          id: 1,
          invoiceId: invoice.id,
          ruleType: ValidationRuleType.PO_AMOUNT_VARIANCE,
          severity: ValidationSeverity.WARNING,
          status: ValidationStatus.FLAGGED,
          details: {
            message: 'Invoice amount varies 50.00% from purchase order',
            invoiceAmount: 1500,
            poAmount: 1000,
            variancePercent: 50
          },
          metadata: {},
          createdAt: new Date(),
          reviewedAt: null,
          reviewedBy: null
        }
      ];

      // Mock repository calls
      // validationRule.findMany is already mocked in beforeEach with all rules
      prismaMock.invoice.findFirst.mockImplementation((args: any) => {
        if (args.where?.id === invoice.id) {
          return Promise.resolve(invoiceWithRelations as any);
        }
        return Promise.resolve(null);
      });
      prismaMock.invoiceValidation.createMany.mockResolvedValue({ count: 1 });
      prismaMock.invoiceValidation.findMany.mockResolvedValue(createdValidations as any);

      // Act
      const summary = await validateInvoice(invoice.id);

      // Assert
      expect(summary.flagCount).toBeGreaterThan(0);
      expect(summary.validations.some(v => v.ruleType === ValidationRuleType.PO_AMOUNT_VARIANCE)).toBe(true);
    });

    it('should prevent override of approved invoice validation', async () => {
      const user = createTestUser({ id: 1, role: 'USER' });
      const vendor = createTestVendor({ id: 1 });
      const invoice = createTestInvoice({
        id: 1,
        userId: user.id,
        vendorId: vendor.id,
        status: 'APPROVED' // Already approved
      });

      const validation = {
        id: 1,
        invoiceId: invoice.id,
        ruleType: ValidationRuleType.MISSING_INVOICE_NUMBER,
        severity: ValidationSeverity.WARNING,
        status: ValidationStatus.FLAGGED,
        details: { message: 'Missing invoice number' },
        metadata: {},
        createdAt: new Date(),
        reviewedAt: null,
        reviewedBy: null,
        invoice: {
          id: invoice.id,
          userId: user.id,
          status: 'APPROVED'
        }
      };

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        prismaMock.invoiceValidation.findUnique.mockResolvedValue(validation as any);
        prismaMock.user.findUnique.mockResolvedValue(user as any);
        return callback(prismaMock);
      });

      await expect(
        overrideValidation(1, user.id, 'Trying to override approved invoice')
      ).rejects.toThrow(/Cannot override.*approved.*paid/);
    });
  });
});
