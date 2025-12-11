import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getPrismaMock } from '../../helpers/prisma-mock';
import {
  createTestItem,
  createTestVendor,
  createTestBranch,
} from '../../helpers/test-factories';

// Get the mocked prisma instance
const prismaMock = getPrismaMock();

// Mock cache service
const mockCacheService = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  invalidateByPrefix: vi.fn(),
  ping: vi.fn().mockResolvedValue(true),
};

// Import after mocks
import { CrossLocationService, createCrossLocationService } from '../../../services/analytics/crossLocationService';
import { CrossLocationError } from '../../../errors/AnalyticsError';

describe('CrossLocationService', () => {
  let service: CrossLocationService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheService.get.mockResolvedValue(null); // Default: no cache hit
    service = createCrossLocationService(prismaMock as any, mockCacheService as any);
  });

  // ============================================================================
  // getPriceVariance
  // ============================================================================
  describe('getPriceVariance', () => {
    it('should return price variance from snapshots when available', async () => {
      // Arrange
      const itemId = 1;
      const snapshots = [
        {
          id: 1,
          itemId: 1,
          vendorId: 10,
          branchId: 1,
          price: 100,
          date: new Date(),
          item: { id: 1, name: 'Test Item' },
          vendor: { id: 10, name: 'Test Vendor' },
          branch: { id: 1, name: 'Branch A' },
        },
        {
          id: 2,
          itemId: 1,
          vendorId: 10,
          branchId: 2,
          price: 120,
          date: new Date(),
          item: { id: 1, name: 'Test Item' },
          vendor: { id: 10, name: 'Test Vendor' },
          branch: { id: 2, name: 'Branch B' },
        },
      ];

      prismaMock.priceSnapshot.findMany.mockResolvedValue(snapshots as any);

      // Act
      const result = await service.getPriceVariance(itemId);

      // Assert
      expect(result.length).toBe(1); // One vendor
      expect(result[0].vendorId).toBe(10);
      expect(result[0].branches.length).toBe(2);
      expect(result[0].networkAvgPrice).toBe(110); // (100 + 120) / 2
      expect(result[0].networkMinPrice).toBe(100);
      expect(result[0].networkMaxPrice).toBe(120);
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('should fallback to invoice items when no snapshots exist', async () => {
      // Arrange
      const itemId = 1;
      prismaMock.priceSnapshot.findMany.mockResolvedValue([]);

      const invoiceItems = [
        {
          id: 1,
          price: 100,
          item: {
            id: 1,
            name: 'Test Item',
            vendorId: 10,
            vendor: { id: 10, name: 'Test Vendor' },
          },
          invoice: {
            branchId: 1,
            branch: { id: 1, name: 'Branch A' },
            date: new Date(),
          },
        },
        {
          id: 2,
          price: 110,
          item: {
            id: 1,
            name: 'Test Item',
            vendorId: 10,
            vendor: { id: 10, name: 'Test Vendor' },
          },
          invoice: {
            branchId: 2,
            branch: { id: 2, name: 'Branch B' },
            date: new Date(),
          },
        },
      ];

      prismaMock.invoiceItem.findMany.mockResolvedValue(invoiceItems as any);

      // Act
      const result = await service.getPriceVariance(itemId);

      // Assert
      expect(result.length).toBe(1);
      expect(result[0].branches.length).toBe(2);
    });

    it('should filter by vendorId when provided', async () => {
      // Arrange
      const itemId = 1;
      const vendorId = 10;
      prismaMock.priceSnapshot.findMany.mockResolvedValue([]);
      prismaMock.invoiceItem.findMany.mockResolvedValue([]);

      // Act
      await service.getPriceVariance(itemId, vendorId);

      // Assert
      expect(prismaMock.priceSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            vendorId,
          }),
        })
      );
    });

    it('should return empty array when no data exists', async () => {
      // Arrange
      const itemId = 999;
      prismaMock.priceSnapshot.findMany.mockResolvedValue([]);
      prismaMock.invoiceItem.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getPriceVariance(itemId);

      // Assert
      expect(result).toEqual([]);
    });

    it('should return cached result if available', async () => {
      // Arrange
      const itemId = 1;
      const cachedResult = [{ itemId: 1, vendorId: 10, branches: [] }];
      mockCacheService.get.mockResolvedValue(cachedResult);

      // Act
      const result = await service.getPriceVariance(itemId);

      // Assert
      expect(result).toEqual(cachedResult);
      expect(prismaMock.priceSnapshot.findMany).not.toHaveBeenCalled();
    });

    it('should calculate variance percentage correctly', async () => {
      // Arrange
      const itemId = 1;
      const snapshots = [
        {
          id: 1, itemId: 1, vendorId: 10, branchId: 1, price: 100,
          date: new Date(),
          item: { id: 1, name: 'Item' },
          vendor: { id: 10, name: 'Vendor' },
          branch: { id: 1, name: 'Branch A' },
        },
        {
          id: 2, itemId: 1, vendorId: 10, branchId: 2, price: 120,
          date: new Date(),
          item: { id: 1, name: 'Item' },
          vendor: { id: 10, name: 'Vendor' },
          branch: { id: 2, name: 'Branch B' },
        },
      ];

      prismaMock.priceSnapshot.findMany.mockResolvedValue(snapshots as any);

      // Act
      const result = await service.getPriceVariance(itemId);

      // Assert
      // Avg = 110, Branch A = 100 (-9.09%), Branch B = 120 (+9.09%)
      const branchA = result[0].branches.find(b => b.branchId === 1);
      const branchB = result[0].branches.find(b => b.branchId === 2);
      expect(branchA?.varianceFromAvg).toBeCloseTo(-9.09, 1);
      expect(branchB?.varianceFromAvg).toBeCloseTo(9.09, 1);
      expect(result[0].maxVariance).toBeCloseTo(9.09, 1);
    });

    it('should throw CrossLocationError on database failure', async () => {
      // Arrange
      const itemId = 1;
      prismaMock.priceSnapshot.findMany.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(service.getPriceVariance(itemId)).rejects.toThrow(CrossLocationError);
    });
  });

  // ============================================================================
  // getBenchmarkStats
  // ============================================================================
  describe('getBenchmarkStats', () => {
    it('should return benchmark stats from snapshots', async () => {
      // Arrange
      const itemId = 1;
      const snapshots = [
        { id: 1, itemId: 1, branchId: 1, price: 100, date: new Date() },
        { id: 2, itemId: 1, branchId: 2, price: 120, date: new Date() },
        { id: 3, itemId: 1, branchId: 3, price: 140, date: new Date() },
      ];

      prismaMock.priceSnapshot.findMany.mockResolvedValue(snapshots as any);

      // Act
      const result = await service.getBenchmarkStats(itemId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.avgPrice).toBe(120); // (100+120+140)/3
      expect(result?.minPrice).toBe(100);
      expect(result?.maxPrice).toBe(140);
      expect(result?.priceRange).toBe(40); // 140 - 100
      expect(result?.branchCount).toBe(3);
    });

    it('should fallback to invoice items when no snapshots exist', async () => {
      // Arrange
      const itemId = 1;
      prismaMock.priceSnapshot.findMany.mockResolvedValue([]);

      const invoiceItems = [
        { id: 1, price: 100, invoice: { branchId: 1 } },
        { id: 2, price: 110, invoice: { branchId: 2 } },
      ];
      prismaMock.invoiceItem.findMany.mockResolvedValue(invoiceItems as any);

      // Act
      const result = await service.getBenchmarkStats(itemId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.avgPrice).toBe(105);
      expect(result?.branchCount).toBe(2);
    });

    it('should return null when no data exists', async () => {
      // Arrange
      const itemId = 999;
      prismaMock.priceSnapshot.findMany.mockResolvedValue([]);
      prismaMock.invoiceItem.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getBenchmarkStats(itemId);

      // Assert
      expect(result).toBeNull();
    });

    it('should return cached result if available', async () => {
      // Arrange
      const itemId = 1;
      const cachedStats = { itemId: 1, avgPrice: 100, minPrice: 90, maxPrice: 110 };
      mockCacheService.get.mockResolvedValue(cachedStats);

      // Act
      const result = await service.getBenchmarkStats(itemId);

      // Assert
      expect(result).toEqual(cachedStats);
      expect(prismaMock.priceSnapshot.findMany).not.toHaveBeenCalled();
    });

    it('should throw CrossLocationError on database failure', async () => {
      // Arrange
      const itemId = 1;
      prismaMock.priceSnapshot.findMany.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(service.getBenchmarkStats(itemId)).rejects.toThrow(CrossLocationError);
    });
  });

  // ============================================================================
  // compareSpendingByBranch
  // ============================================================================
  describe('compareSpendingByBranch', () => {
    it('should return spending comparison by branch for date range', async () => {
      // Arrange
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const metrics = [
        {
          id: 1, branchId: 1, totalAmount: 1000, invoiceCount: 5,
          branch: { id: 1, name: 'Branch A' },
        },
        {
          id: 2, branchId: 1, totalAmount: 500, invoiceCount: 3,
          branch: { id: 1, name: 'Branch A' },
        },
        {
          id: 3, branchId: 2, totalAmount: 2000, invoiceCount: 10,
          branch: { id: 2, name: 'Branch B' },
        },
      ];

      prismaMock.spendingMetric.findMany.mockResolvedValue(metrics as any);

      // Act
      const result = await service.compareSpendingByBranch(startDate, endDate);

      // Assert
      expect(result.length).toBe(2);
      // Should be sorted by total amount descending
      expect(result[0].branchId).toBe(2); // 2000
      expect(result[0].totalAmount).toBe(2000);
      expect(result[1].branchId).toBe(1); // 1500 (1000 + 500)
      expect(result[1].totalAmount).toBe(1500);
    });

    it('should filter by itemId when provided', async () => {
      // Arrange
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const itemId = 10;

      prismaMock.spendingMetric.findMany.mockResolvedValue([]);

      // Act
      await service.compareSpendingByBranch(startDate, endDate, itemId);

      // Assert
      expect(prismaMock.spendingMetric.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            itemId,
          }),
        })
      );
    });

    it('should return empty array when no metrics exist', async () => {
      // Arrange
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      prismaMock.spendingMetric.findMany.mockResolvedValue([]);

      // Act
      const result = await service.compareSpendingByBranch(startDate, endDate);

      // Assert
      expect(result).toEqual([]);
    });

    it('should return cached result if available', async () => {
      // Arrange
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const cachedResult = [{ branchId: 1, totalAmount: 1000 }];
      mockCacheService.get.mockResolvedValue(cachedResult);

      // Act
      const result = await service.compareSpendingByBranch(startDate, endDate);

      // Assert
      expect(result).toEqual(cachedResult);
      expect(prismaMock.spendingMetric.findMany).not.toHaveBeenCalled();
    });

    it('should throw CrossLocationError on database failure', async () => {
      // Arrange
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      prismaMock.spendingMetric.findMany.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(service.compareSpendingByBranch(startDate, endDate)).rejects.toThrow(CrossLocationError);
    });
  });

  // ============================================================================
  // findConsolidationOpportunities
  // ============================================================================
  describe('findConsolidationOpportunities', () => {
    it('should identify items with multiple vendors as consolidation opportunities', async () => {
      // Arrange
      const metrics = [
        {
          id: 1, itemId: 1, vendorId: 10, branchId: 1, totalAmount: 1000,
          item: { id: 1, name: 'Item A', vendorId: 10 },
          branch: { id: 1, name: 'Branch 1' },
          vendor: { id: 10, name: 'Vendor X' },
        },
        {
          id: 2, itemId: 1, vendorId: 20, branchId: 2, totalAmount: 1500,
          item: { id: 1, name: 'Item A', vendorId: 20 },
          branch: { id: 2, name: 'Branch 2' },
          vendor: { id: 20, name: 'Vendor Y' },
        },
      ];

      prismaMock.spendingMetric.findMany.mockResolvedValue(metrics as any);

      // Act
      const result = await service.findConsolidationOpportunities();

      // Assert
      expect(result.length).toBe(1);
      expect(result[0].itemId).toBe(1);
      expect(result[0].vendorCount).toBe(2);
      expect(result[0].branchCount).toBe(2);
      expect(result[0].totalSpending).toBe(2500);
    });

    it('should identify items purchased at multiple branches as opportunities', async () => {
      // Arrange
      const metrics = [
        {
          id: 1, itemId: 1, vendorId: 10, branchId: 1, totalAmount: 1000,
          item: { id: 1, name: 'Item A', vendorId: 10 },
          branch: { id: 1, name: 'Branch 1' },
          vendor: { id: 10, name: 'Vendor X' },
        },
        {
          id: 2, itemId: 1, vendorId: 10, branchId: 2, totalAmount: 1500,
          item: { id: 1, name: 'Item A', vendorId: 10 },
          branch: { id: 2, name: 'Branch 2' },
          vendor: { id: 10, name: 'Vendor X' },
        },
      ];

      prismaMock.spendingMetric.findMany.mockResolvedValue(metrics as any);

      // Act
      const result = await service.findConsolidationOpportunities();

      // Assert
      expect(result.length).toBe(1);
      expect(result[0].vendorCount).toBe(1); // Same vendor
      expect(result[0].branchCount).toBe(2); // Multiple branches
    });

    it('should not identify single vendor/single branch items as opportunities', async () => {
      // Arrange
      const metrics = [
        {
          id: 1, itemId: 1, vendorId: 10, branchId: 1, totalAmount: 1000,
          item: { id: 1, name: 'Item A', vendorId: 10 },
          branch: { id: 1, name: 'Branch 1' },
          vendor: { id: 10, name: 'Vendor X' },
        },
      ];

      prismaMock.spendingMetric.findMany.mockResolvedValue(metrics as any);

      // Act
      const result = await service.findConsolidationOpportunities();

      // Assert
      expect(result).toEqual([]);
    });

    it('should sort opportunities by total spending descending', async () => {
      // Arrange
      const metrics = [
        {
          id: 1, itemId: 1, vendorId: 10, branchId: 1, totalAmount: 1000,
          item: { id: 1, name: 'Item A', vendorId: 10 },
          branch: { id: 1, name: 'Branch 1' },
          vendor: { id: 10, name: 'Vendor X' },
        },
        {
          id: 2, itemId: 1, vendorId: 20, branchId: 2, totalAmount: 500,
          item: { id: 1, name: 'Item A', vendorId: 20 },
          branch: { id: 2, name: 'Branch 2' },
          vendor: { id: 20, name: 'Vendor Y' },
        },
        {
          id: 3, itemId: 2, vendorId: 30, branchId: 1, totalAmount: 3000,
          item: { id: 2, name: 'Item B', vendorId: 30 },
          branch: { id: 1, name: 'Branch 1' },
          vendor: { id: 30, name: 'Vendor Z' },
        },
        {
          id: 4, itemId: 2, vendorId: 40, branchId: 2, totalAmount: 2000,
          item: { id: 2, name: 'Item B', vendorId: 40 },
          branch: { id: 2, name: 'Branch 2' },
          vendor: { id: 40, name: 'Vendor W' },
        },
      ];

      prismaMock.spendingMetric.findMany.mockResolvedValue(metrics as any);

      // Act
      const result = await service.findConsolidationOpportunities();

      // Assert
      expect(result.length).toBe(2);
      expect(result[0].itemId).toBe(2); // 5000 total
      expect(result[1].itemId).toBe(1); // 1500 total
    });

    it('should return empty array when no metrics exist', async () => {
      // Arrange
      prismaMock.spendingMetric.findMany.mockResolvedValue([]);

      // Act
      const result = await service.findConsolidationOpportunities();

      // Assert
      expect(result).toEqual([]);
    });

    it('should return cached result if available', async () => {
      // Arrange
      const cachedResult = [{ itemId: 1, vendorCount: 2 }];
      mockCacheService.get.mockResolvedValue(cachedResult);

      // Act
      const result = await service.findConsolidationOpportunities();

      // Assert
      expect(result).toEqual(cachedResult);
      expect(prismaMock.spendingMetric.findMany).not.toHaveBeenCalled();
    });

    it('should throw CrossLocationError on database failure', async () => {
      // Arrange
      prismaMock.spendingMetric.findMany.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(service.findConsolidationOpportunities()).rejects.toThrow(CrossLocationError);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================
  describe('edge cases', () => {
    it('should handle null branchId in snapshots', async () => {
      // Arrange
      const itemId = 1;
      const snapshots = [
        {
          id: 1, itemId: 1, vendorId: 10, branchId: null, price: 100,
          date: new Date(),
          item: { id: 1, name: 'Item' },
          vendor: { id: 10, name: 'Vendor' },
          branch: null,
        },
      ];

      prismaMock.priceSnapshot.findMany.mockResolvedValue(snapshots as any);

      // Act
      const result = await service.getPriceVariance(itemId);

      // Assert
      expect(result.length).toBe(1);
      expect(result[0].branches[0].branchName).toBe('Unassigned');
    });

    it('should handle empty price array in stats calculation', async () => {
      // Arrange
      const itemId = 1;
      prismaMock.priceSnapshot.findMany.mockResolvedValue([]);
      prismaMock.invoiceItem.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getBenchmarkStats(itemId);

      // Assert
      expect(result).toBeNull();
    });
  });
});
