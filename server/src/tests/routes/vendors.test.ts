import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { getPrismaMock } from '../helpers/prisma-mock';
import {
  createTestVendor,
  createTestItem,
  createTestUser,
  createTestAdmin,
  createTestToken,
} from '../helpers/test-factories';
import { UserRole } from '@prisma/client';

// Get the mocked prisma instance
const prismaMock = getPrismaMock();

// Import router after mocks are set up
import vendorRouter from '../../routes/vendors';

describe('Vendor Routes', () => {
  let app: Express;
  let adminToken: string;
  let userToken: string;
  let viewerToken: string;

  beforeEach(() => {
    vi.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use('/api/vendors', vendorRouter);

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
      const response = await request(app).get('/api/vendors');

      // Assert
      expect(response.status).toBe(401);
    });

    it('should reject requests with invalid token', async () => {
      // Act
      const response = await request(app)
        .get('/api/vendors')
        .set('Authorization', 'Bearer invalid-token');

      // Assert
      expect(response.status).toBe(403);
    });

    it('should accept requests with valid token', async () => {
      // Arrange
      prismaMock.vendor.count.mockResolvedValue(0);
      prismaMock.vendor.findMany.mockResolvedValue([]);

      // Act
      const response = await request(app)
        .get('/api/vendors')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
    });
  });

  // ==========================================================================
  // GET /api/vendors
  // ==========================================================================
  describe('GET /api/vendors', () => {
    it('should return paginated vendors', async () => {
      // Arrange
      const vendors = [
        createTestVendor({ id: 1, name: 'Vendor A' }),
        createTestVendor({ id: 2, name: 'Vendor B' }),
      ];
      prismaMock.vendor.count.mockResolvedValue(2);
      prismaMock.vendor.findMany.mockResolvedValue(vendors as any);

      // Act
      const response = await request(app)
        .get('/api/vendors')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination).toBeDefined();
    });

    it('should support name filtering with contains operator', async () => {
      // Arrange
      prismaMock.vendor.count.mockResolvedValue(1);
      prismaMock.vendor.findMany.mockResolvedValue([
        createTestVendor({ name: 'Test Vendor' }),
      ] as any);

      // Act
      const response = await request(app)
        .get('/api/vendors?name=test&nameOperator=contains')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
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

    it('should support pagination parameters', async () => {
      // Arrange
      prismaMock.vendor.count.mockResolvedValue(100);
      prismaMock.vendor.findMany.mockResolvedValue([]);

      // Act
      const response = await request(app)
        .get('/api/vendors?page=2&limit=20')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(prismaMock.vendor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 20,
        })
      );
    });
  });

  // ==========================================================================
  // GET /api/vendors/:id
  // ==========================================================================
  describe('GET /api/vendors/:id', () => {
    it('should return vendor by id', async () => {
      // Arrange
      const vendor = createTestVendor({ id: 1, name: 'Test Vendor' });
      prismaMock.vendor.findFirst.mockResolvedValue(vendor as any);

      // Act
      const response = await request(app)
        .get('/api/vendors/1')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(1);
      expect(response.body.name).toBe('Test Vendor');
    });

    it('should return 404 for non-existent vendor', async () => {
      // Arrange
      prismaMock.vendor.findFirst.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .get('/api/vendors/999')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Vendor not found');
    });
  });

  // ==========================================================================
  // POST /api/vendors
  // ==========================================================================
  describe('POST /api/vendors', () => {
    it('should create vendor with valid data', async () => {
      // Arrange
      const createdVendor = createTestVendor({
        id: 1,
        name: 'New Vendor',
        contact: 'contact@vendor.com',
      });
      prismaMock.vendor.create.mockResolvedValue(createdVendor as any);

      // Act
      const response = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New Vendor', contact: 'contact@vendor.com' });

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.name).toBe('New Vendor');
      expect(response.body.contact).toBe('contact@vendor.com');
    });

    it('should create vendor with only name (contact optional)', async () => {
      // Arrange
      const createdVendor = createTestVendor({
        id: 1,
        name: 'New Vendor',
        contact: null,
      });
      prismaMock.vendor.create.mockResolvedValue(createdVendor as any);

      // Act
      const response = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New Vendor' });

      // Assert
      expect(response.status).toBe(201);
    });

    it('should reject request without name', async () => {
      // Act
      const response = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ contact: 'contact@vendor.com' });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required field: name');
    });
  });

  // ==========================================================================
  // PUT /api/vendors/:id
  // ==========================================================================
  describe('PUT /api/vendors/:id', () => {
    it('should update vendor', async () => {
      // Arrange
      const existingVendor = createTestVendor({ id: 1, name: 'Old Name' });
      const updatedVendor = { ...existingVendor, name: 'New Name' };

      prismaMock.vendor.findFirst.mockResolvedValue(existingVendor as any);
      prismaMock.vendor.update.mockResolvedValue(updatedVendor as any);

      // Act
      const response = await request(app)
        .put('/api/vendors/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New Name' });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.name).toBe('New Name');
    });

    it('should return 404 for non-existent vendor', async () => {
      // Arrange
      prismaMock.vendor.findFirst.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .put('/api/vendors/999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New Name' });

      // Assert
      expect(response.status).toBe(404);
    });
  });

  // ==========================================================================
  // DELETE /api/vendors/:id
  // ==========================================================================
  describe('DELETE /api/vendors/:id', () => {
    it('should soft delete vendor without active items', async () => {
      // Arrange
      const vendor = { ...createTestVendor({ id: 1 }), items: [] };
      prismaMock.vendor.findFirst.mockResolvedValue(vendor as any);
      prismaMock.vendor.update.mockResolvedValue({
        ...vendor,
        deletedAt: new Date(),
      } as any);

      // Act
      const response = await request(app)
        .delete('/api/vendors/1')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(204);
    });

    it('should return 404 for non-existent vendor', async () => {
      // Arrange
      prismaMock.vendor.findFirst.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .delete('/api/vendors/999')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(404);
    });

    it('should return 409 when vendor has active items', async () => {
      // Arrange
      const vendor = {
        ...createTestVendor({ id: 1 }),
        items: [{ id: 1 }, { id: 2 }], // 2 active items
      };
      prismaMock.vendor.findFirst.mockResolvedValue(vendor as any);

      // Act
      const response = await request(app)
        .delete('/api/vendors/1')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(409);
      expect(response.body.code).toBe('VENDOR_HAS_ACTIVE_ITEMS');
      expect(response.body.vendorId).toBe(1);
      expect(response.body.itemCount).toBe(2);
    });

    it('should require VENDOR_DELETE permission', async () => {
      // Act - Regular user doesn't have delete permission
      const response = await request(app)
        .delete('/api/vendors/1')
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
      prismaMock.vendor.count.mockResolvedValue(0);
      prismaMock.vendor.findMany.mockResolvedValue([]);
    });

    it('should allow ADMIN to access all endpoints', async () => {
      // Act
      const response = await request(app)
        .get('/api/vendors')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
    });

    it('should allow USER to read vendors', async () => {
      // Act
      const response = await request(app)
        .get('/api/vendors')
        .set('Authorization', `Bearer ${userToken}`);

      // Assert
      expect(response.status).toBe(200);
    });

    it('should allow USER to create vendors', async () => {
      // Arrange
      const createdVendor = createTestVendor({ id: 1, name: 'New Vendor' });
      prismaMock.vendor.create.mockResolvedValue(createdVendor as any);

      // Act
      const response = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'New Vendor' });

      // Assert
      expect(response.status).toBe(201);
    });

    it('should allow VIEWER to read vendors', async () => {
      // Act
      const response = await request(app)
        .get('/api/vendors')
        .set('Authorization', `Bearer ${viewerToken}`);

      // Assert
      expect(response.status).toBe(200);
    });

    it('should deny VIEWER from creating vendors', async () => {
      // Act
      const response = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ name: 'New Vendor' });

      // Assert
      expect(response.status).toBe(403);
    });

    it('should deny USER from updating vendors', async () => {
      // Act
      const response = await request(app)
        .put('/api/vendors/1')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Updated Name' });

      // Assert
      expect(response.status).toBe(403);
    });

    it('should deny USER from deleting vendors', async () => {
      // Act
      const response = await request(app)
        .delete('/api/vendors/1')
        .set('Authorization', `Bearer ${userToken}`);

      // Assert
      expect(response.status).toBe(403);
    });
  });
});
