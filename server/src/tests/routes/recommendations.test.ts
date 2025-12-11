import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { getPrismaMock } from '../helpers/prisma-mock';
import {
  createTestUser,
  createTestAdmin,
  createTestManager,
  createTestToken,
} from '../helpers/test-factories';
import { UserRole, RecommendationType, RecommendationStatus } from '@prisma/client';

// Get the mocked prisma instance
const prismaMock = getPrismaMock();

// Mock Redis service
vi.mock('../../services/infrastructure/redisService', () => ({
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
import recommendationsRouter from '../../routes/recommendations';

describe('Recommendations Routes', () => {
  let app: Express;
  let adminToken: string;
  let managerToken: string;
  let viewerToken: string;

  // Helper to create a mock recommendation
  const createMockRecommendation = (overrides: Partial<any> = {}) => ({
    id: 1,
    type: 'COST_SAVINGS' as RecommendationType,
    category: 'pricing',
    title: 'Test Recommendation',
    description: 'Test description',
    reasoning: 'Test reasoning',
    estimatedSavings: 1000,
    confidenceScore: 0.8,
    priority: 2,
    context: '{}',
    status: 'PENDING' as RecommendationStatus,
    createdBy: 'SYSTEM',
    viewedAt: null,
    viewedBy: null,
    dismissedAt: null,
    dismissedBy: null,
    dismissReason: null,
    appliedAt: null,
    appliedBy: null,
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use('/api/recommendations', recommendationsRouter);

    // Create tokens for different roles
    adminToken = createTestToken(1);
    managerToken = createTestToken(2);
    viewerToken = createTestToken(3);

    // Mock user lookups for authentication
    prismaMock.user.findUnique.mockImplementation(async ({ where }) => {
      if (where.id === 1) {
        return createTestAdmin({ id: 1 }) as any;
      }
      if (where.id === 2) {
        return createTestManager({ id: 2 }) as any;
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
      const response = await request(app).get('/api/recommendations');

      // Assert
      expect(response.status).toBe(401);
    });

    it('should reject requests with invalid token', async () => {
      // Act
      const response = await request(app)
        .get('/api/recommendations')
        .set('Authorization', 'Bearer invalid-token');

      // Assert
      expect(response.status).toBe(403);
    });

    it('should accept requests with valid token', async () => {
      // Arrange
      prismaMock.recommendation.count.mockResolvedValue(0);
      prismaMock.recommendation.findMany.mockResolvedValue([]);

      // Act
      const response = await request(app)
        .get('/api/recommendations')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
    });
  });

  // ============================================================================
  // GET /api/recommendations
  // ============================================================================
  describe('GET /api/recommendations', () => {
    it('should return paginated recommendations', async () => {
      // Arrange
      const recommendations = [
        createMockRecommendation({ id: 1 }),
        createMockRecommendation({ id: 2 }),
      ];
      prismaMock.recommendation.count.mockResolvedValue(2);
      prismaMock.recommendation.findMany.mockResolvedValue(recommendations as any);

      // Act
      const response = await request(app)
        .get('/api/recommendations')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBe(2);
    });

    it('should support status filtering', async () => {
      // Arrange
      prismaMock.recommendation.count.mockResolvedValue(1);
      prismaMock.recommendation.findMany.mockResolvedValue([
        createMockRecommendation({ status: 'PENDING' }),
      ] as any);

      // Act
      const response = await request(app)
        .get('/api/recommendations?status=PENDING')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(prismaMock.recommendation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PENDING',
          }),
        })
      );
    });

    it('should support type filtering', async () => {
      // Arrange
      prismaMock.recommendation.count.mockResolvedValue(0);
      prismaMock.recommendation.findMany.mockResolvedValue([]);

      // Act - Use valid type from schema: COST_OPTIMIZATION
      const response = await request(app)
        .get('/api/recommendations?type=COST_OPTIMIZATION')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(prismaMock.recommendation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'COST_OPTIMIZATION',
          }),
        })
      );
    });

    it('should support pagination parameters', async () => {
      // Arrange
      prismaMock.recommendation.count.mockResolvedValue(100);
      prismaMock.recommendation.findMany.mockResolvedValue([]);

      // Act
      const response = await request(app)
        .get('/api/recommendations?page=2&limit=25')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.limit).toBe(25);
    });
  });

  // ============================================================================
  // GET /api/recommendations/:id
  // ============================================================================
  describe('GET /api/recommendations/:id', () => {
    it('should return a single recommendation by ID', async () => {
      // Arrange
      const recommendation = createMockRecommendation({ id: 1 });
      prismaMock.recommendation.findUnique.mockResolvedValue(recommendation as any);

      // Act
      const response = await request(app)
        .get('/api/recommendations/1')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(1);
    });

    it('should return 404 when recommendation not found', async () => {
      // Arrange
      prismaMock.recommendation.findUnique.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .get('/api/recommendations/999')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.code).toBe('NOT_FOUND');
    });

    it('should reject invalid ID parameter', async () => {
      // Act
      const response = await request(app)
        .get('/api/recommendations/invalid')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(400);
    });
  });

  // ============================================================================
  // PATCH /api/recommendations/:id/view
  // ============================================================================
  describe('PATCH /api/recommendations/:id/view', () => {
    it('should mark recommendation as viewed', async () => {
      // Arrange
      const recommendation = createMockRecommendation({ id: 1, status: 'PENDING' });
      const updated = createMockRecommendation({ id: 1, status: 'VIEWED', viewedBy: 1 });
      prismaMock.recommendation.findUnique.mockResolvedValue(recommendation as any);
      prismaMock.recommendation.update.mockResolvedValue(updated as any);

      // Act
      const response = await request(app)
        .patch('/api/recommendations/1/view')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('VIEWED');
    });

    it('should return 404 when recommendation not found', async () => {
      // Arrange
      prismaMock.recommendation.findUnique.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .patch('/api/recommendations/999/view')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(404);
    });

    it('should not update if already in final state', async () => {
      // Arrange
      const recommendation = createMockRecommendation({ id: 1, status: 'APPLIED' });
      prismaMock.recommendation.findUnique.mockResolvedValue(recommendation as any);

      // Act
      const response = await request(app)
        .patch('/api/recommendations/1/view')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('APPLIED');
      expect(prismaMock.recommendation.update).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // PATCH /api/recommendations/:id/dismiss
  // ============================================================================
  describe('PATCH /api/recommendations/:id/dismiss', () => {
    it('should dismiss recommendation with reason', async () => {
      // Arrange
      const recommendation = createMockRecommendation({ id: 1, status: 'PENDING' });
      const updated = createMockRecommendation({
        id: 1,
        status: 'DISMISSED',
        dismissedBy: 1,
        dismissReason: 'Not applicable',
      });
      prismaMock.recommendation.findUnique.mockResolvedValue(recommendation as any);
      prismaMock.recommendation.update.mockResolvedValue(updated as any);

      // Act
      const response = await request(app)
        .patch('/api/recommendations/1/dismiss')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Not applicable' });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('DISMISSED');
    });

    it('should dismiss recommendation without reason', async () => {
      // Arrange
      const recommendation = createMockRecommendation({ id: 1, status: 'PENDING' });
      const updated = createMockRecommendation({ id: 1, status: 'DISMISSED' });
      prismaMock.recommendation.findUnique.mockResolvedValue(recommendation as any);
      prismaMock.recommendation.update.mockResolvedValue(updated as any);

      // Act
      const response = await request(app)
        .patch('/api/recommendations/1/dismiss')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('DISMISSED');
    });

    it('should return 404 when recommendation not found', async () => {
      // Arrange
      prismaMock.recommendation.findUnique.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .patch('/api/recommendations/999/dismiss')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      // Assert
      expect(response.status).toBe(404);
    });
  });

  // ============================================================================
  // PATCH /api/recommendations/:id/apply
  // ============================================================================
  describe('PATCH /api/recommendations/:id/apply', () => {
    it('should mark recommendation as applied', async () => {
      // Arrange
      const recommendation = createMockRecommendation({ id: 1, status: 'VIEWED' });
      const updated = createMockRecommendation({ id: 1, status: 'APPLIED', appliedBy: 1 });
      prismaMock.recommendation.findUnique.mockResolvedValue(recommendation as any);
      prismaMock.recommendation.update.mockResolvedValue(updated as any);

      // Act
      const response = await request(app)
        .patch('/api/recommendations/1/apply')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('APPLIED');
    });

    it('should accept optional notes', async () => {
      // Arrange
      const recommendation = createMockRecommendation({ id: 1, status: 'VIEWED' });
      const updated = createMockRecommendation({ id: 1, status: 'APPLIED' });
      prismaMock.recommendation.findUnique.mockResolvedValue(recommendation as any);
      prismaMock.recommendation.update.mockResolvedValue(updated as any);

      // Act
      const response = await request(app)
        .patch('/api/recommendations/1/apply')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Applied with vendor agreement' });

      // Assert
      expect(response.status).toBe(200);
    });

    it('should return 404 when recommendation not found', async () => {
      // Arrange
      prismaMock.recommendation.findUnique.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .patch('/api/recommendations/999/apply')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      // Assert
      expect(response.status).toBe(404);
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================
  describe('Error Handling', () => {
    it('should return 500 on database errors for list', async () => {
      // Arrange
      prismaMock.$transaction.mockRejectedValue(new Error('Database error'));

      // Act
      const response = await request(app)
        .get('/api/recommendations')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
    });

    it('should return 500 on database errors for state transitions', async () => {
      // Arrange
      const recommendation = createMockRecommendation({ id: 1, status: 'PENDING' });
      prismaMock.recommendation.findUnique.mockResolvedValue(recommendation as any);
      prismaMock.recommendation.update.mockRejectedValue(new Error('Database error'));

      // Act
      const response = await request(app)
        .patch('/api/recommendations/1/dismiss')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      // Assert
      expect(response.status).toBe(500);
    });
  });
});
