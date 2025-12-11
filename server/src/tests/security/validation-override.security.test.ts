import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ValidationStatus, ValidationSeverity, ValidationRuleType } from '@prisma/client';
import { getPrismaMock } from '../helpers/prisma-mock';
import {
  createTestUser,
  createTestInvoice,
  createTestVendor,
} from '../helpers/test-factories';
import { overrideValidation } from '../../services/invoiceValidationService';

const prismaMock = getPrismaMock();

describe('Validation Override Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authorization', () => {
    it('should reject override from non-owner regular user', async () => {
      // Arrange: Create User A's invoice with validation
      const userA = createTestUser({ id: 1, role: 'USER', name: 'User A' });
      const userB = createTestUser({ id: 2, role: 'USER', name: 'User B' });
      const vendor = createTestVendor({ id: 1 });
      const invoice = createTestInvoice({
        id: 1,
        userId: userA.id,
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
          userId: userA.id,
          status: 'PENDING'
        }
      };

      prismaMock.invoiceValidation.findUnique.mockResolvedValue(validation as any);
      prismaMock.user.findUnique.mockResolvedValue(userB as any);

      // Act & Assert: User B (non-owner, regular role) attempts override
      await expect(
        overrideValidation(1, userB.id, 'Valid override reason that is long enough')
      ).rejects.toThrow(/Unauthorized.*own invoices.*manager.*admin/i);
    });

    it('should allow override from invoice owner', async () => {
      // Arrange: User A owns the invoice
      const userA = createTestUser({ id: 1, role: 'USER', name: 'User A' });
      const vendor = createTestVendor({ id: 1 });
      const invoice = createTestInvoice({
        id: 1,
        userId: userA.id,
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
          userId: userA.id,
          status: 'PENDING'
        }
      };

      const updatedValidation = {
        ...validation,
        status: ValidationStatus.OVERRIDDEN,
        reviewedAt: new Date(),
        reviewedBy: userA.id
      };

      const override = {
        id: 1,
        validationId: 1,
        userId: userA.id,
        reason: 'Valid override reason that is long enough',
        createdAt: new Date()
      };

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        prismaMock.invoiceValidation.findUnique.mockResolvedValue(validation as any);
        prismaMock.user.findUnique.mockResolvedValue(userA as any);
        prismaMock.invoiceValidation.update.mockResolvedValue(updatedValidation as any);
        prismaMock.validationOverride.create.mockResolvedValue(override as any);
        prismaMock.auditLog.create.mockResolvedValue({} as any);

        return callback(prismaMock);
      });

      // Act: User A overrides their own validation
      const result = await overrideValidation(1, userA.id, 'Valid override reason that is long enough');

      // Assert: Success
      expect(result.validation.status).toBe(ValidationStatus.OVERRIDDEN);
      expect(result.override.userId).toBe(userA.id);
    });

    it('should allow override from manager for any invoice', async () => {
      // Arrange: Manager tries to override User A's invoice
      const userA = createTestUser({ id: 1, role: 'USER', name: 'User A' });
      const manager = createTestUser({ id: 2, role: 'MANAGER', name: 'Manager' });
      const vendor = createTestVendor({ id: 1 });
      const invoice = createTestInvoice({
        id: 1,
        userId: userA.id,
        vendorId: vendor.id,
        status: 'PENDING'
      });

      const validation = {
        id: 1,
        invoiceId: invoice.id,
        ruleType: ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED,
        severity: ValidationSeverity.WARNING,
        status: ValidationStatus.FLAGGED,
        details: { message: 'Amount exceeds threshold' },
        metadata: {},
        createdAt: new Date(),
        reviewedAt: null,
        reviewedBy: null,
        invoice: {
          id: invoice.id,
          userId: userA.id,
          status: 'PENDING'
        }
      };

      const updatedValidation = {
        ...validation,
        status: ValidationStatus.OVERRIDDEN,
        reviewedAt: new Date(),
        reviewedBy: manager.id
      };

      const override = {
        id: 1,
        validationId: 1,
        userId: manager.id,
        reason: 'Manager approved high-value invoice',
        createdAt: new Date()
      };

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        prismaMock.invoiceValidation.findUnique.mockResolvedValue(validation as any);
        prismaMock.user.findUnique.mockResolvedValue(manager as any);
        prismaMock.invoiceValidation.update.mockResolvedValue(updatedValidation as any);
        prismaMock.validationOverride.create.mockResolvedValue(override as any);
        prismaMock.auditLog.create.mockResolvedValue({} as any);

        return callback(prismaMock);
      });

      // Act: Manager overrides validation
      const result = await overrideValidation(1, manager.id, 'Manager approved high-value invoice');

      // Assert: Success
      expect(result.validation.status).toBe(ValidationStatus.OVERRIDDEN);
      expect(result.override.userId).toBe(manager.id);
    });

    it('should allow override from admin for any invoice', async () => {
      // Arrange: Admin tries to override User A's invoice
      const userA = createTestUser({ id: 1, role: 'USER', name: 'User A' });
      const admin = createTestUser({ id: 2, role: 'ADMIN', name: 'Admin' });
      const vendor = createTestVendor({ id: 1 });
      const invoice = createTestInvoice({
        id: 1,
        userId: userA.id,
        vendorId: vendor.id,
        status: 'PENDING'
      });

      const validation = {
        id: 1,
        invoiceId: invoice.id,
        ruleType: ValidationRuleType.DUPLICATE_INVOICE_NUMBER,
        severity: ValidationSeverity.CRITICAL,
        status: ValidationStatus.FLAGGED,
        details: { message: 'Duplicate invoice detected' },
        metadata: {},
        createdAt: new Date(),
        reviewedAt: null,
        reviewedBy: null,
        invoice: {
          id: invoice.id,
          userId: userA.id,
          status: 'PENDING'
        }
      };

      const updatedValidation = {
        ...validation,
        status: ValidationStatus.OVERRIDDEN,
        reviewedAt: new Date(),
        reviewedBy: admin.id
      };

      const override = {
        id: 1,
        validationId: 1,
        userId: admin.id,
        reason: 'Admin verified this is not a duplicate - different line items',
        createdAt: new Date()
      };

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        prismaMock.invoiceValidation.findUnique.mockResolvedValue(validation as any);
        prismaMock.user.findUnique.mockResolvedValue(admin as any);
        prismaMock.invoiceValidation.update.mockResolvedValue(updatedValidation as any);
        prismaMock.validationOverride.create.mockResolvedValue(override as any);
        prismaMock.auditLog.create.mockResolvedValue({} as any);

        return callback(prismaMock);
      });

      // Act: Admin overrides validation
      const result = await overrideValidation(1, admin.id, 'Admin verified this is not a duplicate - different line items');

      // Assert: Success
      expect(result.validation.status).toBe(ValidationStatus.OVERRIDDEN);
      expect(result.override.userId).toBe(admin.id);
    });
  });

  describe('Business Rules', () => {
    it('should reject override of already-overridden validation', async () => {
      // Arrange: Validation already overridden
      const user = createTestUser({ id: 1, role: 'USER', name: 'User A' });
      const vendor = createTestVendor({ id: 1 });
      const invoice = createTestInvoice({
        id: 1,
        userId: user.id,
        vendorId: vendor.id,
        status: 'PENDING'
      });

      const validation = {
        id: 1,
        invoiceId: invoice.id,
        ruleType: ValidationRuleType.MISSING_INVOICE_NUMBER,
        severity: ValidationSeverity.WARNING,
        status: ValidationStatus.OVERRIDDEN, // Already overridden
        details: { message: 'Missing invoice number' },
        metadata: {},
        createdAt: new Date(),
        reviewedAt: new Date(),
        reviewedBy: user.id,
        invoice: {
          id: invoice.id,
          userId: user.id,
          status: 'PENDING'
        }
      };

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        prismaMock.invoiceValidation.findUnique.mockResolvedValue(validation as any);
        prismaMock.user.findUnique.mockResolvedValue(user as any);

        return callback(prismaMock);
      });

      // Act & Assert: Attempt second override
      await expect(
        overrideValidation(1, user.id, 'Trying to override again')
      ).rejects.toThrow(/already overridden/i);
    });

    it('should reject override of approved invoice validation', async () => {
      // Arrange: Invoice already approved
      const user = createTestUser({ id: 1, role: 'USER', name: 'User A' });
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

      // Act & Assert: Attempt override on approved invoice
      await expect(
        overrideValidation(1, user.id, 'Trying to override approved invoice')
      ).rejects.toThrow(/Cannot override.*approved.*paid/i);
    });

    it('should reject override of paid invoice validation', async () => {
      // Arrange: Invoice already paid
      const user = createTestUser({ id: 1, role: 'USER', name: 'User A' });
      const vendor = createTestVendor({ id: 1 });
      const invoice = createTestInvoice({
        id: 1,
        userId: user.id,
        vendorId: vendor.id,
        status: 'PAID' // Already paid
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
          status: 'PAID'
        }
      };

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        prismaMock.invoiceValidation.findUnique.mockResolvedValue(validation as any);
        prismaMock.user.findUnique.mockResolvedValue(user as any);

        return callback(prismaMock);
      });

      // Act & Assert: Attempt override on paid invoice
      await expect(
        overrideValidation(1, user.id, 'Trying to override paid invoice')
      ).rejects.toThrow(/Cannot override.*approved.*paid/i);
    });

    it('should reject override with insufficient reason length', async () => {
      // Arrange
      const user = createTestUser({ id: 1, role: 'USER', name: 'User A' });

      // Act & Assert: Reason too short
      await expect(
        overrideValidation(1, user.id, 'Short')
      ).rejects.toThrow(/reason must be at least 10 characters/i);
    });

    it('should reject override when validation not found', async () => {
      // Arrange
      const user = createTestUser({ id: 1, role: 'USER', name: 'User A' });

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        prismaMock.invoiceValidation.findUnique.mockResolvedValue(null);

        return callback(prismaMock);
      });

      // Act & Assert
      await expect(
        overrideValidation(999, user.id, 'Valid reason but validation not found')
      ).rejects.toThrow(/Validation not found/i);
    });

    it('should reject override when user not found', async () => {
      // Arrange
      const vendor = createTestVendor({ id: 1 });
      const invoice = createTestInvoice({
        id: 1,
        userId: 1,
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
          userId: 1,
          status: 'PENDING'
        }
      };

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        prismaMock.invoiceValidation.findUnique.mockResolvedValue(validation as any);
        prismaMock.user.findUnique.mockResolvedValue(null);

        return callback(prismaMock);
      });

      // Act & Assert
      await expect(
        overrideValidation(1, 999, 'Valid reason but user not found')
      ).rejects.toThrow(/User not found/i);
    });
  });

  describe('Audit Trail', () => {
    it('should create complete audit log entry with all required fields', async () => {
      // Arrange
      const user = createTestUser({ id: 1, role: 'USER', name: 'John Doe' });
      const vendor = createTestVendor({ id: 1 });
      const invoice = createTestInvoice({
        id: 1,
        userId: user.id,
        vendorId: vendor.id,
        status: 'PENDING'
      });

      const validation = {
        id: 1,
        invoiceId: invoice.id,
        ruleType: ValidationRuleType.ROUND_AMOUNT_PATTERN,
        severity: ValidationSeverity.WARNING,
        status: ValidationStatus.FLAGGED,
        details: { message: 'Round amount detected' },
        metadata: {},
        createdAt: new Date(),
        reviewedAt: null,
        reviewedBy: null,
        invoice: {
          id: invoice.id,
          userId: user.id,
          status: 'PENDING'
        }
      };

      const updatedValidation = {
        ...validation,
        status: ValidationStatus.OVERRIDDEN,
        reviewedAt: new Date(),
        reviewedBy: user.id
      };

      const override = {
        id: 1,
        validationId: 1,
        userId: user.id,
        reason: 'This is a legitimate round amount purchase',
        createdAt: new Date()
      };

      let auditLogData: any = null;

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        prismaMock.invoiceValidation.findUnique.mockResolvedValue(validation as any);
        prismaMock.user.findUnique.mockResolvedValue(user as any);
        prismaMock.invoiceValidation.update.mockResolvedValue(updatedValidation as any);
        prismaMock.validationOverride.create.mockResolvedValue(override as any);
        prismaMock.auditLog.create.mockImplementation((data: any) => {
          auditLogData = data;
          return Promise.resolve({} as any);
        });

        return callback(prismaMock);
      });

      // Act
      await overrideValidation(1, user.id, 'This is a legitimate round amount purchase');

      // Assert: Verify audit log was created with all required fields
      expect(auditLogData).toBeTruthy();
      expect(auditLogData.data.userId).toBe(user.id);
      expect(auditLogData.data.action).toBe('VALIDATION_OVERRIDDEN');
      expect(auditLogData.data.entity).toBe('InvoiceValidation');
      expect(auditLogData.data.entityId).toBe(1);

      // Parse and verify changes JSON
      const changes = JSON.parse(auditLogData.data.changes);
      expect(changes.reason).toBe('This is a legitimate round amount purchase');
      expect(changes.validationId).toBe(1);
      expect(changes.invoiceId).toBe(invoice.id);
      expect(changes.ruleType).toBe(ValidationRuleType.ROUND_AMOUNT_PATTERN);
      expect(changes.severity).toBe(ValidationSeverity.WARNING);
      expect(changes.isOwner).toBe(true);
      expect(changes.userRole).toBe('USER');
      expect(changes.userName).toBe('John Doe');
    });

    it('should record isOwner as false when manager overrides', async () => {
      // Arrange
      const userA = createTestUser({ id: 1, role: 'USER', name: 'User A' });
      const manager = createTestUser({ id: 2, role: 'MANAGER', name: 'Manager' });
      const vendor = createTestVendor({ id: 1 });
      const invoice = createTestInvoice({
        id: 1,
        userId: userA.id,
        vendorId: vendor.id,
        status: 'PENDING'
      });

      const validation = {
        id: 1,
        invoiceId: invoice.id,
        ruleType: ValidationRuleType.AMOUNT_THRESHOLD_EXCEEDED,
        severity: ValidationSeverity.WARNING,
        status: ValidationStatus.FLAGGED,
        details: { message: 'Amount exceeds threshold' },
        metadata: {},
        createdAt: new Date(),
        reviewedAt: null,
        reviewedBy: null,
        invoice: {
          id: invoice.id,
          userId: userA.id,
          status: 'PENDING'
        }
      };

      const updatedValidation = {
        ...validation,
        status: ValidationStatus.OVERRIDDEN,
        reviewedAt: new Date(),
        reviewedBy: manager.id
      };

      const override = {
        id: 1,
        validationId: 1,
        userId: manager.id,
        reason: 'Manager approved this expense',
        createdAt: new Date()
      };

      let auditLogData: any = null;

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        prismaMock.invoiceValidation.findUnique.mockResolvedValue(validation as any);
        prismaMock.user.findUnique.mockResolvedValue(manager as any);
        prismaMock.invoiceValidation.update.mockResolvedValue(updatedValidation as any);
        prismaMock.validationOverride.create.mockResolvedValue(override as any);
        prismaMock.auditLog.create.mockImplementation((data: any) => {
          auditLogData = data;
          return Promise.resolve({} as any);
        });

        return callback(prismaMock);
      });

      // Act
      await overrideValidation(1, manager.id, 'Manager approved this expense');

      // Assert: Verify isOwner is false
      const changes = JSON.parse(auditLogData.data.changes);
      expect(changes.isOwner).toBe(false);
      expect(changes.userRole).toBe('MANAGER');
      expect(changes.userName).toBe('Manager');
    });
  });
});
