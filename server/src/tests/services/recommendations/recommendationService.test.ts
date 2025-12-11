import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getPrismaMock } from '../../helpers/prisma-mock';
import { RecommendationType, RecommendationStatus } from '@prisma/client';
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
import {
  RecommendationService,
  createRecommendationService,
  CreateRecommendationInput,
} from '../../../services/recommendations/recommendationService';
import { RecommendationError } from '../../../errors/AnalyticsError';
import { NotFoundError } from '../../../errors/AppError';

describe('RecommendationService', () => {
  let service: RecommendationService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheService.get.mockResolvedValue(null);
    service = createRecommendationService(
      prismaMock as any,
      mockCacheService as any,
      mockPubSub as any
    );
  });

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

  // ============================================================================
  // CRUD Operations
  // ============================================================================
  describe('create', () => {
    it('should create a recommendation with all fields', async () => {
      // Arrange
      const input: CreateRecommendationInput = {
        type: 'COST_SAVINGS' as RecommendationType,
        category: 'pricing',
        title: 'Test Recommendation',
        description: 'Test description',
        reasoning: 'Test reasoning',
        estimatedSavings: 1000,
        confidenceScore: 0.8,
        priority: 2,
        context: { itemId: 1 },
        createdBy: 'SYSTEM',
      };

      const created = createMockRecommendation();
      prismaMock.recommendation.create.mockResolvedValue(created);

      // Act
      const result = await service.create(input);

      // Assert
      expect(result).toEqual(created);
      expect(prismaMock.recommendation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'COST_SAVINGS',
            title: 'Test Recommendation',
            context: JSON.stringify({ itemId: 1 }),
          }),
        })
      );
      expect(mockCacheService.invalidateByPrefix).toHaveBeenCalledWith('analytics:recommendations-list');
    });

    it('should use default values for optional fields', async () => {
      // Arrange
      const input: CreateRecommendationInput = {
        type: 'VENDOR_CONSOLIDATION' as RecommendationType,
        category: 'vendor',
        title: 'Test',
        description: 'Desc',
        reasoning: 'Reason',
        context: {},
      };

      prismaMock.recommendation.create.mockResolvedValue(createMockRecommendation());

      // Act
      await service.create(input);

      // Assert
      expect(prismaMock.recommendation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            confidenceScore: 0.5, // Default
            priority: 3, // Default
            createdBy: 'SYSTEM', // Default
          }),
        })
      );
    });

    it('should throw RecommendationError on database failure', async () => {
      // Arrange
      const input: CreateRecommendationInput = {
        type: 'COST_SAVINGS' as RecommendationType,
        category: 'pricing',
        title: 'Test',
        description: 'Desc',
        reasoning: 'Reason',
        context: {},
      };

      prismaMock.recommendation.create.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(service.create(input)).rejects.toThrow(RecommendationError);
    });
  });

  describe('createMany', () => {
    it('should create multiple recommendations', async () => {
      // Arrange
      const inputs: CreateRecommendationInput[] = [
        {
          type: 'COST_SAVINGS' as RecommendationType,
          category: 'pricing',
          title: 'Test 1',
          description: 'Desc 1',
          reasoning: 'Reason 1',
          context: {},
        },
        {
          type: 'VENDOR_CONSOLIDATION' as RecommendationType,
          category: 'vendor',
          title: 'Test 2',
          description: 'Desc 2',
          reasoning: 'Reason 2',
          context: {},
        },
      ];

      prismaMock.recommendation.createMany.mockResolvedValue({ count: 2 });

      // Act
      const result = await service.createMany(inputs);

      // Assert
      expect(result).toBe(2);
      expect(mockCacheService.invalidateByPrefix).toHaveBeenCalledWith('analytics:recommendations-list');
    });

    it('should throw RecommendationError on database failure', async () => {
      // Arrange
      const inputs: CreateRecommendationInput[] = [
        {
          type: 'COST_SAVINGS' as RecommendationType,
          category: 'pricing',
          title: 'Test',
          description: 'Desc',
          reasoning: 'Reason',
          context: {},
        },
      ];

      prismaMock.recommendation.createMany.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(service.createMany(inputs)).rejects.toThrow(RecommendationError);
    });
  });

  describe('getById', () => {
    it('should return recommendation from database', async () => {
      // Arrange
      const recommendation = createMockRecommendation();
      prismaMock.recommendation.findUnique.mockResolvedValue(recommendation);

      // Act
      const result = await service.getById(1);

      // Assert
      expect(result).toEqual(recommendation);
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('should return cached recommendation if available', async () => {
      // Arrange
      const cached = createMockRecommendation();
      mockCacheService.get.mockResolvedValue(cached);

      // Act
      const result = await service.getById(1);

      // Assert
      expect(result).toEqual(cached);
      expect(prismaMock.recommendation.findUnique).not.toHaveBeenCalled();
    });

    it('should return null when recommendation not found', async () => {
      // Arrange
      prismaMock.recommendation.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.getById(999);

      // Assert
      expect(result).toBeNull();
    });

    it('should throw RecommendationError on database failure', async () => {
      // Arrange
      prismaMock.recommendation.findUnique.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(service.getById(1)).rejects.toThrow(RecommendationError);
    });
  });

  describe('getByIdOrThrow', () => {
    it('should return recommendation when found', async () => {
      // Arrange
      const recommendation = createMockRecommendation();
      prismaMock.recommendation.findUnique.mockResolvedValue(recommendation);

      // Act
      const result = await service.getByIdOrThrow(1);

      // Assert
      expect(result).toEqual(recommendation);
    });

    it('should throw NotFoundError when recommendation not found', async () => {
      // Arrange
      prismaMock.recommendation.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getByIdOrThrow(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('list', () => {
    it('should return paginated recommendations', async () => {
      // Arrange
      const recommendations = [createMockRecommendation({ id: 1 }), createMockRecommendation({ id: 2 })];
      prismaMock.recommendation.count.mockResolvedValue(2);
      prismaMock.recommendation.findMany.mockResolvedValue(recommendations);

      // Act
      const result = await service.list({}, { page: 1, limit: 10 });

      // Assert
      expect(result.data).toEqual(recommendations);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.totalPages).toBe(1);
      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrevious).toBe(false);
    });

    it('should apply filters correctly', async () => {
      // Arrange
      prismaMock.recommendation.count.mockResolvedValue(0);
      prismaMock.recommendation.findMany.mockResolvedValue([]);

      // Act
      await service.list(
        {
          status: 'PENDING' as RecommendationStatus,
          type: 'COST_SAVINGS' as RecommendationType,
          priority: 1,
          minConfidence: 0.7,
        },
        { page: 1, limit: 10 }
      );

      // Assert
      expect(prismaMock.recommendation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PENDING',
            type: 'COST_SAVINGS',
            priority: 1,
            confidenceScore: { gte: 0.7 },
          }),
        })
      );
    });

    it('should calculate pagination correctly for multiple pages', async () => {
      // Arrange
      prismaMock.recommendation.count.mockResolvedValue(25);
      prismaMock.recommendation.findMany.mockResolvedValue([]);

      // Act
      const result = await service.list({}, { page: 2, limit: 10 });

      // Assert
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrevious).toBe(true);
    });

    it('should throw RecommendationError on database failure', async () => {
      // Arrange
      prismaMock.$transaction.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(service.list({}, { page: 1, limit: 10 })).rejects.toThrow(RecommendationError);
    });
  });

  describe('update', () => {
    it('should update recommendation fields', async () => {
      // Arrange
      const existing = createMockRecommendation();
      const updated = createMockRecommendation({ title: 'Updated Title' });
      prismaMock.recommendation.findUnique.mockResolvedValue(existing);
      prismaMock.recommendation.update.mockResolvedValue(updated);

      // Act
      const result = await service.update(1, { title: 'Updated Title' });

      // Assert
      expect(result.title).toBe('Updated Title');
      expect(mockCacheService.del).toHaveBeenCalledWith('analytics:recommendation:1');
      expect(mockCacheService.invalidateByPrefix).toHaveBeenCalledWith('analytics:recommendations-list');
    });

    it('should throw NotFoundError when recommendation not found', async () => {
      // Arrange
      prismaMock.recommendation.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update(999, { title: 'New' })).rejects.toThrow(NotFoundError);
    });

    it('should throw RecommendationError on database failure', async () => {
      // Arrange
      const existing = createMockRecommendation();
      prismaMock.recommendation.findUnique.mockResolvedValue(existing);
      prismaMock.recommendation.update.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(service.update(1, { title: 'New' })).rejects.toThrow(RecommendationError);
    });
  });

  describe('delete', () => {
    it('should delete recommendation', async () => {
      // Arrange
      const existing = createMockRecommendation();
      prismaMock.recommendation.findUnique.mockResolvedValue(existing);
      prismaMock.recommendation.delete.mockResolvedValue(existing);

      // Act
      await service.delete(1);

      // Assert
      expect(prismaMock.recommendation.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockCacheService.del).toHaveBeenCalledWith('analytics:recommendation:1');
    });

    it('should throw NotFoundError when recommendation not found', async () => {
      // Arrange
      prismaMock.recommendation.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.delete(999)).rejects.toThrow(NotFoundError);
    });

    it('should throw RecommendationError on database failure', async () => {
      // Arrange
      const existing = createMockRecommendation();
      prismaMock.recommendation.findUnique.mockResolvedValue(existing);
      prismaMock.recommendation.delete.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(service.delete(1)).rejects.toThrow(RecommendationError);
    });
  });

  // ============================================================================
  // State Transitions
  // ============================================================================
  describe('markViewed', () => {
    it('should mark recommendation as viewed', async () => {
      // Arrange
      const existing = createMockRecommendation({ status: 'PENDING' });
      const updated = createMockRecommendation({ status: 'VIEWED', viewedAt: new Date(), viewedBy: 1 });
      prismaMock.recommendation.findUnique.mockResolvedValue(existing);
      prismaMock.recommendation.update.mockResolvedValue(updated);

      // Act
      const result = await service.markViewed(1, 1);

      // Assert
      expect(result.status).toBe('VIEWED');
      expect(mockPubSub.publish).toHaveBeenCalledWith(
        AnalyticsEvents.RECOMMENDATION_VIEWED,
        expect.objectContaining({
          recommendationId: 1,
          userId: 1,
          newStatus: 'VIEWED',
        })
      );
    });

    it('should not update if already in final state (DISMISSED)', async () => {
      // Arrange
      const existing = createMockRecommendation({ status: 'DISMISSED' });
      prismaMock.recommendation.findUnique.mockResolvedValue(existing);

      // Act
      const result = await service.markViewed(1, 1);

      // Assert
      expect(result.status).toBe('DISMISSED');
      expect(prismaMock.recommendation.update).not.toHaveBeenCalled();
    });

    it('should not update if already in final state (APPLIED)', async () => {
      // Arrange
      const existing = createMockRecommendation({ status: 'APPLIED' });
      prismaMock.recommendation.findUnique.mockResolvedValue(existing);

      // Act
      const result = await service.markViewed(1, 1);

      // Assert
      expect(result.status).toBe('APPLIED');
      expect(prismaMock.recommendation.update).not.toHaveBeenCalled();
    });

    it('should not update if already in final state (EXPIRED)', async () => {
      // Arrange
      const existing = createMockRecommendation({ status: 'EXPIRED' });
      prismaMock.recommendation.findUnique.mockResolvedValue(existing);

      // Act
      const result = await service.markViewed(1, 1);

      // Assert
      expect(result.status).toBe('EXPIRED');
      expect(prismaMock.recommendation.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when recommendation not found', async () => {
      // Arrange
      prismaMock.recommendation.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.markViewed(999, 1)).rejects.toThrow(NotFoundError);
    });
  });

  describe('dismiss', () => {
    it('should dismiss recommendation with reason', async () => {
      // Arrange
      const existing = createMockRecommendation({ status: 'PENDING' });
      const updated = createMockRecommendation({
        status: 'DISMISSED',
        dismissedAt: new Date(),
        dismissedBy: 1,
        dismissReason: 'Not applicable',
      });
      prismaMock.recommendation.findUnique.mockResolvedValue(existing);
      prismaMock.recommendation.update.mockResolvedValue(updated);

      // Act
      const result = await service.dismiss(1, 1, 'Not applicable');

      // Assert
      expect(result.status).toBe('DISMISSED');
      expect(prismaMock.recommendation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'DISMISSED',
            dismissReason: 'Not applicable',
          }),
        })
      );
      expect(mockPubSub.publish).toHaveBeenCalledWith(
        AnalyticsEvents.RECOMMENDATION_DISMISSED,
        expect.objectContaining({
          recommendationId: 1,
          dismissReason: 'Not applicable',
        })
      );
    });

    it('should dismiss recommendation without reason', async () => {
      // Arrange
      const existing = createMockRecommendation({ status: 'PENDING' });
      const updated = createMockRecommendation({ status: 'DISMISSED' });
      prismaMock.recommendation.findUnique.mockResolvedValue(existing);
      prismaMock.recommendation.update.mockResolvedValue(updated);

      // Act
      await service.dismiss(1, 1);

      // Assert
      expect(prismaMock.recommendation.update).toHaveBeenCalled();
    });

    it('should throw NotFoundError when recommendation not found', async () => {
      // Arrange
      prismaMock.recommendation.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.dismiss(999, 1)).rejects.toThrow(NotFoundError);
    });
  });

  describe('apply', () => {
    it('should mark recommendation as applied', async () => {
      // Arrange
      const existing = createMockRecommendation({ status: 'VIEWED' });
      const updated = createMockRecommendation({
        status: 'APPLIED',
        appliedAt: new Date(),
        appliedBy: 1,
      });
      prismaMock.recommendation.findUnique.mockResolvedValue(existing);
      prismaMock.recommendation.update.mockResolvedValue(updated);

      // Act
      const result = await service.apply(1, 1);

      // Assert
      expect(result.status).toBe('APPLIED');
      expect(mockPubSub.publish).toHaveBeenCalledWith(
        AnalyticsEvents.RECOMMENDATION_APPLIED,
        expect.objectContaining({
          recommendationId: 1,
          userId: 1,
          newStatus: 'APPLIED',
        })
      );
    });

    it('should throw NotFoundError when recommendation not found', async () => {
      // Arrange
      prismaMock.recommendation.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.apply(999, 1)).rejects.toThrow(NotFoundError);
    });
  });

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================
  describe('expireRecommendations', () => {
    it('should expire recommendations past their expiry date', async () => {
      // Arrange
      prismaMock.recommendation.updateMany.mockResolvedValue({ count: 5 });

      // Act
      const result = await service.expireRecommendations();

      // Assert
      expect(result).toBe(5);
      expect(prismaMock.recommendation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['PENDING', 'VIEWED'] },
            expiresAt: { lte: expect.any(Date) },
          }),
          data: { status: 'EXPIRED' },
        })
      );
      expect(mockCacheService.invalidateByPrefix).toHaveBeenCalledWith('analytics:recommendations-list');
    });

    it('should not invalidate cache when no recommendations expired', async () => {
      // Arrange
      prismaMock.recommendation.updateMany.mockResolvedValue({ count: 0 });

      // Act
      await service.expireRecommendations();

      // Assert
      expect(mockCacheService.invalidateByPrefix).not.toHaveBeenCalled();
    });

    it('should throw RecommendationError on database failure', async () => {
      // Arrange
      prismaMock.recommendation.updateMany.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(service.expireRecommendations()).rejects.toThrow(RecommendationError);
    });
  });

  describe('cleanupOldRecommendations', () => {
    it('should delete old expired/dismissed recommendations', async () => {
      // Arrange
      prismaMock.recommendation.deleteMany.mockResolvedValue({ count: 10 });

      // Act
      const result = await service.cleanupOldRecommendations();

      // Assert
      expect(result).toBe(10);
      expect(prismaMock.recommendation.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['EXPIRED', 'DISMISSED'] },
            createdAt: { lt: expect.any(Date) },
          }),
        })
      );
      expect(mockCacheService.invalidateByPrefix).toHaveBeenCalledWith('analytics:recommendations-list');
    });

    it('should use custom retention days when provided', async () => {
      // Arrange
      prismaMock.recommendation.deleteMany.mockResolvedValue({ count: 0 });
      const customDays = 7;

      // Act
      await service.cleanupOldRecommendations(customDays);

      // Assert
      expect(prismaMock.recommendation.deleteMany).toHaveBeenCalled();
    });

    it('should not invalidate cache when no recommendations deleted', async () => {
      // Arrange
      prismaMock.recommendation.deleteMany.mockResolvedValue({ count: 0 });

      // Act
      await service.cleanupOldRecommendations();

      // Assert
      expect(mockCacheService.invalidateByPrefix).not.toHaveBeenCalled();
    });

    it('should throw RecommendationError on database failure', async () => {
      // Arrange
      prismaMock.recommendation.deleteMany.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(service.cleanupOldRecommendations()).rejects.toThrow(RecommendationError);
    });
  });
});
