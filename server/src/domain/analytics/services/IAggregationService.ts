/**
 * Aggregation service interface for computing spending metrics and benchmarks
 * ARCHITECTURE: Clean separation of interface from implementation
 */
export interface IAggregationService {
  /**
   * Compute daily spending metrics for a specific date
   * Groups by all dimensions: item, vendor, branch, department, cost center
   * @param date - The date to compute metrics for
   */
  computeDailySpendingMetrics(date: Date): Promise<void>;

  /**
   * Compute price benchmarks across all branches for a specific date
   * Calculates network average, min, max prices and variance from average
   * @param date - The date to compute benchmarks for
   */
  computePriceBenchmarks(date: Date): Promise<void>;

  /**
   * Refresh any materialized views or aggregated data structures
   * Used for maintenance and data consistency
   */
  refreshMaterializedViews(): Promise<void>;
}
