import { DomainError } from '../domain/shared/DomainError';

/**
 * Base error class for analytics-related errors
 * Extends DomainError to maintain consistency with existing error patterns
 */
export class AnalyticsError extends DomainError {
  constructor(
    /** The operation that failed */
    public readonly operation: string,
    /** Error message */
    message: string,
    /** Original error that caused this failure */
    public readonly cause?: Error
  ) {
    super(`Analytics computation failed [${operation}]: ${message}`);
    this.name = 'AnalyticsError';
  }
}

/**
 * Error thrown when aggregation operations fail
 */
export class AggregationError extends AnalyticsError {
  constructor(
    operation: string,
    message: string = 'Aggregation failed',
    cause?: Error
  ) {
    super(operation, message, cause);
    this.name = 'AggregationError';
  }
}

/**
 * Error thrown when pattern recognition operations fail
 */
export class PatternRecognitionError extends AnalyticsError {
  constructor(
    operation: string,
    message: string = 'Pattern recognition failed',
    cause?: Error
  ) {
    super(operation, message, cause);
    this.name = 'PatternRecognitionError';
  }
}

/**
 * Error thrown when cross-location analysis operations fail
 */
export class CrossLocationError extends AnalyticsError {
  constructor(
    operation: string,
    message: string = 'Cross-location analysis failed',
    cause?: Error
  ) {
    super(operation, message, cause);
    this.name = 'CrossLocationError';
  }
}

/**
 * Error thrown when recommendation generation/processing fails
 */
export class RecommendationError extends AnalyticsError {
  constructor(
    operation: string,
    message: string = 'Recommendation operation failed',
    cause?: Error
  ) {
    super(operation, message, cause);
    this.name = 'RecommendationError';
  }
}

/**
 * Error thrown when cache operations fail
 */
export class CacheError extends AnalyticsError {
  constructor(
    operation: string,
    message: string = 'Cache operation failed',
    cause?: Error
  ) {
    super(operation, message, cause);
    this.name = 'CacheError';
  }
}

/**
 * Error thrown when job queue operations fail
 */
export class JobQueueError extends AnalyticsError {
  constructor(
    operation: string,
    message: string = 'Job queue operation failed',
    cause?: Error
  ) {
    super(operation, message, cause);
    this.name = 'JobQueueError';
  }
}

/**
 * Error thrown when there is insufficient data for analysis
 */
export class InsufficientDataError extends AnalyticsError {
  constructor(
    operation: string,
    /** Minimum required data points */
    public readonly requiredCount: number,
    /** Actual data points available */
    public readonly actualCount: number
  ) {
    super(
      operation,
      `Insufficient data for analysis. Required: ${requiredCount}, Available: ${actualCount}`
    );
    this.name = 'InsufficientDataError';
  }
}

/**
 * Error thrown when statistical calculations encounter edge cases
 */
export class StatisticalError extends AnalyticsError {
  constructor(
    operation: string,
    message: string = 'Statistical calculation error',
    cause?: Error
  ) {
    super(operation, message, cause);
    this.name = 'StatisticalError';
  }
}
