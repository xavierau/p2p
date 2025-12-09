import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { getPrismaMock } from '../helpers/prisma-mock';
import {
  createTestPurchaseOrder,
  createTestPurchaseOrderItem,
  createTestVendor,
  createTestUser,
  createTestAdmin,
  createTestToken,
} from '../helpers/test-factories';
import { UserRole } from '@prisma/client';

// Get the mocked prisma instance
const prismaMock = getPrismaMock();

// Import router after mocks are set up
import purchaseOrderRouter from '../../routes/purchaseOrders';

describe('Purchase Order Routes', () => {
  let app: Express;
  let adminToken: string;
  let userToken: string;
  let viewerToken: string;

  beforeEach(() => {
    vi.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use('/api/purchase-orders', purchaseOrderRouter);

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
        return createTestUser({ id: 2, role: UserRole.USER }) as any;
      }
      if (where.id === 3) {
        return createTestUser({ id: 3, role: UserRole.VIEWER }) as any;
      }
      return null;
    });
  });

  // ==========================================================================
  // Authentication Tests
  // ==========================================================================
  describe('Authentication', () => {
    it('should reject requests without token', async () => {
      // Act
      const response = await request(app).get('/api/purchase-orders');

      // Assert
      expect(response.status).toBe(401);
    });

    it('should reject requests with invalid token', async () => {
      // Act
      const response = await request(app)
        .get('/api/purchase-orders')
        .set('Authorization', 'Bearer invalid-token');

      // Assert
      expect(response.status).toBe(403);
    });

    it('should accept requests with valid token', async () => {
      // Arrange
      prismaMock.purchaseOrder.count.mockResolvedValue(0);
      prismaMock.purchaseOrder.findMany.mockResolvedValue([]);

      // Act
      const response = await request(app)
        .get('/api/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
    });
  });

  // ==========================================================================
  // GET /api/purchase-orders
  // ==========================================================================
  describe('GET /api/purchase-orders', () => {
    it('should return paginated purchase orders', async () => {
      // Arrange
      const pos = [
        createTestPurchaseOrder({ id: 1 }),
        createTestPurchaseOrder({ id: 2 }),
      ];
      prismaMock.purchaseOrder.count.mockResolvedValue(2);
      prismaMock.purchaseOrder.findMany.mockResolvedValue(pos as any);

      // Act
      const response = await request(app)
        .get('/api/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination).toBeDefined();
    });

    it('should support status filtering', async () => {
      // Arrange
      prismaMock.purchaseOrder.count.mockResolvedValue(1);
      prismaMock.purchaseOrder.findMany.mockResolvedValue([
        createTestPurchaseOrder({ status: 'SENT' }),
      ] as any);

      // Act
      const response = await request(app)
        .get('/api/purchase-orders?status=SENT')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(prismaMock.purchaseOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'SENT',
          }),
        })
      );
    });

    it('should support vendor filtering', async () => {
      // Arrange
      prismaMock.purchaseOrder.count.mockResolvedValue(1);
      prismaMock.purchaseOrder.findMany.mockResolvedValue([
        createTestPurchaseOrder({ vendorId: 5 }),
      ] as any);

      // Act
      const response = await request(app)
        .get('/api/purchase-orders?vendorId=5')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(prismaMock.purchaseOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            vendorId: 5,
          }),
        })
      );
    });
  });

  // ==========================================================================
  // GET /api/purchase-orders/:id
  // ==========================================================================
  describe('GET /api/purchase-orders/:id', () => {
    it('should return purchase order by id', async () => {
      // Arrange
      const po = createTestPurchaseOrder({ id: 1 });
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(po as any);

      // Act
      const response = await request(app)
        .get('/api/purchase-orders/1')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(1);
    });

    it('should return 404 for non-existent purchase order', async () => {
      // Arrange
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .get('/api/purchase-orders/999')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Purchase order not found');
    });
  });

  // ==========================================================================
  // POST /api/purchase-orders
  // ==========================================================================
  describe('POST /api/purchase-orders', () => {
    const validPOData = {
      vendorId: 1,
      items: [
        { itemId: 1, quantity: 10, price: 50.0 },
      ],
    };

    it('should create purchase order with valid data', async () => {
      // Arrange
      const vendor = createTestVendor({ id: 1 });
      const createdPO = createTestPurchaseOrder({
        id: 1,
        vendorId: 1,
        status: 'DRAFT',
        vendor,
      });
      prismaMock.purchaseOrder.create.mockResolvedValue(createdPO as any);

      // Act
      const response = await request(app)
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validPOData);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.vendorId).toBe(1);
      expect(response.body.status).toBe('DRAFT');
    });

    it('should reject request without vendorId', async () => {
      // Act
      const response = await request(app)
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ items: [{ itemId: 1, quantity: 1, price: 100 }] });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should reject request without items', async () => {
      // Act
      const response = await request(app)
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ vendorId: 1 });

      // Assert
      expect(response.status).toBe(400);
    });

    it('should reject request with empty items array', async () => {
      // Act
      const response = await request(app)
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ vendorId: 1, items: [] });

      // Assert
      expect(response.status).toBe(400);
    });
  });

  // ==========================================================================
  // PUT /api/purchase-orders/:id
  // ==========================================================================
  describe('PUT /api/purchase-orders/:id', () => {
    it('should update purchase order in DRAFT status', async () => {
      // Arrange
      const existingPO = createTestPurchaseOrder({ id: 1, status: 'DRAFT', vendorId: 1 });
      const updatedPO = { ...existingPO, vendorId: 2 };

      prismaMock.purchaseOrder.findFirst.mockResolvedValue(existingPO as any);
      prismaMock.purchaseOrder.update.mockResolvedValue(updatedPO as any);

      // Act
      const response = await request(app)
        .put('/api/purchase-orders/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ vendorId: 2 });

      // Assert
      expect(response.status).toBe(200);
    });

    it('should return 400 when updating non-DRAFT purchase order', async () => {
      // Arrange
      const existingPO = createTestPurchaseOrder({ id: 1, status: 'SENT' });
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(existingPO as any);

      // Act
      const response = await request(app)
        .put('/api/purchase-orders/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ vendorId: 2 });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('only update');
    });

    it('should return 404 for non-existent purchase order', async () => {
      // Arrange
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .put('/api/purchase-orders/999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ vendorId: 2 });

      // Assert
      expect(response.status).toBe(404);
    });
  });

  // ==========================================================================
  // PUT /api/purchase-orders/:id/status
  // ==========================================================================
  describe('PUT /api/purchase-orders/:id/status', () => {
    it('should update status with valid transition DRAFT -> SENT', async () => {
      // Arrange
      const existingPO = createTestPurchaseOrder({ id: 1, status: 'DRAFT' });
      const updatedPO = { ...existingPO, status: 'SENT' };

      prismaMock.purchaseOrder.findFirst.mockResolvedValue(existingPO as any);
      prismaMock.purchaseOrder.update.mockResolvedValue(updatedPO as any);

      // Act
      const response = await request(app)
        .put('/api/purchase-orders/1/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'SENT' });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('SENT');
    });

    it('should update status with valid transition SENT -> FULFILLED', async () => {
      // Arrange
      const existingPO = createTestPurchaseOrder({ id: 1, status: 'SENT' });
      const updatedPO = { ...existingPO, status: 'FULFILLED' };

      prismaMock.purchaseOrder.findFirst.mockResolvedValue(existingPO as any);
      prismaMock.purchaseOrder.update.mockResolvedValue(updatedPO as any);

      // Act
      const response = await request(app)
        .put('/api/purchase-orders/1/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'FULFILLED' });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('FULFILLED');
    });

    it('should return 400 for invalid status transition', async () => {
      // Arrange
      const existingPO = createTestPurchaseOrder({ id: 1, status: 'DRAFT' });
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(existingPO as any);

      // Act
      const response = await request(app)
        .put('/api/purchase-orders/1/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'FULFILLED' }); // Invalid: DRAFT -> FULFILLED

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid status');
    });

    it('should return 400 when status is missing', async () => {
      // Act
      const response = await request(app)
        .put('/api/purchase-orders/1/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required field: status');
    });

    it('should return 404 for non-existent purchase order', async () => {
      // Arrange
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .put('/api/purchase-orders/999/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'SENT' });

      // Assert
      expect(response.status).toBe(404);
    });
  });

  // ==========================================================================
  // DELETE /api/purchase-orders/:id
  // ==========================================================================
  describe('DELETE /api/purchase-orders/:id', () => {
    it('should soft delete purchase order', async () => {
      // Arrange
      const po = createTestPurchaseOrder({ id: 1 });
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(po as any);
      prismaMock.purchaseOrder.update.mockResolvedValue({
        ...po,
        deletedAt: new Date(),
      } as any);

      // Act
      const response = await request(app)
        .delete('/api/purchase-orders/1')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(204);
    });

    it('should return 404 for non-existent purchase order', async () => {
      // Arrange
      prismaMock.purchaseOrder.findFirst.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .delete('/api/purchase-orders/999')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(404);
    });

    it('should require PO_DELETE permission', async () => {
      // Act - Regular user doesn't have delete permission
      const response = await request(app)
        .delete('/api/purchase-orders/1')
        .set('Authorization', `Bearer ${userToken}`);

      // Assert
      expect(response.status).toBe(403);
    });
  });

  // ==========================================================================
  // Authorization Tests
  // ==========================================================================
  describe('Authorization', () => {
    beforeEach(() => {
      prismaMock.purchaseOrder.count.mockResolvedValue(0);
      prismaMock.purchaseOrder.findMany.mockResolvedValue([]);
    });

    it('should allow ADMIN to access all endpoints', async () => {
      // Act
      const response = await request(app)
        .get('/api/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
    });

    it('should allow USER to read purchase orders', async () => {
      // Act
      const response = await request(app)
        .get('/api/purchase-orders')
        .set('Authorization', `Bearer ${userToken}`);

      // Assert
      expect(response.status).toBe(200);
    });

    it('should allow VIEWER to read purchase orders', async () => {
      // Act
      const response = await request(app)
        .get('/api/purchase-orders')
        .set('Authorization', `Bearer ${viewerToken}`);

      // Assert
      expect(response.status).toBe(200);
    });

    it('should deny VIEWER from creating purchase orders', async () => {
      // Act
      const response = await request(app)
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ vendorId: 1, items: [{ itemId: 1, quantity: 1, price: 100 }] });

      // Assert
      expect(response.status).toBe(403);
    });

    it('should deny USER from updating purchase orders', async () => {
      // Act
      const response = await request(app)
        .put('/api/purchase-orders/1')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ vendorId: 2 });

      // Assert
      expect(response.status).toBe(403);
    });

    it('should deny USER from changing purchase order status', async () => {
      // Act
      const response = await request(app)
        .put('/api/purchase-orders/1/status')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'SENT' });

      // Assert
      expect(response.status).toBe(403);
    });
  });
});
