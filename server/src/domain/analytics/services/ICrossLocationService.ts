/**
 * Cross-location service interface for comparing prices and spending across branches
 * ARCHITECTURE: Clean separation of interface from implementation
 */
export interface ICrossLocationService {
  /**
   * Get price variance for an item across all branches
   * @param itemId - Item to analyze
   * @param vendorId - Optional vendor filter
   * @returns Array of price variance results
   */
  getPriceVariance(itemId: number, vendorId?: number): Promise<PriceVarianceResult[]>;

  /**
   * Get benchmark statistics for an item across the network
   * @param itemId - Item to analyze
   * @returns Benchmark stats or null if insufficient data
   */
  getBenchmarkStats(itemId: number): Promise<BenchmarkStats | null>;

  /**
   * Compare spending by branch for a date range
   * @param startDate - Start of date range
   * @param endDate - End of date range
   * @param itemId - Optional item filter
   * @returns Array of branch spending summaries
   */
  compareSpendingByBranch(
    startDate: Date,
    endDate: Date,
    itemId?: number
  ): Promise<BranchSpending[]>;

  /**
   * Find opportunities to consolidate purchases across branches
   * @returns Array of consolidation opportunities
   */
  findConsolidationOpportunities(): Promise<ConsolidationOpportunity[]>;
}

/**
 * Price variance result for an item across branches
 */
export interface PriceVarianceResult {
  /** Item ID */
  itemId: number;
  /** Item name */
  itemName: string;
  /** Vendor ID */
  vendorId: number;
  /** Vendor name */
  vendorName: string;
  /** Price information by branch */
  branches: BranchPrice[];
  /** Network-wide average price */
  networkAvgPrice: number;
  /** Network-wide minimum price */
  networkMinPrice: number;
  /** Network-wide maximum price */
  networkMaxPrice: number;
  /** Maximum variance percentage across branches */
  maxVariance: number;
}

/**
 * Price information for a specific branch
 */
export interface BranchPrice {
  /** Branch ID (null for unassigned) */
  branchId: number | null;
  /** Branch name */
  branchName: string;
  /** Price at this branch */
  price: number;
  /** Variance from network average as percentage */
  varianceFromAvg: number;
}

/**
 * Benchmark statistics for an item
 */
export interface BenchmarkStats {
  /** Item ID */
  itemId: number;
  /** Average price across network */
  avgPrice: number;
  /** Minimum price in network */
  minPrice: number;
  /** Maximum price in network */
  maxPrice: number;
  /** Price range (max - min) */
  priceRange: number;
  /** Number of branches with data */
  branchCount: number;
}

/**
 * Spending summary for a branch
 */
export interface BranchSpending {
  /** Branch ID */
  branchId: number;
  /** Branch name */
  branchName: string;
  /** Total amount spent */
  totalAmount: number;
  /** Number of invoices */
  invoiceCount: number;
}

/**
 * Consolidation opportunity - items purchased from multiple vendors across branches
 */
export interface ConsolidationOpportunity {
  /** Item ID */
  itemId: number;
  /** Item name */
  itemName: string;
  /** Number of branches purchasing this item */
  branchCount: number;
  /** Number of different vendors used */
  vendorCount: number;
  /** Total spending on this item */
  totalSpending: number;
  /** Breakdown by branch */
  branches: ConsolidationBranchDetail[];
}

/**
 * Branch-level detail for consolidation opportunity
 */
export interface ConsolidationBranchDetail {
  /** Branch ID (null for unassigned) */
  branchId: number | null;
  /** Branch name */
  branchName: string | undefined;
  /** Vendor ID used by this branch (null if multiple) */
  vendorId: number | null;
  /** Vendor name */
  vendorName: string | undefined;
  /** Total amount spent by this branch */
  totalAmount: number;
}
