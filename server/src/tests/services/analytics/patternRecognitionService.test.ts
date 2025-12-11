import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getPrismaMock } from '../../helpers/prisma-mock';
import { createTestInvoice, createTestInvoiceItem } from '../../helpers/test-factories';
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
import { PatternRecognitionService, createPatternRecognitionService } from '../../../services/analytics/patternRecognitionService';
import { PatternRecognitionError } from '../../../errors/AnalyticsError';

describe('PatternRecognitionService', () => {
  let service: PatternRecognitionService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheService.get.mockResolvedValue(null); // Default: no cache hit
    service = createPatternRecognitionService(
      prismaMock as any,
      mockCacheService as any,
      mockPubSub as any
    );
  });

  // ============================================================================
  // analyzePurchasePattern
  // ============================================================================
  describe('analyzePurchasePattern', () => {
    it('should return null when insufficient data (< 5 invoices)', async () => {
      // Arrange
      const itemId = 1;
      const invoiceItems = [
        { invoiceId: 1, invoice: { id: 1, date: new Date('2024-01-01') }, quantity: 10, price: 100 },
        { invoiceId: 2, invoice: { id: 2, date: new Date('2024-01-15') }, quantity: 12, price: 100 },
      ];

      prismaMock.invoiceItem.findMany.mockResolvedValue(invoiceItems as any);

      // Act
      const result = await service.analyzePurchasePattern(itemId);

      // Assert
      expect(result).toBeNull();
      expect(prismaMock.purchasePattern.upsert).not.toHaveBeenCalled();
    });

    it('should detect order cycle from sufficient data', async () => {
      // Arrange
      const itemId = 1;
      // Create 6 orders with ~14 day intervals
      const baseDate = new Date('2024-01-01');
      const invoiceItems = Array.from({ length: 6 }, (_, i) => ({
        invoiceId: i + 1,
        invoice: {
          id: i + 1,
          date: new Date(baseDate.getTime() + i * 14 * 24 * 60 * 60 * 1000),
        },
        quantity: 10,
        price: 100,
      }));

      prismaMock.invoiceItem.findMany.mockResolvedValue(invoiceItems as any);
      prismaMock.purchasePattern.upsert.mockResolvedValue({
        id: 1,
        itemId,
        branchId: null,
        avgOrderCycleDays: 14,
        avgOrderQuantity: 10,
        avgOrderAmount: 1000,
        stdDevQuantity: 0,
        stdDevAmount: 0,
        isIncreasing: false,
        isDecreasing: false,
        isSeasonal: false,
        seasonalityPattern: null,
        lastOrderDate: new Date(),
        nextPredictedOrder: new Date(),
        confidenceScore: 0.5,
        basedOnInvoices: 6,
        analysisStartDate: new Date(),
        analysisEndDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      // Act
      const result = await service.analyzePurchasePattern(itemId);

      // Assert
      expect(result).not.toBeNull();
      expect(prismaMock.purchasePattern.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            itemId,
            avgOrderCycleDays: expect.any(Number),
          }),
        })
      );
      expect(mockPubSub.publish).toHaveBeenCalledWith(
        AnalyticsEvents.PATTERN_DETECTED,
        expect.objectContaining({
          itemId,
          source: 'PatternRecognitionService',
        })
      );
    });

    it('should detect increasing trend when last third > first third by 10%+', async () => {
      // Arrange
      const itemId = 1;
      // Create orders with increasing amounts
      const invoiceItems = [
        { invoiceId: 1, invoice: { id: 1, date: new Date('2024-01-01') }, quantity: 10, price: 100 },
        { invoiceId: 2, invoice: { id: 2, date: new Date('2024-01-15') }, quantity: 10, price: 100 },
        { invoiceId: 3, invoice: { id: 3, date: new Date('2024-02-01') }, quantity: 10, price: 100 },
        { invoiceId: 4, invoice: { id: 4, date: new Date('2024-02-15') }, quantity: 15, price: 100 },
        { invoiceId: 5, invoice: { id: 5, date: new Date('2024-03-01') }, quantity: 20, price: 100 },
        { invoiceId: 6, invoice: { id: 6, date: new Date('2024-03-15') }, quantity: 25, price: 100 },
      ];

      prismaMock.invoiceItem.findMany.mockResolvedValue(invoiceItems as any);
      prismaMock.purchasePattern.upsert.mockResolvedValue({
        id: 1,
        itemId,
        branchId: null,
        isIncreasing: true,
        isDecreasing: false,
      } as any);

      // Act
      const result = await service.analyzePurchasePattern(itemId);

      // Assert
      expect(prismaMock.purchasePattern.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            isIncreasing: true,
            isDecreasing: false,
          }),
        })
      );
    });

    it('should detect decreasing trend when last third < first third by 10%+', async () => {
      // Arrange
      const itemId = 1;
      // Create orders with decreasing amounts
      const invoiceItems = [
        { invoiceId: 1, invoice: { id: 1, date: new Date('2024-01-01') }, quantity: 25, price: 100 },
        { invoiceId: 2, invoice: { id: 2, date: new Date('2024-01-15') }, quantity: 20, price: 100 },
        { invoiceId: 3, invoice: { id: 3, date: new Date('2024-02-01') }, quantity: 15, price: 100 },
        { invoiceId: 4, invoice: { id: 4, date: new Date('2024-02-15') }, quantity: 12, price: 100 },
        { invoiceId: 5, invoice: { id: 5, date: new Date('2024-03-01') }, quantity: 10, price: 100 },
        { invoiceId: 6, invoice: { id: 6, date: new Date('2024-03-15') }, quantity: 8, price: 100 },
      ];

      prismaMock.invoiceItem.findMany.mockResolvedValue(invoiceItems as any);
      prismaMock.purchasePattern.upsert.mockResolvedValue({
        id: 1,
        itemId,
        branchId: null,
        isIncreasing: false,
        isDecreasing: true,
      } as any);

      // Act
      await service.analyzePurchasePattern(itemId);

      // Assert
      expect(prismaMock.purchasePattern.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            isDecreasing: true,
            isIncreasing: false,
          }),
        })
      );
    });

    it('should not detect seasonality with < 12 data points', async () => {
      // Arrange
      const itemId = 1;
      const invoiceItems = Array.from({ length: 6 }, (_, i) => ({
        invoiceId: i + 1,
        invoice: { id: i + 1, date: new Date(`2024-0${i + 1}-01`) },
        quantity: 10,
        price: 100,
      }));

      prismaMock.invoiceItem.findMany.mockResolvedValue(invoiceItems as any);
      prismaMock.purchasePattern.upsert.mockResolvedValue({
        id: 1,
        itemId,
        isSeasonal: false,
        seasonalityPattern: null,
      } as any);

      // Act
      await service.analyzePurchasePattern(itemId);

      // Assert
      expect(prismaMock.purchasePattern.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            isSeasonal: false,
            seasonalityPattern: null,
          }),
        })
      );
    });

    it('should compute confidence score based on data quality', async () => {
      // Arrange
      const itemId = 1;
      const invoiceItems = Array.from({ length: 20 }, (_, i) => ({
        invoiceId: i + 1,
        invoice: {
          id: i + 1,
          date: new Date(Date.now() - (20 - i) * 7 * 24 * 60 * 60 * 1000), // Weekly orders
        },
        quantity: 10,
        price: 100,
      }));

      prismaMock.invoiceItem.findMany.mockResolvedValue(invoiceItems as any);
      prismaMock.purchasePattern.upsert.mockResolvedValue({
        id: 1,
        itemId,
        confidenceScore: 0.7,
      } as any);

      // Act
      await service.analyzePurchasePattern(itemId);

      // Assert
      expect(prismaMock.purchasePattern.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            confidenceScore: expect.any(Number),
          }),
        })
      );
    });

    it('should return cached pattern if available', async () => {
      // Arrange
      const itemId = 1;
      const cachedPattern = {
        id: 1,
        itemId,
        avgOrderCycleDays: 14,
      };
      mockCacheService.get.mockResolvedValue(cachedPattern);

      // Act
      const result = await service.analyzePurchasePattern(itemId);

      // Assert
      expect(result).toEqual(cachedPattern);
      expect(prismaMock.invoiceItem.findMany).not.toHaveBeenCalled();
    });

    it('should filter by branchId when provided', async () => {
      // Arrange
      const itemId = 1;
      const branchId = 5;
      prismaMock.invoiceItem.findMany.mockResolvedValue([]);

      // Act
      await service.analyzePurchasePattern(itemId, branchId);

      // Assert
      expect(prismaMock.invoiceItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            itemId,
            invoice: expect.objectContaining({
              branchId,
            }),
          }),
        })
      );
    });

    it('should handle single order gracefully (no cycle)', async () => {
      // Arrange
      const itemId = 1;
      const invoiceItems = [
        { invoiceId: 1, invoice: { id: 1, date: new Date('2024-01-01') }, quantity: 10, price: 100 },
      ];

      prismaMock.invoiceItem.findMany.mockResolvedValue(invoiceItems as any);

      // Act
      const result = await service.analyzePurchasePattern(itemId);

      // Assert
      expect(result).toBeNull(); // Insufficient data
    });

    it('should handle no orders gracefully', async () => {
      // Arrange
      const itemId = 1;
      prismaMock.invoiceItem.findMany.mockResolvedValue([]);

      // Act
      const result = await service.analyzePurchasePattern(itemId);

      // Assert
      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // predictNextOrder
  // ============================================================================
  describe('predictNextOrder', () => {
    it('should return existing pattern prediction if available', async () => {
      // Arrange
      const itemId = 1;
      const nextDate = new Date('2024-02-15');
      prismaMock.purchasePattern.findUnique.mockResolvedValue({
        id: 1,
        itemId,
        nextPredictedOrder: nextDate,
      } as any);

      // Act
      const result = await service.predictNextOrder(itemId);

      // Assert
      expect(result).toEqual(nextDate);
    });

    it('should analyze pattern if none exists and return prediction', async () => {
      // Arrange
      const itemId = 1;
      prismaMock.purchasePattern.findUnique.mockResolvedValue(null);

      // Mock insufficient data for analysis
      prismaMock.invoiceItem.findMany.mockResolvedValue([]);

      // Act
      const result = await service.predictNextOrder(itemId);

      // Assert
      expect(result).toBeNull();
    });

    it('should throw PatternRecognitionError on failure', async () => {
      // Arrange
      const itemId = 1;
      prismaMock.purchasePattern.findUnique.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.predictNextOrder(itemId)).rejects.toThrow(PatternRecognitionError);
    });
  });

  // ============================================================================
  // detectAnomalies
  // ============================================================================
  describe('detectAnomalies', () => {
    it('should return empty array when no pattern exists and cannot create one', async () => {
      // Arrange
      const itemId = 1;
      prismaMock.purchasePattern.findUnique.mockResolvedValue(null);
      prismaMock.invoiceItem.findMany.mockResolvedValue([]);

      // Act
      const result = await service.detectAnomalies(itemId);

      // Assert
      expect(result).toEqual([]);
    });

    it('should detect quantity anomaly when deviation > threshold', async () => {
      // Arrange
      const itemId = 1;
      const pattern = {
        id: 1,
        itemId,
        avgOrderQuantity: 10,
        avgOrderAmount: 1000,
        stdDevQuantity: 2,
        stdDevAmount: 200,
      };
      prismaMock.purchasePattern.findUnique.mockResolvedValue(pattern as any);

      // Order with quantity deviation > 2 std devs
      const invoiceItems = [
        { invoiceId: 1, invoice: { id: 1, date: new Date('2024-01-01') }, quantity: 20, price: 100 }, // Anomaly
        { invoiceId: 2, invoice: { id: 2, date: new Date('2024-01-15') }, quantity: 10, price: 100 }, // Normal
      ];
      prismaMock.invoiceItem.findMany.mockResolvedValue(invoiceItems as any);

      // Act
      const result = await service.detectAnomalies(itemId);

      // Assert - Both qty and amount are anomalous due to high deviation
      expect(result.length).toBeGreaterThan(0);
      expect(result.find(a => a.invoiceId === 1)).toBeDefined();
      // The anomaly may be detected as BOTH since the amount (2000) is also anomalous
      expect(['QUANTITY_ANOMALY', 'BOTH']).toContain(result.find(a => a.invoiceId === 1)?.type);
    });

    it('should detect amount anomaly when deviation > threshold', async () => {
      // Arrange
      const itemId = 1;
      const pattern = {
        id: 1,
        itemId,
        avgOrderQuantity: 10,
        avgOrderAmount: 1000,
        stdDevQuantity: 2,
        stdDevAmount: 100,
      };
      prismaMock.purchasePattern.findUnique.mockResolvedValue(pattern as any);

      // Order with amount deviation > 2 std devs
      const invoiceItems = [
        { invoiceId: 1, invoice: { id: 1, date: new Date('2024-01-01') }, quantity: 10, price: 150 }, // Amount = 1500, anomaly
      ];
      prismaMock.invoiceItem.findMany.mockResolvedValue(invoiceItems as any);

      // Act
      const result = await service.detectAnomalies(itemId);

      // Assert
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toMatch(/AMOUNT/);
    });

    it('should handle zero standard deviation gracefully', async () => {
      // Arrange
      const itemId = 1;
      const pattern = {
        id: 1,
        itemId,
        avgOrderQuantity: 10,
        avgOrderAmount: 1000,
        stdDevQuantity: 0, // Zero std dev
        stdDevAmount: 0,
      };
      prismaMock.purchasePattern.findUnique.mockResolvedValue(pattern as any);

      const invoiceItems = [
        { invoiceId: 1, invoice: { id: 1, date: new Date('2024-01-01') }, quantity: 100, price: 100 },
      ];
      prismaMock.invoiceItem.findMany.mockResolvedValue(invoiceItems as any);

      // Act - Should not throw or produce NaN deviations
      const result = await service.detectAnomalies(itemId);

      // Assert - With 0 stdDev, deviation formula returns 0, so no anomalies detected
      expect(result).toEqual([]);
    });

    it('should publish event for each detected anomaly', async () => {
      // Arrange
      const itemId = 1;
      const pattern = {
        id: 1,
        itemId,
        avgOrderQuantity: 10,
        avgOrderAmount: 1000,
        stdDevQuantity: 1,
        stdDevAmount: 50,
      };
      prismaMock.purchasePattern.findUnique.mockResolvedValue(pattern as any);

      // Two anomalous orders
      const invoiceItems = [
        { invoiceId: 1, invoice: { id: 1, date: new Date('2024-01-01') }, quantity: 20, price: 100 },
        { invoiceId: 2, invoice: { id: 2, date: new Date('2024-01-15') }, quantity: 25, price: 100 },
      ];
      prismaMock.invoiceItem.findMany.mockResolvedValue(invoiceItems as any);

      // Act
      await service.detectAnomalies(itemId);

      // Assert
      expect(mockPubSub.publish).toHaveBeenCalledWith(
        AnalyticsEvents.ANOMALY_DETECTED,
        expect.objectContaining({
          itemId,
          source: 'PatternRecognitionService',
        })
      );
    });

    it('should return cached anomalies if available', async () => {
      // Arrange
      const itemId = 1;
      const cachedAnomalies = [
        { invoiceId: 1, type: 'QUANTITY_ANOMALY' },
      ];
      mockCacheService.get.mockResolvedValue(cachedAnomalies);

      // Act
      const result = await service.detectAnomalies(itemId);

      // Assert
      expect(result).toEqual(cachedAnomalies);
      expect(prismaMock.purchasePattern.findUnique).not.toHaveBeenCalled();
    });

    it('should detect BOTH type when quantity and amount are anomalous', async () => {
      // Arrange
      const itemId = 1;
      const pattern = {
        id: 1,
        itemId,
        avgOrderQuantity: 10,
        avgOrderAmount: 1000,
        stdDevQuantity: 1,
        stdDevAmount: 50,
      };
      prismaMock.purchasePattern.findUnique.mockResolvedValue(pattern as any);

      // Order that is anomalous in both quantity and amount
      const invoiceItems = [
        { invoiceId: 1, invoice: { id: 1, date: new Date('2024-01-01') }, quantity: 20, price: 200 }, // qty=20, amount=4000
      ];
      prismaMock.invoiceItem.findMany.mockResolvedValue(invoiceItems as any);

      // Act
      const result = await service.detectAnomalies(itemId);

      // Assert
      expect(result.length).toBe(1);
      expect(result[0].type).toBe('BOTH');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================
  describe('edge cases', () => {
    it('should handle less than 3 orders for trend detection', async () => {
      // Arrange - 2 orders is insufficient for trend
      const itemId = 1;
      const invoiceItems = [
        { invoiceId: 1, invoice: { id: 1, date: new Date('2024-01-01') }, quantity: 10, price: 100 },
        { invoiceId: 2, invoice: { id: 2, date: new Date('2024-01-15') }, quantity: 20, price: 100 },
      ];

      prismaMock.invoiceItem.findMany.mockResolvedValue(invoiceItems as any);

      // Act
      const result = await service.analyzePurchasePattern(itemId);

      // Assert
      expect(result).toBeNull(); // Less than MIN_INVOICES_FOR_PATTERN (5)
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const itemId = 1;
      prismaMock.invoiceItem.findMany.mockRejectedValue(new Error('Connection lost'));

      // Act & Assert
      await expect(service.analyzePurchasePattern(itemId)).rejects.toThrow(PatternRecognitionError);
    });
  });
});
