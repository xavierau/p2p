import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getPrismaMock } from '../helpers/prisma-mock';
import {
  createTestVendor,
  createTestItem,
  createTestInvoice,
  createTestPurchaseOrder,
  createTestUser,
  createTestBranch,
  createTestDepartment,
  createTestCostCenter,
} from '../helpers/test-factories';

// Get the mocked prisma instance
const prismaMock = getPrismaMock();

// Import services after mocking
import {
  validateVendorExists,
  validateItemExists,
  validateItemsExist,
  validateBranchExists,
  validateDepartmentExists,
  validateCostCenterExists,
  validatePurchaseOrderExists,
  validateInvoiceExists,
  validateUserExists,
  EntityNotFoundError,
  EntitiesNotFoundError,
} from '../../services/validationService';

describe('validationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // validateVendorExists
  // ==========================================================================
  describe('validateVendorExists', () => {
    it('should not throw when vendor exists', async () => {
      // Arrange
      const vendor = createTestVendor({ id: 1 });
      prismaMock.vendor.findFirst.mockResolvedValue(vendor as any);

      // Act & Assert
      await expect(validateVendorExists(1)).resolves.toBeUndefined();
    });

    it('should throw EntityNotFoundError when vendor does not exist', async () => {
      // Arrange
      prismaMock.vendor.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(validateVendorExists(999)).rejects.toThrow(EntityNotFoundError);
    });

    it('should throw EntityNotFoundError with correct entity and id', async () => {
      // Arrange
      prismaMock.vendor.findFirst.mockResolvedValue(null);

      // Act & Assert
      try {
        await validateVendorExists(42);
        expect.fail('Should have thrown EntityNotFoundError');
      } catch (error) {
        expect(error).toBeInstanceOf(EntityNotFoundError);
        expect((error as EntityNotFoundError).entity).toBe('Vendor');
        expect((error as EntityNotFoundError).entityId).toBe(42);
        expect((error as EntityNotFoundError).message).toBe('Vendor with id 42 not found');
      }
    });

    it('should check for non-deleted vendors only', async () => {
      // Arrange
      prismaMock.vendor.findFirst.mockResolvedValue(null);

      // Act
      try {
        await validateVendorExists(1);
      } catch {
        // Expected to throw
      }

      // Assert
      expect(prismaMock.vendor.findFirst).toHaveBeenCalledWith({
        where: { id: 1, deletedAt: null },
      });
    });
  });

  // ==========================================================================
  // validateItemExists
  // ==========================================================================
  describe('validateItemExists', () => {
    it('should not throw when item exists', async () => {
      // Arrange
      const item = createTestItem({ id: 1 });
      prismaMock.item.findFirst.mockResolvedValue(item as any);

      // Act & Assert
      await expect(validateItemExists(1)).resolves.toBeUndefined();
    });

    it('should throw EntityNotFoundError when item does not exist', async () => {
      // Arrange
      prismaMock.item.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(validateItemExists(999)).rejects.toThrow(EntityNotFoundError);
    });

    it('should throw EntityNotFoundError with correct entity and id', async () => {
      // Arrange
      prismaMock.item.findFirst.mockResolvedValue(null);

      // Act & Assert
      try {
        await validateItemExists(15);
        expect.fail('Should have thrown EntityNotFoundError');
      } catch (error) {
        expect(error).toBeInstanceOf(EntityNotFoundError);
        expect((error as EntityNotFoundError).entity).toBe('Item');
        expect((error as EntityNotFoundError).entityId).toBe(15);
      }
    });

    it('should check for non-deleted items only', async () => {
      // Arrange
      prismaMock.item.findFirst.mockResolvedValue(null);

      // Act
      try {
        await validateItemExists(1);
      } catch {
        // Expected to throw
      }

      // Assert
      expect(prismaMock.item.findFirst).toHaveBeenCalledWith({
        where: { id: 1, deletedAt: null },
      });
    });
  });

  // ==========================================================================
  // validateItemsExist
  // ==========================================================================
  describe('validateItemsExist', () => {
    it('should not throw when all items exist', async () => {
      // Arrange
      const items = [
        { id: 1 },
        { id: 2 },
        { id: 3 },
      ];
      prismaMock.item.findMany.mockResolvedValue(items as any);

      // Act & Assert
      await expect(validateItemsExist([1, 2, 3])).resolves.toBeUndefined();
    });

    it('should throw EntitiesNotFoundError when some items do not exist', async () => {
      // Arrange
      const items = [{ id: 1 }]; // Only item 1 exists
      prismaMock.item.findMany.mockResolvedValue(items as any);

      // Act & Assert
      await expect(validateItemsExist([1, 2, 3])).rejects.toThrow(EntitiesNotFoundError);
    });

    it('should throw EntitiesNotFoundError with missing item ids', async () => {
      // Arrange
      const items = [{ id: 1 }, { id: 3 }]; // Items 2 and 4 are missing
      prismaMock.item.findMany.mockResolvedValue(items as any);

      // Act & Assert
      try {
        await validateItemsExist([1, 2, 3, 4]);
        expect.fail('Should have thrown EntitiesNotFoundError');
      } catch (error) {
        expect(error).toBeInstanceOf(EntitiesNotFoundError);
        expect((error as EntitiesNotFoundError).entity).toBe('Item');
        expect((error as EntitiesNotFoundError).entityIds).toEqual([2, 4]);
        expect((error as EntitiesNotFoundError).message).toBe(
          'Item(s) with ids [2, 4] not found'
        );
      }
    });

    it('should throw EntitiesNotFoundError when no items exist', async () => {
      // Arrange
      prismaMock.item.findMany.mockResolvedValue([]);

      // Act & Assert
      try {
        await validateItemsExist([1, 2, 3]);
        expect.fail('Should have thrown EntitiesNotFoundError');
      } catch (error) {
        expect(error).toBeInstanceOf(EntitiesNotFoundError);
        expect((error as EntitiesNotFoundError).entityIds).toEqual([1, 2, 3]);
      }
    });

    it('should check for non-deleted items only', async () => {
      // Arrange
      prismaMock.item.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }] as any);

      // Act
      await validateItemsExist([1, 2]);

      // Assert
      expect(prismaMock.item.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: [1, 2] },
          deletedAt: null,
        },
        select: { id: true },
      });
    });

    it('should not throw for empty array', async () => {
      // Arrange
      prismaMock.item.findMany.mockResolvedValue([]);

      // Act & Assert
      await expect(validateItemsExist([])).resolves.toBeUndefined();
    });
  });

  // ==========================================================================
  // validateBranchExists
  // ==========================================================================
  describe('validateBranchExists', () => {
    it('should not throw when branch exists', async () => {
      // Arrange
      const branch = createTestBranch({ id: 1 });
      prismaMock.branch.findUnique.mockResolvedValue(branch as any);

      // Act & Assert
      await expect(validateBranchExists(1)).resolves.toBeUndefined();
    });

    it('should throw EntityNotFoundError when branch does not exist', async () => {
      // Arrange
      prismaMock.branch.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(validateBranchExists(999)).rejects.toThrow(EntityNotFoundError);
    });

    it('should throw EntityNotFoundError with correct entity and id', async () => {
      // Arrange
      prismaMock.branch.findUnique.mockResolvedValue(null);

      // Act & Assert
      try {
        await validateBranchExists(5);
        expect.fail('Should have thrown EntityNotFoundError');
      } catch (error) {
        expect(error).toBeInstanceOf(EntityNotFoundError);
        expect((error as EntityNotFoundError).entity).toBe('Branch');
        expect((error as EntityNotFoundError).entityId).toBe(5);
      }
    });
  });

  // ==========================================================================
  // validateDepartmentExists
  // ==========================================================================
  describe('validateDepartmentExists', () => {
    it('should not throw when department exists', async () => {
      // Arrange
      const department = createTestDepartment({ id: 1 });
      prismaMock.department.findUnique.mockResolvedValue(department as any);

      // Act & Assert
      await expect(validateDepartmentExists(1)).resolves.toBeUndefined();
    });

    it('should throw EntityNotFoundError when department does not exist', async () => {
      // Arrange
      prismaMock.department.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(validateDepartmentExists(999)).rejects.toThrow(EntityNotFoundError);
    });

    it('should throw EntityNotFoundError with correct entity and id', async () => {
      // Arrange
      prismaMock.department.findUnique.mockResolvedValue(null);

      // Act & Assert
      try {
        await validateDepartmentExists(7);
        expect.fail('Should have thrown EntityNotFoundError');
      } catch (error) {
        expect(error).toBeInstanceOf(EntityNotFoundError);
        expect((error as EntityNotFoundError).entity).toBe('Department');
        expect((error as EntityNotFoundError).entityId).toBe(7);
      }
    });
  });

  // ==========================================================================
  // validateCostCenterExists
  // ==========================================================================
  describe('validateCostCenterExists', () => {
    it('should not throw when cost center exists', async () => {
      // Arrange
      const costCenter = createTestCostCenter({ id: 1 });
      prismaMock.costCenter.findUnique.mockResolvedValue(costCenter as any);

      // Act & Assert
      await expect(validateCostCenterExists(1)).resolves.toBeUndefined();
    });

    it('should throw EntityNotFoundError when cost center does not exist', async () => {
      // Arrange
      prismaMock.costCenter.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(validateCostCenterExists(999)).rejects.toThrow(EntityNotFoundError);
    });

    it('should throw EntityNotFoundError with correct entity and id', async () => {
      // Arrange
      prismaMock.costCenter.findUnique.mockResolvedValue(null);

      // Act & Assert
      try {
        await validateCostCenterExists(9);
        expect.fail('Should have thrown EntityNotFoundError');
      } catch (error) {
        expect(error).toBeInstanceOf(EntityNotFoundError);
        expect((error as EntityNotFoundError).entity).toBe('CostCenter');
        expect((error as EntityNotFoundError).entityId).toBe(9);
      }
    });
  });

  // ==========================================================================
  // validatePurchaseOrderExists
  // ==========================================================================
  describe('validatePurchaseOrderExists', () => {
    it('should not throw when purchase order exists', async () => {
      // Arrange
      const po = createTestPurchaseOrder({ id: 1 });
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(po as any);

      // Act & Assert
      await expect(validatePurchaseOrderExists(1)).resolves.toBeUndefined();
    });

    it('should throw EntityNotFoundError when purchase order does not exist', async () => {
      // Arrange
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(validatePurchaseOrderExists(999)).rejects.toThrow(EntityNotFoundError);
    });

    it('should throw EntityNotFoundError with correct entity and id', async () => {
      // Arrange
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(null);

      // Act & Assert
      try {
        await validatePurchaseOrderExists(11);
        expect.fail('Should have thrown EntityNotFoundError');
      } catch (error) {
        expect(error).toBeInstanceOf(EntityNotFoundError);
        expect((error as EntityNotFoundError).entity).toBe('PurchaseOrder');
        expect((error as EntityNotFoundError).entityId).toBe(11);
      }
    });

    it('should check for non-deleted purchase orders only', async () => {
      // Arrange
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(null);

      // Act
      try {
        await validatePurchaseOrderExists(1);
      } catch {
        // Expected to throw
      }

      // Assert
      expect(prismaMock.purchaseOrder.findFirst).toHaveBeenCalledWith({
        where: { id: 1, deletedAt: null },
      });
    });
  });

  // ==========================================================================
  // validateInvoiceExists
  // ==========================================================================
  describe('validateInvoiceExists', () => {
    it('should not throw when invoice exists', async () => {
      // Arrange
      const invoice = createTestInvoice({ id: 1 });
      prismaMock.invoice.findFirst.mockResolvedValue(invoice as any);

      // Act & Assert
      await expect(validateInvoiceExists(1)).resolves.toBeUndefined();
    });

    it('should throw EntityNotFoundError when invoice does not exist', async () => {
      // Arrange
      prismaMock.invoice.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(validateInvoiceExists(999)).rejects.toThrow(EntityNotFoundError);
    });

    it('should throw EntityNotFoundError with correct entity and id', async () => {
      // Arrange
      prismaMock.invoice.findFirst.mockResolvedValue(null);

      // Act & Assert
      try {
        await validateInvoiceExists(13);
        expect.fail('Should have thrown EntityNotFoundError');
      } catch (error) {
        expect(error).toBeInstanceOf(EntityNotFoundError);
        expect((error as EntityNotFoundError).entity).toBe('Invoice');
        expect((error as EntityNotFoundError).entityId).toBe(13);
      }
    });

    it('should check for non-deleted invoices only', async () => {
      // Arrange
      prismaMock.invoice.findFirst.mockResolvedValue(null);

      // Act
      try {
        await validateInvoiceExists(1);
      } catch {
        // Expected to throw
      }

      // Assert
      expect(prismaMock.invoice.findFirst).toHaveBeenCalledWith({
        where: { id: 1, deletedAt: null },
      });
    });
  });

  // ==========================================================================
  // validateUserExists
  // ==========================================================================
  describe('validateUserExists', () => {
    it('should not throw when user exists', async () => {
      // Arrange
      const user = createTestUser({ id: 1 });
      prismaMock.user.findUnique.mockResolvedValue(user as any);

      // Act & Assert
      await expect(validateUserExists(1)).resolves.toBeUndefined();
    });

    it('should throw EntityNotFoundError when user does not exist', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(validateUserExists(999)).rejects.toThrow(EntityNotFoundError);
    });

    it('should throw EntityNotFoundError with correct entity and id', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      try {
        await validateUserExists(17);
        expect.fail('Should have thrown EntityNotFoundError');
      } catch (error) {
        expect(error).toBeInstanceOf(EntityNotFoundError);
        expect((error as EntityNotFoundError).entity).toBe('User');
        expect((error as EntityNotFoundError).entityId).toBe(17);
      }
    });
  });

  // ==========================================================================
  // Error classes
  // ==========================================================================
  describe('EntityNotFoundError', () => {
    it('should have correct name property', () => {
      const error = new EntityNotFoundError('Test', 1);
      expect(error.name).toBe('EntityNotFoundError');
    });

    it('should be instanceof Error', () => {
      const error = new EntityNotFoundError('Test', 1);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('EntitiesNotFoundError', () => {
    it('should have correct name property', () => {
      const error = new EntitiesNotFoundError('Test', [1, 2]);
      expect(error.name).toBe('EntitiesNotFoundError');
    });

    it('should be instanceof Error', () => {
      const error = new EntitiesNotFoundError('Test', [1, 2]);
      expect(error).toBeInstanceOf(Error);
    });

    it('should format message correctly with multiple ids', () => {
      const error = new EntitiesNotFoundError('Item', [1, 5, 10]);
      expect(error.message).toBe('Item(s) with ids [1, 5, 10] not found');
    });
  });
});
