/**
 * Analytics Services Index
 * Re-exports all analytics service implementations and factory functions
 *
 * ARCHITECTURE: Services implement domain interfaces and use dependency injection
 */

// Aggregation Service
export {
  AggregationService,
  createAggregationService,
} from './aggregationService';

// Pattern Recognition Service
export {
  PatternRecognitionService,
  createPatternRecognitionService,
} from './patternRecognitionService';

// Cross-Location Service
export {
  CrossLocationService,
  createCrossLocationService,
} from './crossLocationService';
