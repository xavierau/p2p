import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Job } from 'bull';

// Mock aggregation service
const mockAggregationService = {
  computeDailySpendingMetrics: vi.fn(),
  computePriceBenchmarks: vi.fn(),
  refreshMaterializedViews: vi.fn(),
};

// Import after mocks
import {
  createComputeSpendingMetricsProcessor,
  ComputeSpendingMetricsJobData,
} from '../../../jobs/analytics/computeSpendingMetricsJob';

describe('computeSpendingMetricsJob', () => {
  let processor: (job: Job<ComputeSpendingMetricsJobData>) => Promise<void>;

  // Fixed date for deterministic tests
  const FIXED_NOW = new Date('2024-06-15T12:00:00.000Z');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    mockAggregationService.computeDailySpendingMetrics.mockResolvedValue(undefined);
    processor = createComputeSpendingMetricsProcessor(mockAggregationService as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper to create a mock job
  const createMockJob = (data: ComputeSpendingMetricsJobData = {}): Job<ComputeSpendingMetricsJobData> =>
    ({
      id: '1',
      data,
      progress: vi.fn(),
      log: vi.fn(),
    }) as any;

  describe('processor', () => {
    it('should use yesterday as default date when no date provided', async () => {
      // Arrange
      const job = createMockJob({});
      // FIXED_NOW is 2024-06-15, so yesterday is 2024-06-14
      const expectedYesterday = '2024-06-14';

      // Act
      await processor(job);

      // Assert
      expect(mockAggregationService.computeDailySpendingMetrics).toHaveBeenCalledTimes(1);
      const calledDate = mockAggregationService.computeDailySpendingMetrics.mock.calls[0][0] as Date;
      // Compare date parts only
      expect(calledDate.toISOString().split('T')[0]).toBe(expectedYesterday);
    });

    it('should use custom date when provided', async () => {
      // Arrange
      const customDate = '2024-01-15';
      const job = createMockJob({ date: customDate });

      // Act
      await processor(job);

      // Assert
      expect(mockAggregationService.computeDailySpendingMetrics).toHaveBeenCalledTimes(1);
      const calledDate = mockAggregationService.computeDailySpendingMetrics.mock.calls[0][0] as Date;
      expect(calledDate.toISOString().split('T')[0]).toBe('2024-01-15');
    });

    it('should throw error for invalid date', async () => {
      // Arrange
      const job = createMockJob({ date: 'not-a-date' });

      // Act & Assert
      await expect(processor(job)).rejects.toThrow('Invalid date provided: not-a-date');
    });

    it('should propagate errors from aggregation service', async () => {
      // Arrange
      const job = createMockJob({});
      mockAggregationService.computeDailySpendingMetrics.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(processor(job)).rejects.toThrow('DB error');
    });

    it('should handle edge case dates', async () => {
      // Arrange - Test leap year date
      const job = createMockJob({ date: '2024-02-29' });

      // Act
      await processor(job);

      // Assert
      const calledDate = mockAggregationService.computeDailySpendingMetrics.mock.calls[0][0] as Date;
      expect(calledDate.toISOString().split('T')[0]).toBe('2024-02-29');
    });

    it('should handle ISO 8601 date format', async () => {
      // Arrange
      const job = createMockJob({ date: '2024-06-15T00:00:00.000Z' });

      // Act
      await processor(job);

      // Assert
      expect(mockAggregationService.computeDailySpendingMetrics).toHaveBeenCalled();
    });
  });
});
