import {
  PrismaClient,
  Recommendation,
  RecommendationType,
  RecommendationStatus,
} from '@prisma/client';
import { logger } from '../../utils/logger';
import {
  ICacheService,
  AnalyticsEvents,
  type RecommendationStateChangePayload,
} from '../../domain/analytics';
import { RecommendationError } from '../../errors/AnalyticsError';
import { NotFoundError } from '../../errors/AppError';
import { PubSubService } from '../pubsub';
import { AnalyticsConfig } from '../../config/analytics';

/**
 * Cache key prefixes for recommendation data
 */
const CACHE_KEYS = {
  RECOMMENDATION: 'analytics:recommendation',
  RECOMMENDATIONS_LIST: 'analytics:recommendations-list',
} as const;

/**
 * Input for creating a new recommendation
 */
export interface CreateRecommendationInput {
  type: RecommendationType;
  category: string;
  title: string;
  description: string;
  reasoning: string;
  estimatedSavings?: number;
  confidenceScore?: number;
  priority?: number;
  context: Record<string, unknown>;
  createdBy?: string;
  expiresAt?: Date;
}

/**
 * Input for updating a recommendation
 */
export interface UpdateRecommendationInput {
  title?: string;
  description?: string;
  reasoning?: string;
  estimatedSavings?: number;
  confidenceScore?: number;
  priority?: number;
  context?: Record<string, unknown>;
  expiresAt?: Date;
}

/**
 * Filters for listing recommendations
 */
export interface RecommendationFilters {
  status?: RecommendationStatus;
  type?: RecommendationType;
  priority?: number;
  minConfidence?: number;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

/**
 * Recommendation service implementation
 * Manages recommendation CRUD operations and state transitions
 *
 * ARCHITECTURE: Uses dependency injection for testability
 */
export class RecommendationService {
  private readonly log = logger.child({ service: 'RecommendationService' });

  constructor(
    private readonly prisma: PrismaClient,
    private readonly cacheService: ICacheService,
    private readonly pubsub: PubSubService
  ) {}

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  /**
   * Create a new recommendation
   *
   * @param input - Recommendation data
   * @returns Created recommendation
   */
  async create(input: CreateRecommendationInput): Promise<Recommendation> {
    this.log.info({ type: input.type, title: input.title }, 'Creating recommendation');

    try {
      const recommendation = await this.prisma.recommendation.create({
        data: {
          type: input.type,
          category: input.category,
          title: input.title,
          description: input.description,
          reasoning: input.reasoning,
          estimatedSavings: input.estimatedSavings,
          confidenceScore: input.confidenceScore ?? 0.5,
          priority: input.priority ?? 3,
          context: JSON.stringify(input.context),
          createdBy: input.createdBy ?? 'SYSTEM',
          expiresAt: input.expiresAt,
        },
      });

      // Invalidate list cache
      await this.cacheService.invalidateByPrefix(CACHE_KEYS.RECOMMENDATIONS_LIST);

      this.log.info({ id: recommendation.id }, 'Recommendation created');
      return recommendation;
    } catch (error) {
      this.log.error({ error, input }, 'Failed to create recommendation');
      throw new RecommendationError(
        'create',
        'Failed to create recommendation',
        error as Error
      );
    }
  }

  /**
   * Create multiple recommendations at once
   *
   * @param inputs - Array of recommendation data
   * @returns Number of created recommendations
   */
  async createMany(inputs: CreateRecommendationInput[]): Promise<number> {
    this.log.info({ count: inputs.length }, 'Creating multiple recommendations');

    try {
      const result = await this.prisma.recommendation.createMany({
        data: inputs.map((input) => ({
          type: input.type,
          category: input.category,
          title: input.title,
          description: input.description,
          reasoning: input.reasoning,
          estimatedSavings: input.estimatedSavings,
          confidenceScore: input.confidenceScore ?? 0.5,
          priority: input.priority ?? 3,
          context: JSON.stringify(input.context),
          createdBy: input.createdBy ?? 'SYSTEM',
          expiresAt: input.expiresAt,
        })),
      });

      // Invalidate list cache
      await this.cacheService.invalidateByPrefix(CACHE_KEYS.RECOMMENDATIONS_LIST);

      this.log.info({ created: result.count }, 'Multiple recommendations created');
      return result.count;
    } catch (error) {
      this.log.error({ error, inputCount: inputs.length }, 'Failed to create recommendations');
      throw new RecommendationError(
        'createMany',
        'Failed to create recommendations',
        error as Error
      );
    }
  }

