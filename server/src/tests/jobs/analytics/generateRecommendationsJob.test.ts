import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Job } from 'bull';

// Mock rule engine
const mockRuleEngine = {
  getActiveRules: vi.fn(),
  evaluateRules: vi.fn(),
  registerRule: vi.fn(),
};

// Import after mocks
import {
  createGenerateRecommendationsProcessor,
  GenerateRecommendationsJobData,
} from '../../../jobs/analytics/generateRecommendationsJob';

describe('generateRecommendationsJob', () => {
  let processor: (job: Job<GenerateRecommendationsJobData>) => Promise<void>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRuleEngine.getActiveRules.mockReturnValue([
      { id: 'rule-1', name: 'Test Rule' },
    ]);
    mockRuleEngine.evaluateRules.mockResolvedValue({
      rulesEvaluated: 1,
      rulesTriggered: 1,
      rulesFailed: 0,
      recommendationsGenerated: 2,
      byType: { COST_SAVINGS: 2 },
      durationMs: 100,
    });
    processor = createGenerateRecommendationsProcessor(mockRuleEngine as any);
  });

  // Helper to create a mock job
  const createMockJob = (data: GenerateRecommendationsJobData = {}): Job<GenerateRecommendationsJobData> =>
    ({
      id: '1',
      data,
      progress: vi.fn(),
      log: vi.fn(),
    }) as any;

  describe('processor', () => {
    it('should skip evaluation when no active rules', async () => {
      // Arrange
      mockRuleEngine.getActiveRules.mockReturnValue([]);
      const job = createMockJob({});

      // Act
      await processor(job);

      // Assert
      expect(mockRuleEngine.evaluateRules).not.toHaveBeenCalled();
    });

    it('should evaluate rules when active rules exist', async () => {
      // Arrange
      const job = createMockJob({});

      // Act
      await processor(job);

      // Assert
      expect(mockRuleEngine.evaluateRules).toHaveBeenCalledWith(
        expect.any(Object)
      );
    });

    it('should pass itemIds context when provided', async () => {
      // Arrange
      const job = createMockJob({ itemIds: [1, 2, 3] });

      // Act
      await processor(job);

      // Assert
      expect(mockRuleEngine.evaluateRules).toHaveBeenCalledWith(
        expect.objectContaining({
          itemIds: [1, 2, 3],
        })
      );
    });

    it('should pass branchIds context when provided', async () => {
      // Arrange
      const job = createMockJob({ branchIds: [10, 20] });

      // Act
      await processor(job);

      // Assert
      expect(mockRuleEngine.evaluateRules).toHaveBeenCalledWith(
        expect.objectContaining({
          branchIds: [10, 20],
        })
      );
    });

    it('should pass vendorIds context when provided', async () => {
      // Arrange
      const job = createMockJob({ vendorIds: [100, 200, 300] });

      // Act
      await processor(job);

      // Assert
      expect(mockRuleEngine.evaluateRules).toHaveBeenCalledWith(
        expect.objectContaining({
          vendorIds: [100, 200, 300],
        })
      );
    });

    it('should build context from multiple job data fields', async () => {
      // Arrange
      const job = createMockJob({
        itemIds: [1, 2],
        branchIds: [10],
        vendorIds: [100],
      });

      // Act
      await processor(job);

      // Assert
      expect(mockRuleEngine.evaluateRules).toHaveBeenCalledWith({
        itemIds: [1, 2],
        branchIds: [10],
        vendorIds: [100],
      });
    });

    it('should not include empty arrays in context', async () => {
      // Arrange
      const job = createMockJob({
        itemIds: [],
        branchIds: [10],
      });

      // Act
      await processor(job);

      // Assert
      expect(mockRuleEngine.evaluateRules).toHaveBeenCalledWith({
        branchIds: [10],
      });
    });

    it('should throw error when all rules failed', async () => {
      // Arrange
      mockRuleEngine.evaluateRules.mockResolvedValue({
        rulesEvaluated: 3,
        rulesTriggered: 0,
        rulesFailed: 3, // All failed
        recommendationsGenerated: 0,
        byType: {},
        durationMs: 50,
      });
      const job = createMockJob({});

      // Act & Assert
      await expect(processor(job)).rejects.toThrow('All rules failed to evaluate');
    });

    it('should not throw when some rules succeed', async () => {
      // Arrange
      mockRuleEngine.evaluateRules.mockResolvedValue({
        rulesEvaluated: 3,
        rulesTriggered: 1,
        rulesFailed: 2, // Some failed, but not all
        recommendationsGenerated: 1,
        byType: { COST_SAVINGS: 1 },
        durationMs: 50,
      });
      const job = createMockJob({});

      // Act
      await processor(job);

      // Assert - Should not throw
      expect(mockRuleEngine.evaluateRules).toHaveBeenCalled();
    });

    it('should propagate errors from rule engine', async () => {
      // Arrange
      mockRuleEngine.evaluateRules.mockRejectedValue(new Error('Rule engine error'));
      const job = createMockJob({});

      // Act & Assert
      await expect(processor(job)).rejects.toThrow('Rule engine error');
    });

    it('should handle zero recommendations gracefully', async () => {
      // Arrange
      mockRuleEngine.evaluateRules.mockResolvedValue({
        rulesEvaluated: 1,
        rulesTriggered: 0,
        rulesFailed: 0,
        recommendationsGenerated: 0,
        byType: {},
        durationMs: 10,
      });
      const job = createMockJob({});

      // Act
      await processor(job);

      // Assert - Should complete without error
      expect(mockRuleEngine.evaluateRules).toHaveBeenCalled();
    });
  });
});
