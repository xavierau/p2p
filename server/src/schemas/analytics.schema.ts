import { z } from 'zod';

// ============================================================================
// Common Analytics Schemas
// ============================================================================

/**
 * Date string schema that accepts ISO datetime strings
 */
const dateStringSchema = z.string().datetime().or(z.string().date());

/**
 * Pagination schema for analytics queries
 */
export const AnalyticsPaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ============================================================================
// Spending Metric Schemas
// ============================================================================

/**
 * Query parameters for spending metrics endpoint
 */
export const SpendingMetricQuerySchema = z.object({
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
  itemId: z.coerce.number().int().positive().optional(),
  vendorId: z.coerce.number().int().positive().optional(),
  branchId: z.coerce.number().int().positive().optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  costCenterId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type SpendingMetricQuery = z.infer<typeof SpendingMetricQuerySchema>;

// ============================================================================
// Price Variance Schemas
// ============================================================================

/**
 * Query parameters for price variance endpoint
 */
export const PriceVarianceQuerySchema = z.object({
  itemId: z.coerce.number().int().positive(),
  vendorId: z.coerce.number().int().positive().optional(),
});

export type PriceVarianceQuery = z.infer<typeof PriceVarianceQuerySchema>;

/**
 * Query parameters for price comparison endpoint
 */
export const PriceComparisonQuerySchema = z.object({
  itemIds: z
    .string()
    .transform((val) => val.split(',').map((id) => parseInt(id, 10)))
    .pipe(z.array(z.number().int().positive()))
    .optional(),
  vendorId: z.coerce.number().int().positive().optional(),
  branchId: z.coerce.number().int().positive().optional(),
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
});

export type PriceComparisonQuery = z.infer<typeof PriceComparisonQuerySchema>;

// ============================================================================
// Purchase Pattern Schemas
// ============================================================================

/**
 * Query parameters for purchase patterns endpoint
 */
export const PurchasePatternQuerySchema = z.object({
  itemId: z.coerce.number().int().positive().optional(),
  branchId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type PurchasePatternQuery = z.infer<typeof PurchasePatternQuerySchema>;

// ============================================================================
// Recommendation Schemas
// ============================================================================

/**
 * Valid recommendation status values
 * NOTE: Must match Prisma enum RecommendationStatus in schema.prisma
 */
export const RecommendationStatusValues = [
  'PENDING',
  'VIEWED',
  'DISMISSED',
  'APPLIED',
  'EXPIRED',
] as const;

/**
 * Valid recommendation type values
 * NOTE: Must match Prisma enum RecommendationType in schema.prisma
 */
export const RecommendationTypeValues = [
  'COST_OPTIMIZATION',
  'VENDOR_SWITCH',
  'CONSOLIDATION',
  'WASTE_PREVENTION',
  'RISK_ALERT',
  'SEASONAL_OPPORTUNITY',
  'INVENTORY_REORDER',
  'PRICE_NEGOTIATION',
] as const;

/**
 * Query parameters for recommendations list endpoint
 */
export const RecommendationQuerySchema = z.object({
  status: z.enum(RecommendationStatusValues).optional(),
  type: z.enum(RecommendationTypeValues).optional(),
  priority: z.coerce.number().int().min(1).max(5).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type RecommendationQuery = z.infer<typeof RecommendationQuerySchema>;

/**
 * Request body for dismissing a recommendation
 * ARCHITECTURE: Uses PATCH for state changes per REST conventions
 */
export const RecommendationDismissSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type RecommendationDismiss = z.infer<typeof RecommendationDismissSchema>;

/**
 * Request body for marking a recommendation as applied
 */
export const RecommendationApplySchema = z.object({
  notes: z.string().max(1000).optional(),
});

export type RecommendationApply = z.infer<typeof RecommendationApplySchema>;

// ============================================================================
// Branch Spending Schemas
// ============================================================================

/**
 * Query parameters for branch spending comparison endpoint
 */
export const BranchSpendingQuerySchema = z.object({
  startDate: dateStringSchema,
  endDate: dateStringSchema,
  itemId: z.coerce.number().int().positive().optional(),
  departmentId: z.coerce.number().int().positive().optional(),
});

export type BranchSpendingQuery = z.infer<typeof BranchSpendingQuerySchema>;

// ============================================================================
// Anomaly Detection Schemas
// ============================================================================

/**
 * Query parameters for anomaly detection endpoint
 */
export const AnomalyQuerySchema = z.object({
  itemId: z.coerce.number().int().positive().optional(),
  branchId: z.coerce.number().int().positive().optional(),
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
  minDeviation: z.coerce.number().positive().default(2), // Standard deviations
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type AnomalyQuery = z.infer<typeof AnomalyQuerySchema>;

// ============================================================================
// Analytics Job Schemas
// ============================================================================

/**
 * Request body for manually triggering an analytics job
 */
export const TriggerJobSchema = z.object({
  jobName: z.enum([
    'compute-spending-metrics',
    'compute-price-benchmarks',
    'analyze-purchase-patterns',
    'generate-recommendations',
    'detect-anomalies',
    'cleanup-expired-recommendations',
  ]),
  date: dateStringSchema.optional(),
});

export type TriggerJobInput = z.infer<typeof TriggerJobSchema>;

// ============================================================================
// Health Check Schemas
// ============================================================================

/**
 * Response schema for analytics health check
 */
export const AnalyticsHealthSchema = z.object({
  redis: z.object({
    connected: z.boolean(),
    latencyMs: z.number().optional(),
  }),
  queues: z.object({
    aggregation: z.object({
      active: z.number(),
      waiting: z.number(),
      completed: z.number(),
      failed: z.number(),
    }),
    pattern: z.object({
      active: z.number(),
      waiting: z.number(),
      completed: z.number(),
      failed: z.number(),
    }),
    recommendations: z.object({
      active: z.number(),
      waiting: z.number(),
      completed: z.number(),
      failed: z.number(),
    }),
  }),
  lastJobRuns: z.record(z.string().datetime().nullable()),
});

export type AnalyticsHealth = z.infer<typeof AnalyticsHealthSchema>;