  /**
   * Get a recommendation by ID
   *
   * @param id - Recommendation ID
   * @returns Recommendation or null
   */
  async getById(id: number): Promise<Recommendation | null> {
    const cacheKey = `${CACHE_KEYS.RECOMMENDATION}:${id}`;

    try {
      // Check cache first
      const cached = await this.cacheService.get<Recommendation>(cacheKey);
      if (cached) {
        return cached;
      }

      const recommendation = await this.prisma.recommendation.findUnique({
        where: { id },
      });

      if (recommendation) {
        await this.cacheService.set(
          cacheKey,
          recommendation,
          AnalyticsConfig.CACHE_TTL.RECOMMENDATIONS
        );
      }

      return recommendation;
    } catch (error) {
      this.log.error({ error, id }, 'Failed to get recommendation');
      throw new RecommendationError(
        'getById',
        `Failed to get recommendation ${id}`,
        error as Error
      );
    }
  }

  /**
   * Get a recommendation by ID or throw NotFoundError
   *
   * @param id - Recommendation ID
   * @returns Recommendation
   * @throws NotFoundError if not found
   */
  async getByIdOrThrow(id: number): Promise<Recommendation> {
    const recommendation = await this.getById(id);
    if (!recommendation) {
      throw new NotFoundError('Recommendation', id);
    }
    return recommendation;
  }

  /**
   * List recommendations with filters and pagination
   *
   * @param filters - Optional filters
   * @param pagination - Pagination options
   * @returns Paginated recommendations
   */
  async list(
    filters: RecommendationFilters = {},
    pagination: PaginationOptions = { page: 1, limit: 20 }
  ): Promise<PaginatedResult<Recommendation>> {
    this.log.debug({ filters, pagination }, 'Listing recommendations');

    try {
      const where: {
        status?: RecommendationStatus;
        type?: RecommendationType;
        priority?: number;
        confidenceScore?: { gte: number };
      } = {};

      if (filters.status) where.status = filters.status;
      if (filters.type) where.type = filters.type;
      if (filters.priority) where.priority = filters.priority;
      if (filters.minConfidence) where.confidenceScore = { gte: filters.minConfidence };

      const skip = (pagination.page - 1) * pagination.limit;

      const [total, data] = await this.prisma.$transaction([
        this.prisma.recommendation.count({ where }),
        this.prisma.recommendation.findMany({
          where,
          skip,
          take: pagination.limit,
          orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        }),
      ]);

      const totalPages = Math.ceil(total / pagination.limit);

      return {
        data,
        pagination: {
          total,
          page: pagination.page,
          limit: pagination.limit,
          totalPages,
          hasNext: pagination.page < totalPages,
          hasPrevious: pagination.page > 1,
        },
      };
    } catch (error) {
      this.log.error({ error, filters, pagination }, 'Failed to list recommendations');
      throw new RecommendationError(
        'list',
        'Failed to list recommendations',
        error as Error
      );
    }
  }

  /**
   * Update a recommendation
   *
   * @param id - Recommendation ID
   * @param input - Update data
   * @returns Updated recommendation
   */
  async update(id: number, input: UpdateRecommendationInput): Promise<Recommendation> {
    this.log.info({ id, input }, 'Updating recommendation');

    try {
      // Ensure exists
      await this.getByIdOrThrow(id);

      const updateData: {
        title?: string;
        description?: string;
        reasoning?: string;
        estimatedSavings?: number;
        confidenceScore?: number;
        priority?: number;
        context?: string;
        expiresAt?: Date;
      } = {};

      if (input.title) updateData.title = input.title;
      if (input.description) updateData.description = input.description;
      if (input.reasoning) updateData.reasoning = input.reasoning;
      if (input.estimatedSavings !== undefined)
        updateData.estimatedSavings = input.estimatedSavings;
      if (input.confidenceScore !== undefined)
        updateData.confidenceScore = input.confidenceScore;
      if (input.priority !== undefined) updateData.priority = input.priority;
      if (input.context) updateData.context = JSON.stringify(input.context);
      if (input.expiresAt) updateData.expiresAt = input.expiresAt;

      const recommendation = await this.prisma.recommendation.update({
        where: { id },
        data: updateData,
      });

      // Invalidate caches
      await this.invalidateCaches(id);

      this.log.info({ id }, 'Recommendation updated');
      return recommendation;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      this.log.error({ error, id, input }, 'Failed to update recommendation');
      throw new RecommendationError(
        'update',
        `Failed to update recommendation ${id}`,
        error as Error
      );
    }
  }

