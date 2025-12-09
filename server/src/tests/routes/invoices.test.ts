import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { getPrismaMock } from '../helpers/prisma-mock';
import {
  createTestInvoice,
  createTestInvoiceItem,
  createTestUser,
  createTestAdmin,
  createTestToken,
} from '../helpers/test-factories';
import { UserRole } from '@prisma/client';

// Get the mocked prisma instance
const prismaMock = getPrismaMock();

// Import router after mocks are set up
import invoiceRouter from '../../routes/invoices';
import { authenticateToken } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { Permission } from '../../constants/permissions';

describe('Invoice Routes', () => {
  let app: Express;
  let adminToken: string;
  let userToken: string;
  let viewerToken: string;

  beforeEach(() => {
    vi.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use('/api/invoices', invoiceRouter);

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
      const response = await request(app).get('/api/invoices');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });

    it('should reject requests with invalid token', async () => {
      // Act
      const response = await request(app)
        .get('/api/invoices')
        .set('Authorization', 'Bearer invalid-token');

      // Assert
      expect(response.status).toBe(403);
    });

    it('should accept requests with valid token', async () => {
      // Arrange
      prismaMock.invoice.count.mockResolvedValue(0);
      prismaMock.invoice.findMany.mockResolvedValue([]);

      // Act
      const response = await request(app)
        .get('/api/invoices')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
    });
  });

  // ==========================================================================
  // GET /api/invoices
  // ==========================================================================
  describe('GET /api/invoices', () => {
    it('should return paginated invoices', async () => {
      // Arrange
      const invoices = [
        createTestInvoice({ id: 1 }),
        createTestInvoice({ id: 2 }),
      ];
      prismaMock.invoice.count.mockResolvedValue(2);
      prismaMock.invoice.findMany.mockResolvedValue(invoices as any);

      // Act
      const response = await request(app)
        .get('/api/invoices')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination).toBeDefined();
    });

    it('should support status filtering', async () => {
      // Arrange
      prismaMock.invoice.count.mockResolvedValue(1);
      prismaMock.invoice.findMany.mockResolvedValue([
        createTestInvoice({ status: 'APPROVED' }),
      ] as any);

      // Act
      const response = await request(app)
        .get('/api/invoices?status=APPROVED')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(prismaMock.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'APPROVED',
          }),
        })
      );
    });

    it('should support pagination parameters', async () => {
      // Arrange
      prismaMock.invoice.count.mockResolvedValue(100);
      prismaMock.invoice.findMany.mockResolvedValue([]);

      // Act
      const response = await request(app)
        .get('/api/invoices?page=3&limit=20')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(prismaMock.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 40,
          take: 20,
        })
      );
    });
  });

  // ==========================================================================
  // GET /api/invoices/:id
  // ==========================================================================
  describe('GET /api/invoices/:id', () => {
    it('should return invoice by id', async () => {
      // Arrange
      const invoice = createTestInvoice({ id: 1 });
      prismaMock.invoice.findFirst.mockResolvedValue(invoice as any);

      // Act
      const response = await request(app)
        .get('/api/invoices/1')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(1);
    });

    it('should return 404 for non-existent invoice', async () => {
      // Arrange
      prismaMock.invoice.findFirst.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .get('/api/invoices/999')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Invoice not found');
    });

    it('should validate id parameter is numeric', async () => {
      // Act
      const response = await request(app)
        .get('/api/invoices/abc')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(400);
    });
  });

  // ==========================================================================
  // POST /api/invoices
  // ==========================================================================
  describe('POST /api/invoices', () => {
    const validInvoiceData = {
      items: [
        { itemId: 1, quantity: 2, price: 100.0 },
      ],
      project: 'Test Project',
    };

    it('should create invoice with valid data', async () => {
      // Arrange
      const createdInvoice = createTestInvoice({
        id: 1,
        totalAmount: 200,
        project: 'Test Project',
        items: [createTestInvoiceItem({ itemId: 1, quantity: 2, price: 100 })],
      });
      prismaMock.invoice.create.mockResolvedValue(createdInvoice as any);

      // Act
      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validInvoiceData);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.totalAmount).toBe(200);
    });

    it('should reject request without items', async () => {
      // Act
      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ project: 'Test Project' });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Items are required');
    });

    it('should reject request with empty items array', async () => {
      // Act
      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ items: [] });

      // Assert
      expect(response.status).toBe(400);
    });

    it('should associate invoice with authenticated user', async () => {
      // Arrange
      const createdInvoice = createTestInvoice({ id: 1, userId: 1 });
      prismaMock.invoice.create.mockResolvedValue(createdInvoice as any);

      // Act
      await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validInvoiceData);

      // Assert
      expect(prismaMock.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 1,
          }),
        })
      );
    });
  });

  // ==========================================================================
  // PUT /api/invoices/:id/approve
  // ==========================================================================
  describe('PUT /api/invoices/:id/approve', () => {
    it('should approve invoice', async () => {
      // Arrange
      const approvedInvoice = createTestInvoice({ id: 1, status: 'APPROVED' });
      prismaMock.invoice.update.mockResolvedValue(approvedInvoice as any);

      // Act
      const response = await request(app)
        .put('/api/invoices/1/approve')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('APPROVED');
    });

    it('should require INVOICE_APPROVE permission', async () => {
      // Act - Viewer doesn't have approve permission
      const response = await request(app)
        .put('/api/invoices/1/approve')
        .set('Authorization', `Bearer ${viewerToken}`);

      // Assert
      expect(response.status).toBe(403);
    });
  });

  // ==========================================================================
  // PUT /api/invoices/:id/reject
  // ==========================================================================
  describe('PUT /api/invoices/:id/reject', () => {
    it('should reject invoice', async () => {
      // Arrange
      const rejectedInvoice = createTestInvoice({ id: 1, status: 'REJECTED' });
      prismaMock.invoice.update.mockResolvedValue(rejectedInvoice as any);

      // Act
      const response = await request(app)
        .put('/api/invoices/1/reject')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('REJECTED');
    });

    it('should require INVOICE_REJECT permission', async () => {
      // Act - Regular user doesn't have reject permission
      const response = await request(app)
        .put('/api/invoices/1/reject')
        .set('Authorization', `Bearer ${userToken}`);

      // Assert
      expect(response.status).toBe(403);
    });
  });

  // ==========================================================================
  // PUT /api/invoices/:id
  // ==========================================================================
  describe('PUT /api/invoices/:id', () => {
    it('should update invoice in PENDING status', async () => {
      // Arrange
      const existingInvoice = createTestInvoice({ id: 1, status: 'PENDING' });
      const updatedInvoice = { ...existingInvoice, project: 'Updated Project' };

      prismaMock.invoice.findFirst.mockResolvedValue(existingInvoice as any);
      prismaMock.invoice.update.mockResolvedValue(updatedInvoice as any);

      // Act
      const response = await request(app)
        .put('/api/invoices/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ project: 'Updated Project' });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.project).toBe('Updated Project');
    });

    it('should return 400 when updating non-PENDING invoice', async () => {
      // Arrange
      const existingInvoice = createTestInvoice({ id: 1, status: 'APPROVED' });
      prismaMock.invoice.findFirst.mockResolvedValue(existingInvoice as any);

      // Act
      const response = await request(app)
        .put('/api/invoices/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ project: 'Updated Project' });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('only update');
    });

    it('should return 404 for non-existent invoice', async () => {
      // Arrange
      prismaMock.invoice.findFirst.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .put('/api/invoices/999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ project: 'Test' });

      // Assert
      expect(response.status).toBe(404);
    });
  });

  // ==========================================================================
  // DELETE /api/invoices/:id
  // ==========================================================================
  describe('DELETE /api/invoices/:id', () => {
    it('should soft delete invoice', async () => {
      // Arrange
      const invoice = createTestInvoice({ id: 1 });
      prismaMock.invoice.findFirst.mockResolvedValue(invoice as any);
      prismaMock.invoice.update.mockResolvedValue({
        ...invoice,
        deletedAt: new Date(),
      } as any);

      // Act
      const response = await request(app)
        .delete('/api/invoices/1')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(204);
    });

    it('should return 404 for non-existent invoice', async () => {
      // Arrange
      prismaMock.invoice.findFirst.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .delete('/api/invoices/999')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(404);
    });

    it('should require INVOICE_DELETE permission', async () => {
      // Act - Regular user doesn't have delete permission
      const response = await request(app)
        .delete('/api/invoices/1')
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
      prismaMock.invoice.count.mockResolvedValue(0);
      prismaMock.invoice.findMany.mockResolvedValue([]);
    });

    it('should allow ADMIN to access all endpoints', async () => {
      // Act
      const response = await request(app)
        .get('/api/invoices')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
    });

    it('should allow USER to read invoices', async () => {
      // Act
      const response = await request(app)
        .get('/api/invoices')
        .set('Authorization', `Bearer ${userToken}`);

      // Assert
      expect(response.status).toBe(200);
    });

    it('should allow VIEWER to read invoices', async () => {
      // Act
      const response = await request(app)
        .get('/api/invoices')
        .set('Authorization', `Bearer ${viewerToken}`);

      // Assert
      expect(response.status).toBe(200);
    });

    it('should deny VIEWER from creating invoices', async () => {
      // Act
      const response = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ items: [{ itemId: 1, quantity: 1, price: 100 }] });

      // Assert
      expect(response.status).toBe(403);
    });
  });
});
