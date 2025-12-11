import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getPrismaMock } from '../../helpers/prisma-mock';
import { RecommendationType } from '@prisma/client';

// Get the mocked prisma instance
const prismaMock = getPrismaMock();

// Mock recommendation service
const mockRecommendationService = {
  create: vi.fn(),
  createMany: vi.fn(),
  getById: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  markViewed: vi.fn(),
  dismiss: vi.fn(),
  apply: vi.fn(),
};

// Import after mocks
import {
  RuleEngine,
  createRuleEngine,
  Rule,
  RuleContext,
  defineRule,
} from '../../../services/recommendations/ruleEngine';
import { RecommendationError } from '../../../errors/AnalyticsError';

describe('RuleEngine', () => {
  let engine: RuleEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = createRuleEngine(prismaMock as any, mockRecommendationService as any);
  });

  // Helper to create a test rule
  const createTestRule = (overrides: Partial<Rule> = {}): Rule => ({
    id: 'test-rule-1',
    name: 'Test Rule',
    description: 'A test rule',
    recommendationType: 'COST_SAVINGS' as RecommendationType,
    category: 'pricing',
    defaultPriority: 2,
    minConfidenceThreshold: 0.6,
    isActive: true,
    evaluate: vi.fn().mockResolvedValue({
      triggered: false,
      recommendations: [],
    }),
    ...overrides,
  });

  // ============================================================================
  // Rule Management
  // ============================================================================
  describe('registerRule', () => {
    it('should register a new rule', () => {
      // Arrange
      const rule = createTestRule();

      // Act
      engine.registerRule(rule);

      // Assert
      expect(engine.getRules()).toContainEqual(rule);
    });

    it('should throw error when registering duplicate rule ID', () => {
      // Arrange
      const rule = createTestRule();
      engine.registerRule(rule);

      // Act & Assert
      expect(() => engine.registerRule(rule)).toThrow("Rule with ID 'test-rule-1' is already registered");
    });

    it('should register multiple rules with different IDs', () => {
      // Arrange
      const rule1 = createTestRule({ id: 'rule-1' });
      const rule2 = createTestRule({ id: 'rule-2' });

      // Act
      engine.registerRule(rule1);
      engine.registerRule(rule2);

      // Assert
      expect(engine.getRules().length).toBe(2);
    });
  });

  describe('registerRules', () => {
    it('should register multiple rules at once', () => {
      // Arrange
      const rules = [
        createTestRule({ id: 'rule-1' }),
        createTestRule({ id: 'rule-2' }),
        createTestRule({ id: 'rule-3' }),
      ];

      // Act
      engine.registerRules(rules);

      // Assert
      expect(engine.getRules().length).toBe(3);
    });
  });

  describe('unregisterRule', () => {
    it('should remove a registered rule', () => {
      // Arrange
      const rule = createTestRule();
      engine.registerRule(rule);

      // Act
      const result = engine.unregisterRule('test-rule-1');

      // Assert
      expect(result).toBe(true);
      expect(engine.getRules()).not.toContainEqual(rule);
    });

    it('should return false when rule not found', () => {
      // Act
      const result = engine.unregisterRule('non-existent');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getRules', () => {
    it('should return all registered rules', () => {
      // Arrange
      const rule1 = createTestRule({ id: 'rule-1' });
      const rule2 = createTestRule({ id: 'rule-2' });
      engine.registerRule(rule1);
      engine.registerRule(rule2);

      // Act
      const rules = engine.getRules();

      // Assert
      expect(rules.length).toBe(2);
    });

    it('should return empty array when no rules registered', () => {
      // Act
      const rules = engine.getRules();

      // Assert
      expect(rules).toEqual([]);
    });
  });

  describe('getActiveRules', () => {
    it('should return only active rules', () => {
      // Arrange
      const activeRule = createTestRule({ id: 'active', isActive: true });
      const inactiveRule = createTestRule({ id: 'inactive', isActive: false });
      engine.registerRule(activeRule);
      engine.registerRule(inactiveRule);

      // Act
      const activeRules = engine.getActiveRules();

      // Assert
      expect(activeRules.length).toBe(1);
      expect(activeRules[0].id).toBe('active');
    });
  });

  describe('setRuleActive', () => {
    it('should enable a disabled rule', () => {
      // Arrange
      const rule = createTestRule({ isActive: false });
      engine.registerRule(rule);

      // Act
      const result = engine.setRuleActive('test-rule-1', true);

      // Assert
      expect(result).toBe(true);
      expect(engine.getActiveRules().length).toBe(1);
    });

    it('should disable an enabled rule', () => {
      // Arrange
      const rule = createTestRule({ isActive: true });
      engine.registerRule(rule);

      // Act
      const result = engine.setRuleActive('test-rule-1', false);

      // Assert
      expect(result).toBe(true);
      expect(engine.getActiveRules().length).toBe(0);
    });

    it('should return false when rule not found', () => {
      // Act
      const result = engine.setRuleActive('non-existent', true);

      // Assert
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // Rule Evaluation
  // ============================================================================
  describe('evaluateRule', () => {
    it('should evaluate a single rule by ID', async () => {
      // Arrange
      const evaluateMock = vi.fn().mockResolvedValue({
        triggered: true,
        recommendations: [
          {
            type: 'COST_SAVINGS' as RecommendationType,
            category: 'pricing',
            title: 'Test',
            description: 'Desc',
            reasoning: 'Reason',
            context: {},
          },
        ],
      });
      const rule = createTestRule({ evaluate: evaluateMock });
      engine.registerRule(rule);

      // Act
      const result = await engine.evaluateRule('test-rule-1');

      // Assert
      expect(result.triggered).toBe(true);
      expect(result.recommendations.length).toBe(1);
      expect(evaluateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          prisma: expect.any(Object),
          currentDate: expect.any(Date),
        })
      );
    });

    it('should pass custom context to rule', async () => {
      // Arrange
      const evaluateMock = vi.fn().mockResolvedValue({
        triggered: false,
        recommendations: [],
      });
      const rule = createTestRule({ evaluate: evaluateMock });
      engine.registerRule(rule);

      const customContext = {
        itemIds: [1, 2, 3],
        branchIds: [10, 20],
      };

      // Act
      await engine.evaluateRule('test-rule-1', customContext);

      // Assert
      expect(evaluateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          itemIds: [1, 2, 3],
          branchIds: [10, 20],
        })
      );
    });

    it('should throw RecommendationError when rule not found', async () => {
      // Act & Assert
      await expect(engine.evaluateRule('non-existent')).rejects.toThrow(RecommendationError);
    });

    it('should return error result when rule evaluation fails', async () => {
      // Arrange
      const evaluateMock = vi.fn().mockRejectedValue(new Error('Rule failed'));
      const rule = createTestRule({ evaluate: evaluateMock });
      engine.registerRule(rule);

      // Act
      const result = await engine.evaluateRule('test-rule-1');

      // Assert
      expect(result.triggered).toBe(false);
      expect(result.recommendations).toEqual([]);
      expect(result.error).toBeDefined();
    });
  });

  describe('evaluateRules', () => {
    it('should evaluate all active rules', async () => {
      // Arrange
      const rule1Eval = vi.fn().mockResolvedValue({
        triggered: true,
        recommendations: [
          {
            type: 'COST_SAVINGS' as RecommendationType,
            category: 'pricing',
            title: 'Rec 1',
            description: 'Desc',
            reasoning: 'Reason',
            context: {},
            confidenceScore: 0.8,
          },
        ],
      });
      const rule2Eval = vi.fn().mockResolvedValue({
        triggered: true,
        recommendations: [
          {
            type: 'VENDOR_CONSOLIDATION' as RecommendationType,
            category: 'vendor',
            title: 'Rec 2',
            description: 'Desc',
            reasoning: 'Reason',
            context: {},
            confidenceScore: 0.7,
          },
        ],
      });

      engine.registerRule(createTestRule({ id: 'rule-1', evaluate: rule1Eval }));
      engine.registerRule(createTestRule({ id: 'rule-2', evaluate: rule2Eval }));
      mockRecommendationService.createMany.mockResolvedValue(2);

      // Act
      const summary = await engine.evaluateRules();

      // Assert
      expect(summary.rulesEvaluated).toBe(2);
      expect(summary.rulesTriggered).toBe(2);
      expect(summary.rulesFailed).toBe(0);
      expect(summary.recommendationsGenerated).toBe(2);
      expect(mockRecommendationService.createMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Rec 1' }),
          expect.objectContaining({ title: 'Rec 2' }),
        ])
      );
    });

    it('should not evaluate inactive rules', async () => {
      // Arrange
      const activeEval = vi.fn().mockResolvedValue({ triggered: false, recommendations: [] });
      const inactiveEval = vi.fn().mockResolvedValue({ triggered: false, recommendations: [] });

      engine.registerRule(createTestRule({ id: 'active', isActive: true, evaluate: activeEval }));
      engine.registerRule(createTestRule({ id: 'inactive', isActive: false, evaluate: inactiveEval }));

      // Act
      const summary = await engine.evaluateRules();

      // Assert
      expect(summary.rulesEvaluated).toBe(1);
      expect(activeEval).toHaveBeenCalled();
      expect(inactiveEval).not.toHaveBeenCalled();
    });

    it('should filter recommendations below confidence threshold', async () => {
      // Arrange
      const evaluateMock = vi.fn().mockResolvedValue({
        triggered: true,
        recommendations: [
          {
            type: 'COST_SAVINGS' as RecommendationType,
            category: 'pricing',
            title: 'High Confidence',
            description: 'Desc',
            reasoning: 'Reason',
            context: {},
            confidenceScore: 0.8, // Above threshold
          },
          {
            type: 'COST_SAVINGS' as RecommendationType,
            category: 'pricing',
            title: 'Low Confidence',
            description: 'Desc',
            reasoning: 'Reason',
            context: {},
            confidenceScore: 0.3, // Below threshold of 0.6
          },
        ],
      });

      engine.registerRule(createTestRule({
        evaluate: evaluateMock,
        minConfidenceThreshold: 0.6,
      }));
      mockRecommendationService.createMany.mockResolvedValue(1);

      // Act
      const summary = await engine.evaluateRules();

      // Assert
      expect(summary.recommendationsGenerated).toBe(1);
      expect(mockRecommendationService.createMany).toHaveBeenCalledWith([
        expect.objectContaining({ title: 'High Confidence' }),
      ]);
    });

    it('should handle rule evaluation failures gracefully', async () => {
      // Arrange
      const failingRule = createTestRule({
        id: 'failing',
        evaluate: vi.fn().mockRejectedValue(new Error('Rule error')),
      });
      const successRule = createTestRule({
        id: 'success',
        evaluate: vi.fn().mockResolvedValue({ triggered: false, recommendations: [] }),
      });

      engine.registerRule(failingRule);
      engine.registerRule(successRule);

      // Act
      const summary = await engine.evaluateRules();

      // Assert
      expect(summary.rulesEvaluated).toBe(2);
      expect(summary.rulesFailed).toBe(1);
      expect(summary.rulesTriggered).toBe(0);
    });

    it('should return summary with byType breakdown', async () => {
      // Arrange
      const evaluateMock = vi.fn().mockResolvedValue({
        triggered: true,
        recommendations: [
          { type: 'COST_SAVINGS', category: 'p', title: 'T', description: 'D', reasoning: 'R', context: {}, confidenceScore: 0.8 },
          { type: 'COST_SAVINGS', category: 'p', title: 'T', description: 'D', reasoning: 'R', context: {}, confidenceScore: 0.8 },
          { type: 'VENDOR_CONSOLIDATION', category: 'v', title: 'T', description: 'D', reasoning: 'R', context: {}, confidenceScore: 0.8 },
        ],
      });

      engine.registerRule(createTestRule({ evaluate: evaluateMock }));
      mockRecommendationService.createMany.mockResolvedValue(3);

      // Act
      const summary = await engine.evaluateRules();

      // Assert
      expect(summary.byType['COST_SAVINGS']).toBe(2);
      expect(summary.byType['VENDOR_CONSOLIDATION']).toBe(1);
    });

    it('should include duration in summary', async () => {
      // Arrange
      engine.registerRule(createTestRule({
        evaluate: vi.fn().mockResolvedValue({ triggered: false, recommendations: [] }),
      }));

      // Act
      const summary = await engine.evaluateRules();

      // Assert
      expect(summary.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should throw RecommendationError when createMany fails', async () => {
      // Arrange
      engine.registerRule(createTestRule({
        evaluate: vi.fn().mockResolvedValue({
          triggered: true,
          recommendations: [
            { type: 'COST_SAVINGS', category: 'p', title: 'T', description: 'D', reasoning: 'R', context: {}, confidenceScore: 0.8 },
          ],
        }),
      }));
      mockRecommendationService.createMany.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(engine.evaluateRules()).rejects.toThrow(RecommendationError);
    });
  });

  describe('evaluateRulesForItems', () => {
    it('should pass itemIds in context', async () => {
      // Arrange
      const evaluateMock = vi.fn().mockResolvedValue({ triggered: false, recommendations: [] });
      engine.registerRule(createTestRule({ evaluate: evaluateMock }));

      // Act
      await engine.evaluateRulesForItems([1, 2, 3]);

      // Assert
      expect(evaluateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          itemIds: [1, 2, 3],
        })
      );
    });
  });

  describe('evaluateRulesForBranches', () => {
    it('should pass branchIds in context', async () => {
      // Arrange
      const evaluateMock = vi.fn().mockResolvedValue({ triggered: false, recommendations: [] });
      engine.registerRule(createTestRule({ evaluate: evaluateMock }));

      // Act
      await engine.evaluateRulesForBranches([10, 20, 30]);

      // Assert
      expect(evaluateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          branchIds: [10, 20, 30],
        })
      );
    });
  });

  // ============================================================================
  // defineRule Helper
  // ============================================================================
  describe('defineRule', () => {
    it('should create rule with default isActive=true', () => {
      // Act
      const rule = defineRule({
        id: 'test',
        name: 'Test',
        description: 'Desc',
        recommendationType: 'COST_SAVINGS' as RecommendationType,
        category: 'pricing',
        defaultPriority: 2,
        minConfidenceThreshold: 0.6,
        evaluate: vi.fn(),
      });

      // Assert
      expect(rule.isActive).toBe(true);
    });

    it('should allow overriding isActive', () => {
      // Act
      const rule = defineRule({
        id: 'test',
        name: 'Test',
        description: 'Desc',
        recommendationType: 'COST_SAVINGS' as RecommendationType,
        category: 'pricing',
        defaultPriority: 2,
        minConfidenceThreshold: 0.6,
        isActive: false,
        evaluate: vi.fn(),
      });

      // Assert
      expect(rule.isActive).toBe(false);
    });
  });
});