  /**
   * Delete a recommendation
   *
   * @param id - Recommendation ID
   */
  async delete(id: number): Promise<void> {
    this.log.info({ id }, 'Deleting recommendation');

    try {
      await this.getByIdOrThrow(id);

      await this.prisma.recommendation.delete({
        where: { id },
      });

      // Invalidate caches
      await this.invalidateCaches(id);

      this.log.info({ id }, 'Recommendation deleted');
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      this.log.error({ error, id }, 'Failed to delete recommendation');
      throw new RecommendationError(
        'delete',
        `Failed to delete recommendation ${id}`,
        error as Error
      );
    }
  }

  // ============================================================================
  // State Transition Methods
  // ============================================================================

  /**
   * Mark a recommendation as viewed
   *
   * @param id - Recommendation ID
   * @param userId - User who viewed
   * @returns Updated recommendation
   */
  async markViewed(id: number, userId: number): Promise<Recommendation> {
    this.log.info({ id, userId }, 'Marking recommendation as viewed');

    try {
      const recommendation = await this.getByIdOrThrow(id);

      // Only update if not already in a final state
      if (['DISMISSED', 'APPLIED', 'EXPIRED'].includes(recommendation.status)) {
        this.log.info({ id, status: recommendation.status }, 'Recommendation already in final state');
        return recommendation;
      }

      const updated = await this.prisma.recommendation.update({
        where: { id },
        data: {
          status: 'VIEWED',
          viewedAt: recommendation.viewedAt ?? new Date(),
          viewedBy: recommendation.viewedBy ?? userId,
        },
      });

      // Invalidate caches
      await this.invalidateCaches(id);

      // Publish event
      const payload: RecommendationStateChangePayload = {
        timestamp: new Date(),
        source: 'RecommendationService',
        recommendationId: id,
        userId,
        newStatus: 'VIEWED',
      };
      this.pubsub.publish(AnalyticsEvents.RECOMMENDATION_VIEWED, payload);

      this.log.info({ id, userId }, 'Recommendation marked as viewed');
      return updated;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      this.log.error({ error, id, userId }, 'Failed to mark recommendation as viewed');
      throw new RecommendationError(
        'markViewed',
        `Failed to mark recommendation ${id} as viewed`,
        error as Error
      );
    }
  }

  /**
   * Dismiss a recommendation
   *
   * @param id - Recommendation ID
   * @param userId - User who dismissed
   * @param reason - Optional dismissal reason
   * @returns Updated recommendation
   */
  async dismiss(id: number, userId: number, reason?: string): Promise<Recommendation> {
    this.log.info({ id, userId, reason }, 'Dismissing recommendation');

    try {
      await this.getByIdOrThrow(id);

      const updated = await this.prisma.recommendation.update({
        where: { id },
        data: {
          status: 'DISMISSED',
          dismissedAt: new Date(),
          dismissedBy: userId,
          dismissReason: reason,
        },
      });

      // Invalidate caches
      await this.invalidateCaches(id);

      // Publish event
      const payload: RecommendationStateChangePayload = {
        timestamp: new Date(),
        source: 'RecommendationService',
        recommendationId: id,
        userId,
        newStatus: 'DISMISSED',
        dismissReason: reason,
      };
      this.pubsub.publish(AnalyticsEvents.RECOMMENDATION_DISMISSED, payload);

      this.log.info({ id, userId }, 'Recommendation dismissed');
      return updated;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      this.log.error({ error, id, userId }, 'Failed to dismiss recommendation');
      throw new RecommendationError(
        'dismiss',
        `Failed to dismiss recommendation ${id}`,
        error as Error
      );
    }
  }

