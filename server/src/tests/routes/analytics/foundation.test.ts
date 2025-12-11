import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { getPrismaMock } from '../../helpers/prisma-mock';
import {
  createTestUser,
  createTestAdmin,
  createTestToken,
  createTestBranch,
  createTestItem,
  createTestVendor,
} from '../../helpers/test-factories';
import { UserRole } from '@prisma/client';

// Get the mocked prisma instance
const prismaMock = getPrismaMock();

// Mock Redis service for cross-location service
vi.mock('../../../services/infrastructure/redisService', () => ({
  getRedisServiceSingleton: vi.fn().mockResolvedValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
    invalidateByPrefix: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue(true),
  }),
  RedisService: vi.fn(),
}));

// Import router after mocks are set up
import foundationRouter from '../../../routes/analytics/foundation';

describe('Analytics Foundation Routes', () => {
  let app: Express;
  let adminToken: string;
  let userToken: string;
  let viewerToken: string;

  beforeEach(() => {
    vi.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use('/api/analytics/foundation', foundationRouter);

    // Create tokens for different roles
    adminToken = createTestToken(1);
    userToken = createTestToken(2);
    viewerToken = createTestToken(3);

    // Mock user lookups for authentication
    prismaMock.user.findUnique.mockImplementation(async ({ where }) => {
      if (where.id === 1) {
        return createTestAdmin({ id: 1 }) as any;
      }
      if (where.id === 2) {
        return createTestUser({ id: 2, role: UserRole.MANAGER }) as any;
      }
      if (where.id === 3) {
        return createTestUser({ id: 3, role: UserRole.VIEWER }) as any;
      }
      return null;
    });
  });

  // ============================================================================
  // Authentication Tests
  // ============================================================================
  describe('Authentication', () => {
    it('should reject requests without token', async () => {
      // Act
      const response = await request(app).get('/api/analytics/foundation/spending-metrics');

      // Assert
      expect(response.status).toBe(401);
    });

    it('should reject requests with invalid token', async () => {
      // Act
      const response = await request(app)
        .get('/api/analytics/foundation/spending-metrics')
        .set('Authorization', 'Bearer invalid-token');

      // Assert
      expect(response.status).toBe(403);
    });

    it('should accept requests with valid token', async () => {
      // Arrange
      prismaMock.spendingMetric.count.mockResolvedValue(0);
      prismaMock.spendingMetric.findMany.mockResolvedValue([]);
      prismaMock.spendingMetric.aggregate.mockResolvedValue({
        _sum: { totalAmount: 0, invoiceCount: 0, quantity: 0 },
        _avg: { avgUnitPrice: 0 },
      } as any);

      // Act
      const response = await request(app)
        .get('/api/analytics/foundation/spending-metrics')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
    });
  });

  // ============================================================================
  // GET /api/analytics/foundation/spending-metrics
  // ============================================================================
  describe('GET /spending-metrics', () => {
    it('should return paginated spending metrics', async () => {
      // Arrange
      const metrics = [
        {
          id: 1,
          date: new Date(),
          itemId: 1,
          vendorId: 10,
          branchId: 100,
          totalAmount: 1000,
          invoiceCount: 5,
          quantity: 50,
          avgUnitPrice: 20,
          item: { id: 1, name: 'Item 1' },
          vendor: { id: 10, name: 'Vendor 1' },
          branch: { id: 100, name: 'Branch 1' },
          department: null,
          costCenter: null,
        },
      ];

      prismaMock.spendingMetric.count.mockResolvedValue(1);
      prismaMock.spendingMetric.findMany.mockResolvedValue(metrics as any);
      prismaMock.spendingMetric.aggregate.mockResolvedValue({
        _sum: { totalAmount: 1000, invoiceCount: 5, quantity: 50 },
        _avg: { avgUnitPrice: 20 },
      } as any);

      // Act
      const response = await request(app)
        .get('/api/analytics/foundation/spending-metrics')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.summary).toBeDefined();
      expect(response.body.summary.totalSpending).toBe(1000);
    });

    it('should support date range filtering', async () => {
      // Arrange
      prismaMock.spendingMetric.count.mockResolvedValue(0);
      prismaMock.spendingMetric.findMany.mockResolvedValue([]);
      prismaMock.spendingMetric.aggregate.mockResolvedValue({
        _sum: { totalAmount: 0, invoiceCount: 0, quantity: 0 },
        _avg: { avgUnitPrice: 0 },
      } as any);

      // Act
      const response = await request(app)
        .get('/api/analytics/foundation/spending-metrics?startDate=2024-01-01&endDate=2024-01-31')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(prismaMock.spendingMetric.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      );
    });

    it('should support dimension filtering (itemId, vendorId, branchId)', async () => {
      // Arrange
      prismaMock.spendingMetric.count.mockResolvedValue(0);
      prismaMock.spendingMetric.findMany.mockResolvedValue([]);
      prismaMock.spendingMetric.aggregate.mockResolvedValue({
        _sum: { totalAmount: 0, invoiceCount: 0, quantity: 0 },
        _avg: { avgUnitPrice: 0 },
      } as any);

      // Act
      const response = await request(app)
        .get('/api/analytics/foundation/spending-metrics?itemId=1&vendorId=10&branchId=100')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(prismaMock.spendingMetric.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            itemId: 1,
            vendorId: 10,
            branchId: 100,
          }),
        })
      );
    });

    it('should support pagination parameters', async () => {
      // Arrange
      prismaMock.spendingMetric.count.mockResolvedValue(100);
      prismaMock.spendingMetric.findMany.mockResolvedValue([]);
      prismaMock.spendingMetric.aggregate.mockResolvedValue({
        _sum: { totalAmount: 0, invoiceCount: 0, quantity: 0 },
        _avg: { avgUnitPrice: 0 },
      } as any);

      // Act
      const response = await request(app)
        .get('/api/analytics/foundation/spending-metrics?page=3&limit=20')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(3);
      expect(response.body.pagination.limit).toBe(20);
    });

    it('should reject invalid query parameters', async () => {
      // Act
      const response = await request(app)
        .get('/api/analytics/foundation/spending-metrics?page=-1')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(400);
    });
  });

  // ============================================================================
  // GET /api/analytics/foundation/price-variance
  // ============================================================================
  describe('GET /price-variance', () => {
    it('should return price variance data for an item', async () => {
      // Arrange
      prismaMock.priceSnapshot.findMany.mockResolvedValue([
        {
          id: 1,
          itemId: 1,
          vendorId: 10,
          branchId: 100,
          price: 100,
          date: new Date(),
          item: { id: 1, name: 'Item 1' },
          vendor: { id: 10, name: 'Vendor 1' },
          branch: { id: 100, name: 'Branch 1' },
        },
      ] as any);

      // Act
      const response = await request(app)
        .get('/api/analytics/foundation/price-variance?itemId=1')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should require itemId parameter', async () => {
      // Act
      const response = await request(app)
        .get('/api/analytics/foundation/price-variance')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(400);
    });

    it('should support vendorId filter', async () => {
      // Arrange
      prismaMock.priceSnapshot.findMany.mockResolvedValue([]);
      prismaMock.invoiceItem.findMany.mockResolvedValue([]); // Fallback when no snapshots

      // Act
      const response = await request(app)
        .get('/api/analytics/foundation/price-variance?itemId=1&vendorId=10')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(prismaMock.priceSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            vendorId: 10,
          }),
        })
      );
    });
  });

  // ============================================================================
  // GET /api/analytics/foundation/purchase-patterns
  // ============================================================================
  describe('GET /purchase-patterns', () => {
    it('should return paginated purchase patterns', async () => {
      // Arrange
      const patterns = [
        {
          id: 1,
          itemId: 1,
          branchId: null,
          avgOrderCycleDays: 14,
          avgOrderQuantity: 100,
          confidenceScore: 0.8,
          item: { id: 1, name: 'Item 1' },
          branch: null,
        },
      ];

      prismaMock.purchasePattern.count.mockResolvedValue(1);
      prismaMock.purchasePattern.findMany.mockResolvedValue(patterns as any);

      // Act
      const response = await request(app)
        .get('/api/analytics/foundation/purchase-patterns')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination).toBeDefined();
    });

    it('should support itemId filtering', async () => {
      // Arrange
      prismaMock.purchasePattern.count.mockResolvedValue(0);
      prismaMock.purchasePattern.findMany.mockResolvedValue([]);

      // Act
      const response = await request(app)
        .get('/api/analytics/foundation/purchase-patterns?itemId=1')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(prismaMock.purchasePattern.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            itemId: 1,
          }),
        })
      );
    });

    it('should support branchId filtering', async () => {
      // Arrange
      prismaMock.purchasePattern.count.mockResolvedValue(0);
      prismaMock.purchasePattern.findMany.mockResolvedValue([]);

      // Act
      const response = await request(app)
        .get('/api/analytics/foundation/purchase-patterns?branchId=100')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
    });
  });

  // ============================================================================
  // GET /api/analytics/foundation/benchmarks/:itemId
  // ============================================================================
  describe('GET /benchmarks/:itemId', () => {
    it('should return benchmark stats for an item', async () => {
      // Arrange
      prismaMock.priceSnapshot.findMany.mockResolvedValue([
        { id: 1, itemId: 1, branchId: 1, price: 100, date: new Date() },
        { id: 2, itemId: 1, branchId: 2, price: 120, date: new Date() },
      ] as any);

      // Act
      const response = await request(app)
        .get('/api/analytics/foundation/benchmarks/1')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.avgPrice).toBeDefined();
      expect(response.body.minPrice).toBeDefined();
      expect(response.body.maxPrice).toBeDefined();
    });

    it('should return 404 when no benchmark data available', async () => {
      // Arrange
      prismaMock.priceSnapshot.findMany.mockResolvedValue([]);
      prismaMock.invoiceItem.findMany.mockResolvedValue([]);

      // Act
      const response = await request(app)
        .get('/api/analytics/foundation/benchmarks/999')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Benchmark data not found');
    });

    it('should reject invalid itemId parameter', async () => {
      // Act
      const response = await request(app)
        .get('/api/analytics/foundation/benchmarks/invalid')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(400);
    });
  });

  // ============================================================================
  // GET /api/analytics/foundation/consolidation-opportunities
  // ============================================================================
  describe('GET /consolidation-opportunities', () => {
    it('should return consolidation opportunities', async () => {
      // Arrange
      prismaMock.spendingMetric.findMany.mockResolvedValue([
        {
          id: 1,
          itemId: 1,
          vendorId: 10,
          branchId: 100,
          totalAmount: 1000,
          item: { id: 1, name: 'Item 1', vendorId: 10 },
          vendor: { id: 10, name: 'Vendor 1' },
          branch: { id: 100, name: 'Branch 1' },
        },
        {
          id: 2,
          itemId: 1,
          vendorId: 20,
          branchId: 200,
          totalAmount: 1500,
          item: { id: 1, name: 'Item 1', vendorId: 20 },
          vendor: { id: 20, name: 'Vendor 2' },
          branch: { id: 200, name: 'Branch 2' },
        },
      ] as any);

      // Act
      const response = await request(app)
        .get('/api/analytics/foundation/consolidation-opportunities')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return empty array when no opportunities exist', async () => {
      // Arrange
      prismaMock.spendingMetric.findMany.mockResolvedValue([]);

      // Act
      const response = await request(app)
        .get('/api/analytics/foundation/consolidation-opportunities')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================
  describe('Error Handling', () => {
    it('should return 500 on database errors', async () => {
      // Arrange
      prismaMock.spendingMetric.count.mockRejectedValue(new Error('Database error'));

      // Act
      const response = await request(app)
        .get('/api/analytics/foundation/spending-metrics')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
    });
  });
});
