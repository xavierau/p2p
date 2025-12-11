/**
 * Analytics Domain Services Index
 * Exports all service interfaces for the analytics bounded context
 */

export type { ICacheService } from './ICacheService';
export type { IAggregationService } from './IAggregationService';
export type {
  IPatternRecognitionService,
  Anomaly,
  AnomalyType,
} from './IPatternRecognitionService';
export type {
  ICrossLocationService,
  PriceVarianceResult,
  BranchPrice,
  BenchmarkStats,
  BranchSpending,
  ConsolidationOpportunity,
  ConsolidationBranchDetail,
} from './ICrossLocationService';
