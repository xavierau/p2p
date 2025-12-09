import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getPrismaMock } from '../helpers/prisma-mock';
import {
  createTestVendor,
  createTestItem,
} from '../helpers/test-factories';

// Get the mocked prisma instance
const prismaMock = getPrismaMock();

// Import services after mocking
import * as vendorService from '../../services/vendorService';
import { VendorHasActiveItemsError } from '../../services/vendorService';

describe('vendorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // createVendor
  // ==========================================================================
  describe('createVendor', () => {
    it('should create a vendor with name and contact', async () => {
      // Arrange
      const vendorData = { name: 'Test Vendor', contact: 'test@vendor.com' };
      const createdVendor = createTestVendor({
        id: 1,
        name: 'Test Vendor',
        contact: 'test@vendor.com',
      });

      prismaMock.vendor.create.mockResolvedValue(createdVendor as any);

      // Act
      const result = await vendorService.createVendor(vendorData);

      // Assert
      expect(result.name).toBe('Test Vendor');
      expect(result.contact).toBe('test@vendor.com');
      expect(prismaMock.vendor.create).toHaveBeenCalledWith({
        data: { name: 'Test Vendor', contact: 'test@vendor.com' },
      });
    });

    it('should create a vendor with only name (contact optional)', async () => {
      // Arrange
      const vendorData = { name: 'Test Vendor' };
      const createdVendor = createTestVendor({
        id: 1,
        name: 'Test Vendor',
        contact: null,
      });

      prismaMock.vendor.create.mockResolvedValue(createdVendor as any);

      // Act
      const result = await vendorService.createVendor(vendorData);

      // Assert
      expect(result.name).toBe('Test Vendor');
    });
  });

  // ==========================================================================
  // getVendors
  // ==========================================================================
  describe('getVendors', () => {
    it('should return paginated vendors', async () => {
      // Arrange
      const vendors = [
        createTestVendor({ id: 1, name: 'Vendor A' }),
        createTestVendor({ id: 2, name: 'Vendor B' }),
      ];

      prismaMock.vendor.count.mockResolvedValue(2);
      prismaMock.vendor.findMany.mockResolvedValue(vendors as any);

      // Act
      const result = await vendorService.getVendors({}, { page: '1', limit: '10' });

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
    });

    it('should filter by id with equals operator', async () => {
      // Arrange
      const vendor = createTestVendor({ id: 5 });
      prismaMock.vendor.count.mockResolvedValue(1);
      prismaMock.vendor.findMany.mockResolvedValue([vendor] as any);

      // Act
      await vendorService.getVendors({ id: '5', idOperator: '=' }, { page: '1', limit: '10' });

      // Assert
      expect(prismaMock.vendor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { id: 5 },
            ]),
          }),
        })
      );
    });

    it('should filter by name with contains operator (case insensitive)', async () => {
      // Arrange
      prismaMock.vendor.count.mockResolvedValue(1);
      prismaMock.vendor.findMany.mockResolvedValue([createTestVendor({ name: 'Test Vendor' })] as any);

      // Act
      await vendorService.getVendors(
        { name: 'test', nameOperator: 'contains' },
        { page: '1', limit: '10' }
      );

      // Assert
      expect(prismaMock.vendor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { name: { contains: 'test', mode: 'insensitive' } },
            ]),
          }),
        })
      );
    });

    it('should filter by name with equals operator', async () => {
      // Arrange
      prismaMock.vendor.count.mockResolvedValue(1);
      prismaMock.vendor.findMany.mockResolvedValue([createTestVendor({ name: 'Exact Name' })] as any);

      // Act
      await vendorService.getVendors(
        { name: 'Exact Name', nameOperator: '=' },
        { page: '1', limit: '10' }
      );

      // Assert
      expect(prismaMock.vendor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { name: 'Exact Name' },
            ]),
          }),
        })
      );
    });

    it('should exclude soft-deleted vendors', async () => {
      // Arrange
      prismaMock.vendor.count.mockResolvedValue(0);
      prismaMock.vendor.findMany.mockResolvedValue([]);

      // Act
      await vendorService.getVendors({}, { page: '1', limit: '10' });

      // Assert
      expect(prismaMock.vendor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { deletedAt: null },
            ]),
          }),
        })
      );
    });

    it('should include items relation', async () => {
      // Arrange
      prismaMock.vendor.count.mockResolvedValue(0);
      prismaMock.vendor.findMany.mockResolvedValue([]);

      // Act
      await vendorService.getVendors({}, { page: '1', limit: '10' });

      // Assert
      expect(prismaMock.vendor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { items: { where: { deletedAt: null } } },
        })
      );
    });

    it('should calculate pagination correctly', async () => {
      // Arrange
      prismaMock.vendor.count.mockResolvedValue(25);
      prismaMock.vendor.findMany.mockResolvedValue([]);

      // Act
      const result = await vendorService.getVendors({}, { page: '2', limit: '10' });

      // Assert
      expect(result.pagination).toEqual({
        total: 25,
        page: 2,
        limit: 10,
        totalPages: 3,
        hasNext: true,
        hasPrevious: true,
      });
    });
  });

  // ==========================================================================
  // getVendorById
  // ==========================================================================
  describe('getVendorById', () => {
    it('should return vendor with items', async () => {
      // Arrange
      const vendor = createTestVendor({ id: 1 });
      prismaMock.vendor.findFirst.mockResolvedValue(vendor as any);

      // Act
      const result = await vendorService.getVendorById(1);

      // Assert
      expect(result).toEqual(vendor);
      expect(prismaMock.vendor.findFirst).toHaveBeenCalledWith({
        where: { id: 1, deletedAt: null },
        include: {
          items: {
            where: { deletedAt: null },
            select: {
              id: true,
              name: true,
              item_code: true,
              price: true,
            },
          },
        },
      });
    });

    it('should return null for non-existent vendor', async () => {
      // Arrange
      prismaMock.vendor.findFirst.mockResolvedValue(null);

      // Act
      const result = await vendorService.getVendorById(999);

      // Assert
      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // updateVendor
  // ==========================================================================
  describe('updateVendor', () => {
    it('should update vendor name', async () => {
      // Arrange
      const vendor = createTestVendor({ id: 1, name: 'Old Name' });
      prismaMock.vendor.findFirst.mockResolvedValue(vendor as any);
      prismaMock.vendor.update.mockResolvedValue({
        ...vendor,
        name: 'New Name',
      } as any);

      // Act
      const result = await vendorService.updateVendor(1, { name: 'New Name' });

      // Assert
      expect(result?.name).toBe('New Name');
      expect(prismaMock.vendor.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: 'New Name' },
        include: { items: { where: { deletedAt: null } } },
      });
    });

    it('should update vendor contact', async () => {
      // Arrange
      const vendor = createTestVendor({ id: 1 });
      prismaMock.vendor.findFirst.mockResolvedValue(vendor as any);
      prismaMock.vendor.update.mockResolvedValue({
        ...vendor,
        contact: 'new@contact.com',
      } as any);

      // Act
      const result = await vendorService.updateVendor(1, { contact: 'new@contact.com' });

      // Assert
      expect(result?.contact).toBe('new@contact.com');
    });

    it('should return null when vendor not found', async () => {
      // Arrange
      prismaMock.vendor.findFirst.mockResolvedValue(null);

      // Act
      const result = await vendorService.updateVendor(999, { name: 'New Name' });

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.vendor.update).not.toHaveBeenCalled();
    });

    it('should allow setting contact to null', async () => {
      // Arrange
      const vendor = createTestVendor({ id: 1, contact: 'old@contact.com' });
      prismaMock.vendor.findFirst.mockResolvedValue(vendor as any);
      prismaMock.vendor.update.mockResolvedValue({
        ...vendor,
        contact: null,
      } as any);

      // Act
      const result = await vendorService.updateVendor(1, { contact: null });

      // Assert
      expect(result?.contact).toBeNull();
    });
  });

  // ==========================================================================
  // deleteVendor
  // ==========================================================================
  describe('deleteVendor', () => {
    it('should soft delete vendor when no active items exist', async () => {
      // Arrange
      const vendor = createTestVendor({ id: 1, items: [] });
      prismaMock.vendor.findFirst.mockResolvedValue(vendor as any);
      prismaMock.vendor.update.mockResolvedValue({
        ...vendor,
        deletedAt: new Date(),
      } as any);

      // Act
      const result = await vendorService.deleteVendor(1);

      // Assert
      expect(result?.deletedAt).not.toBeNull();
      expect(prismaMock.vendor.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw VendorHasActiveItemsError when vendor has active items', async () => {
      // Arrange
      const item = createTestItem({ id: 1, vendorId: 1 });
      const vendor = {
        ...createTestVendor({ id: 1 }),
        items: [{ id: 1 }, { id: 2 }], // 2 active items
      };
      prismaMock.vendor.findFirst.mockResolvedValue(vendor as any);

      // Act & Assert
      await expect(vendorService.deleteVendor(1)).rejects.toThrow(VendorHasActiveItemsError);
    });

    it('should throw VendorHasActiveItemsError with correct vendorId and itemCount', async () => {
      // Arrange
      const vendor = {
        ...createTestVendor({ id: 5 }),
        items: [{ id: 1 }, { id: 2 }, { id: 3 }], // 3 active items
      };
      prismaMock.vendor.findFirst.mockResolvedValue(vendor as any);

      // Act & Assert
      try {
        await vendorService.deleteVendor(5);
        expect.fail('Should have thrown VendorHasActiveItemsError');
      } catch (error) {
        expect(error).toBeInstanceOf(VendorHasActiveItemsError);
        expect((error as VendorHasActiveItemsError).vendorId).toBe(5);
        expect((error as VendorHasActiveItemsError).itemCount).toBe(3);
        expect((error as VendorHasActiveItemsError).message).toBe(
          'Cannot delete vendor 5: has 3 active items'
        );
      }
    });

    it('should return null when vendor not found', async () => {
      // Arrange
      prismaMock.vendor.findFirst.mockResolvedValue(null);

      // Act
      const result = await vendorService.deleteVendor(999);

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.vendor.update).not.toHaveBeenCalled();
    });

    it('should not delete already deleted vendor', async () => {
      // Arrange - findFirst with deletedAt: null returns null for deleted vendors
      prismaMock.vendor.findFirst.mockResolvedValue(null);

      // Act
      const result = await vendorService.deleteVendor(1);

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.vendor.update).not.toHaveBeenCalled();
    });

    it('should check for active items only (not deleted items)', async () => {
      // Arrange
      prismaMock.vendor.findFirst.mockResolvedValue({
        id: 1,
        name: 'Test Vendor',
        items: [], // No active items
      } as any);

      // Act
      await vendorService.deleteVendor(1);

      // Assert
      expect(prismaMock.vendor.findFirst).toHaveBeenCalledWith({
        where: { id: 1, deletedAt: null },
        include: {
          items: {
            where: { deletedAt: null },
            select: { id: true },
          },
        },
      });
    });
  });
});