  /**
   * Mark a recommendation as applied
   *
   * @param id - Recommendation ID
   * @param userId - User who applied
   * @returns Updated recommendation
   */
  async apply(id: number, userId: number): Promise<Recommendation> {
    this.log.info({ id, userId }, 'Applying recommendation');

    try {
      await this.getByIdOrThrow(id);

      const updated = await this.prisma.recommendation.update({
        where: { id },
        data: {
          status: 'APPLIED',
          appliedAt: new Date(),
          appliedBy: userId,
        },
      });

      // Invalidate caches
      await this.invalidateCaches(id);

      // Publish event
      const payload: RecommendationStateChangePayload = {
        timestamp: new Date(),
        source: 'RecommendationService',
        recommendationId: id,
        userId,
        newStatus: 'APPLIED',
      };
      this.pubsub.publish(AnalyticsEvents.RECOMMENDATION_APPLIED, payload);

      this.log.info({ id, userId }, 'Recommendation applied');
      return updated;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      this.log.error({ error, id, userId }, 'Failed to apply recommendation');
      throw new RecommendationError(
        'apply',
        `Failed to apply recommendation ${id}`,
        error as Error
      );
    }
  }

  /**
   * Expire recommendations that have passed their expiry date
   *
   * @returns Number of expired recommendations
   */
  async expireRecommendations(): Promise<number> {
    this.log.info('Expiring old recommendations');

    try {
      const now = new Date();

      const result = await this.prisma.recommendation.updateMany({
        where: {
          status: { in: ['PENDING', 'VIEWED'] },
          expiresAt: { lte: now },
        },
        data: {
          status: 'EXPIRED',
        },
      });

      if (result.count > 0) {
        // Invalidate list cache
        await this.cacheService.invalidateByPrefix(CACHE_KEYS.RECOMMENDATIONS_LIST);
      }

      this.log.info({ expiredCount: result.count }, 'Recommendations expired');
      return result.count;
    } catch (error) {
      this.log.error({ error }, 'Failed to expire recommendations');
      throw new RecommendationError(
        'expireRecommendations',
        'Failed to expire recommendations',
        error as Error
      );
    }
  }

  /**
   * Delete old expired/dismissed recommendations
   * Keeps recommendations for a configurable period
   *
   * @param daysToKeep - Number of days to keep old recommendations
   * @returns Number of deleted recommendations
   */
  async cleanupOldRecommendations(daysToKeep?: number): Promise<number> {
    const retentionDays = daysToKeep ?? AnalyticsConfig.CLEANUP.RECOMMENDATION_EXPIRY_DAYS;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    this.log.info({ retentionDays, cutoffDate }, 'Cleaning up old recommendations');

    try {
      const result = await this.prisma.recommendation.deleteMany({
        where: {
          status: { in: ['EXPIRED', 'DISMISSED'] },
          createdAt: { lt: cutoffDate },
        },
      });

      if (result.count > 0) {
        await this.cacheService.invalidateByPrefix(CACHE_KEYS.RECOMMENDATIONS_LIST);
      }

      this.log.info({ deletedCount: result.count }, 'Old recommendations cleaned up');
      return result.count;
    } catch (error) {
      this.log.error({ error }, 'Failed to cleanup old recommendations');
      throw new RecommendationError(
        'cleanupOldRecommendations',
        'Failed to cleanup old recommendations',
        error as Error
      );
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Invalidate caches for a recommendation
   */
  private async invalidateCaches(id: number): Promise<void> {
    await Promise.all([
      this.cacheService.del(`${CACHE_KEYS.RECOMMENDATION}:${id}`),
      this.cacheService.invalidateByPrefix(CACHE_KEYS.RECOMMENDATIONS_LIST),
    ]);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Factory function to create RecommendationService
 * ARCHITECTURE: Use factory functions instead of singletons for testability
 *
 * @param prisma - PrismaClient instance
 * @param cacheService - ICacheService implementation
 * @param pubsub - PubSubService instance
 * @returns RecommendationService instance
 */
export function createRecommendationService(
  prisma: PrismaClient,
  cacheService: ICacheService,
  pubsub: PubSubService
): RecommendationService {
  return new RecommendationService(prisma, cacheService, pubsub);
}
