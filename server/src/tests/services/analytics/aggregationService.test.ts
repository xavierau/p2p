import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getPrismaMock, PrismaMock } from '../../helpers/prisma-mock';
import {
  createTestInvoice,
  createTestInvoiceItem,
  createTestItem,
  createTestBranch,
  createTestDepartment,
  createTestCostCenter,
} from '../../helpers/test-factories';
import { AnalyticsEvents } from '../../../domain/analytics';

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

// Mock pubsub
const mockPubSub = {
  publish: vi.fn(),
  subscribe: vi.fn(),
};

// Import after mocks
import { AggregationService, createAggregationService } from '../../../services/analytics/aggregationService';
import { AggregationError } from '../../../errors/AnalyticsError';

describe('AggregationService', () => {
  let service: AggregationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createAggregationService(
      prismaMock as any,
      mockCacheService as any,
      mockPubSub as any
    );
  });

  // ============================================================================
  // computeDailySpendingMetrics
  // ============================================================================
  describe('computeDailySpendingMetrics', () => {
    it('should compute metrics and upsert into database for approved invoices', async () => {
      // Arrange
      const testDate = new Date('2024-01-15');
      const invoice = createTestInvoice({
        id: 1,
        status: 'APPROVED',
        branchId: 1,
        departmentId: 1,
        costCenterId: 1,
        deletedAt: null,
      });

      const invoiceWithItems = {
        ...invoice,
        items: [
          {
            id: 1,
            invoiceId: 1,
            itemId: 10,
            quantity: 5,
            price: 100,
            item: { id: 10, vendorId: 20 },
          },
        ],
        branch: createTestBranch({ id: 1 }),
        department: createTestDepartment({ id: 1 }),
        costCenter: createTestCostCenter({ id: 1 }),
      };

      prismaMock.invoice.findMany.mockResolvedValue([invoiceWithItems] as any);

      // Mock transaction
      const txMock = {
        spendingMetric: {
          upsert: vi.fn().mockResolvedValue({}),
        },
      };
      prismaMock.$transaction.mockImplementation(async (cb: any) => {
        const result = await cb(txMock);
        return result;
      });

      // Act
      await service.computeDailySpendingMetrics(testDate);

      // Assert
      expect(prismaMock.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'APPROVED',
            deletedAt: null,
          }),
        })
      );
      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(mockCacheService.invalidateByPrefix).toHaveBeenCalledWith('analytics:spending-metrics');
      expect(mockPubSub.publish).toHaveBeenCalledWith(
        AnalyticsEvents.SPENDING_METRICS_COMPUTED,
        expect.objectContaining({
          source: 'AggregationService',
        })
      );
    });

    it('should return early when no approved invoices found', async () => {
      // Arrange
      const testDate = new Date('2024-01-15');
      prismaMock.invoice.findMany.mockResolvedValue([]);

      // Act
      await service.computeDailySpendingMetrics(testDate);

      // Assert
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(mockCacheService.invalidateByPrefix).not.toHaveBeenCalled();
    });

    it('should handle transaction rollback on error', async () => {
      // Arrange
      const testDate = new Date('2024-01-15');
      const invoiceWithItems = {
        id: 1,
        status: 'APPROVED',
        branchId: 1,
        departmentId: null,
        costCenterId: null,
        deletedAt: null,
        items: [
          {
            id: 1,
            invoiceId: 1,
            itemId: 10,
            quantity: 5,
            price: 100,
            item: { id: 10, vendorId: 20 },
          },
        ],
        branch: null,
        department: null,
        costCenter: null,
      };

      prismaMock.invoice.findMany.mockResolvedValue([invoiceWithItems] as any);
      prismaMock.$transaction.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.computeDailySpendingMetrics(testDate)).rejects.toThrow(AggregationError);
      expect(mockCacheService.invalidateByPrefix).not.toHaveBeenCalled();
    });

    it('should invalidate cache after successful computation', async () => {
      // Arrange
      const testDate = new Date('2024-01-15');
      const invoiceWithItems = {
        id: 1,
        status: 'APPROVED',
        branchId: null,
        departmentId: null,
        costCenterId: null,
        deletedAt: null,
        items: [
          {
            id: 1,
            invoiceId: 1,
            itemId: 10,
            quantity: 2,
            price: 50,
            item: { id: 10, vendorId: 20 },
          },
        ],
        branch: null,
        department: null,
        costCenter: null,
      };

      prismaMock.invoice.findMany.mockResolvedValue([invoiceWithItems] as any);
      prismaMock.$transaction.mockImplementation(async (cb: any) => {
        return cb({
          spendingMetric: { upsert: vi.fn().mockResolvedValue({}) },
        });
      });

      // Act
      await service.computeDailySpendingMetrics(testDate);

      // Assert
      expect(mockCacheService.invalidateByPrefix).toHaveBeenCalledWith('analytics:spending-metrics');
    });

    it('should aggregate multiple invoice items by dimensions', async () => {
      // Arrange
      const testDate = new Date('2024-01-15');
      const invoicesWithItems = [
        {
          id: 1,
          status: 'APPROVED',
          branchId: 1,
          departmentId: 1,
          costCenterId: 1,
          deletedAt: null,
          items: [
            { id: 1, invoiceId: 1, itemId: 10, quantity: 5, price: 100, item: { id: 10, vendorId: 20 } },
          ],
          branch: { id: 1 },
          department: { id: 1 },
          costCenter: { id: 1 },
        },
        {
          id: 2,
          status: 'APPROVED',
          branchId: 1,
          departmentId: 1,
          costCenterId: 1,
          deletedAt: null,
          items: [
            { id: 2, invoiceId: 2, itemId: 10, quantity: 3, price: 100, item: { id: 10, vendorId: 20 } },
          ],
          branch: { id: 1 },
          department: { id: 1 },
          costCenter: { id: 1 },
        },
      ];

      prismaMock.invoice.findMany.mockResolvedValue(invoicesWithItems as any);

      const upsertMock = vi.fn().mockResolvedValue({});
      prismaMock.$transaction.mockImplementation(async (cb: any) => {
        return cb({ spendingMetric: { upsert: upsertMock } });
      });

      // Act
      await service.computeDailySpendingMetrics(testDate);

      // Assert - Same item/vendor/branch/dept/cost should aggregate
      expect(prismaMock.$transaction).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // computePriceBenchmarks
  // ============================================================================
  describe('computePriceBenchmarks', () => {
    it('should compute price benchmarks from invoice items', async () => {
      // Arrange
      const testDate = new Date('2024-01-15');
      const invoiceItems = [
        {
          id: 1,
          price: 100,
          item: { id: 10, vendorId: 20 },
          invoice: { branchId: 1 },
        },
        {
          id: 2,
          price: 120,
          item: { id: 10, vendorId: 20 },
          invoice: { branchId: 2 },
        },
      ];

      prismaMock.invoiceItem.findMany.mockResolvedValue(invoiceItems as any);

      const createMock = vi.fn().mockResolvedValue({});
      prismaMock.$transaction.mockImplementation(async (cb: any) => {
        return cb({ priceSnapshot: { create: createMock } });
      });

      // Act
      await service.computePriceBenchmarks(testDate);

      // Assert
      expect(prismaMock.invoiceItem.findMany).toHaveBeenCalled();
      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(mockCacheService.invalidateByPrefix).toHaveBeenCalledWith('analytics:price-benchmarks');
      expect(mockPubSub.publish).toHaveBeenCalledWith(
        AnalyticsEvents.PRICE_BENCHMARKS_COMPUTED,
        expect.objectContaining({
          source: 'AggregationService',
        })
      );
    });

    it('should return early when no invoice items found', async () => {
      // Arrange
      const testDate = new Date('2024-01-15');
      prismaMock.invoiceItem.findMany.mockResolvedValue([]);

      // Act
      await service.computePriceBenchmarks(testDate);

      // Assert
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('should handle division by zero when computing variance', async () => {
      // Arrange
      const testDate = new Date('2024-01-15');
      const invoiceItems = [
        {
          id: 1,
          price: 0, // Zero price
          item: { id: 10, vendorId: 20 },
          invoice: { branchId: 1 },
        },
      ];

      prismaMock.invoiceItem.findMany.mockResolvedValue(invoiceItems as any);

      const createMock = vi.fn().mockResolvedValue({});
      prismaMock.$transaction.mockImplementation(async (cb: any) => {
        return cb({ priceSnapshot: { create: createMock } });
      });

      // Act - Should not throw
      await service.computePriceBenchmarks(testDate);

      // Assert
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            varianceFromAvg: 0, // Should be 0, not NaN or Infinity
          }),
        })
      );
    });
  });

  // ============================================================================
  // refreshMaterializedViews
  // ============================================================================
  describe('refreshMaterializedViews', () => {
    it('should refresh metrics for the last 7 days in parallel', async () => {
      // Arrange
      prismaMock.invoice.findMany.mockResolvedValue([]);
      prismaMock.invoiceItem.findMany.mockResolvedValue([]);

      // Act
      await service.refreshMaterializedViews();

      // Assert - Should have called findMany 14 times (7 for spending, 7 for benchmarks)
      expect(prismaMock.invoice.findMany).toHaveBeenCalledTimes(7);
      expect(prismaMock.invoiceItem.findMany).toHaveBeenCalledTimes(7);
    });

    it('should throw AggregationError on failure', async () => {
      // Arrange
      prismaMock.invoice.findMany.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.refreshMaterializedViews()).rejects.toThrow(AggregationError);
    });
  });

  // ============================================================================
  // safeDiv (tested indirectly through computePriceBenchmarks)
  // ============================================================================
  describe('safeDiv edge cases', () => {
    it('should return 0 when dividing by zero', async () => {
      // Arrange
      const testDate = new Date('2024-01-15');
      const invoiceItems = [
        {
          id: 1,
          price: 100,
          item: { id: 10, vendorId: 20 },
          invoice: { branchId: 1 },
        },
      ];

      prismaMock.invoiceItem.findMany.mockResolvedValue(invoiceItems as any);

      const createMock = vi.fn().mockResolvedValue({});
      prismaMock.$transaction.mockImplementation(async (cb: any) => {
        return cb({ priceSnapshot: { create: createMock } });
      });

      // Act
      await service.computePriceBenchmarks(testDate);

      // Assert - Single price means variance should be 0
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            varianceFromAvg: 0,
          }),
        })
      );
    });
  });

  // ============================================================================
  // computeDimensionHash (tested indirectly)
  // ============================================================================
  describe('computeDimensionHash consistency', () => {
    it('should produce consistent hashes for same dimension combinations', async () => {
      // Arrange
      const testDate = new Date('2024-01-15');

      // Two invoices with same dimensions should aggregate
      const invoicesWithItems = [
        {
          id: 1,
          status: 'APPROVED',
          branchId: 1,
          departmentId: null,
          costCenterId: null,
          deletedAt: null,
          items: [{ id: 1, invoiceId: 1, itemId: 10, quantity: 5, price: 100, item: { id: 10, vendorId: 20 } }],
          branch: { id: 1 },
          department: null,
          costCenter: null,
        },
        {
          id: 2,
          status: 'APPROVED',
          branchId: 1,
          departmentId: null,
          costCenterId: null,
          deletedAt: null,
          items: [{ id: 2, invoiceId: 2, itemId: 10, quantity: 3, price: 100, item: { id: 10, vendorId: 20 } }],
          branch: { id: 1 },
          department: null,
          costCenter: null,
        },
      ];

      prismaMock.invoice.findMany.mockResolvedValue(invoicesWithItems as any);

      const upsertMock = vi.fn().mockResolvedValue({});
      prismaMock.$transaction.mockImplementation(async (cb: any) => {
        return cb({ spendingMetric: { upsert: upsertMock } });
      });

      // Act
      await service.computeDailySpendingMetrics(testDate);

      // Assert - Should only create one metric (dimensions aggregate)
      // The upsert should be called once since same dimensions aggregate
      expect(upsertMock).toHaveBeenCalledTimes(1);
      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            totalAmount: 800, // (5*100) + (3*100)
            quantity: 8, // 5 + 3
            invoiceCount: 2,
          }),
        })
      );
    });
  });
});
