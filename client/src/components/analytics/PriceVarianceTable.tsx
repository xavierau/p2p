/**
 * PriceVarianceTable Component
 *
 * Displays price variance data across branches in a table format.
 * Shows items with price differences and highlights high variance items.
 */

import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { PriceVariance } from '@/types/analytics';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format currency value
 */
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Format percentage
 */
const formatPercentage = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

/**
 * Get variance severity badge variant
 */
const getVarianceBadgeVariant = (
  variance: number
): 'success' | 'warning' | 'error' | 'gray' => {
  if (variance < 5) return 'success';
  if (variance < 10) return 'warning';
  if (variance < 20) return 'error';
  return 'error';
};

/**
 * Get deviation color class
 */
const getDeviationColorClass = (deviation: number): string => {
  if (deviation > 0) return 'text-red-600';
  if (deviation < 0) return 'text-green-600';
  return 'text-muted-foreground';
};

// ============================================================================
// Loading Skeleton
// ============================================================================

const PriceVarianceTableSkeleton: React.FC = () => (
  <Card>
    <CardHeader>
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-64 mt-1" />
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex justify-between items-center">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

// ============================================================================
// Empty State
// ============================================================================

const EmptyState: React.FC<{ message?: string }> = ({
  message = 'No price variance data available',
}) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <svg
      className="h-12 w-12 text-muted-foreground mb-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
    </svg>
    <p className="text-muted-foreground">{message}</p>
  </div>
);

// ============================================================================
// Branch Price Detail Row
// ============================================================================

interface BranchPriceDetailProps {
  branchName: string;
  price: number;
  deviationPercentage: number;
  networkAverage: number;
}

const BranchPriceDetail: React.FC<BranchPriceDetailProps> = ({
  branchName,
  price,
  deviationPercentage,
  networkAverage,
}) => (
  <div className="flex items-center justify-between py-1 px-4 bg-muted/30 text-sm">
    <span className="text-muted-foreground">{branchName}</span>
    <div className="flex items-center gap-4">
      <span>{formatCurrency(price)}</span>
      <span className={`w-16 text-right ${getDeviationColorClass(deviationPercentage)}`}>
        {deviationPercentage > 0 ? '+' : ''}
        {formatPercentage(deviationPercentage)}
      </span>
    </div>
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

export interface PriceVarianceTableProps {
  /** Price variance data */
  variances: PriceVariance[];
  /** Loading state */
  isLoading?: boolean;
  /** Title override */
  title?: string;
  /** Description override */
  description?: string;
  /** Show expanded branch details */
  showBranchDetails?: boolean;
  /** Expanded row ID */
  expandedRowId?: number | null;
  /** Callback when row is expanded */
  onRowExpand?: (itemId: number | null) => void;
  /** Highlight items with variance above this threshold */
  highlightThreshold?: number;
  /** Additional className */
  className?: string;
}

export const PriceVarianceTable: React.FC<PriceVarianceTableProps> = ({
  variances,
  isLoading = false,
  title = 'Price Variance Analysis',
  description = 'Price differences across locations',
  showBranchDetails = true,
  expandedRowId = null,
  onRowExpand,
  highlightThreshold = 10,
  className = '',
}) => {
  if (isLoading) {
    return <PriceVarianceTableSkeleton />;
  }

  const handleRowClick = (itemId: number) => {
    if (onRowExpand) {
      onRowExpand(expandedRowId === itemId ? null : itemId);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {variances.length === 0 ? (
          <EmptyState />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Network Avg</TableHead>
                <TableHead className="text-right">Min</TableHead>
                <TableHead className="text-right">Max</TableHead>
                <TableHead className="text-right">Variance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variances.map((variance) => (
                <React.Fragment key={variance.itemId}>
                  <TableRow
                    className={`
                      ${showBranchDetails && onRowExpand ? 'cursor-pointer hover:bg-muted/50' : ''}
                      ${variance.variancePercentage >= highlightThreshold ? 'bg-red-50 dark:bg-red-950/20' : ''}
                    `}
                    onClick={() => showBranchDetails && handleRowClick(variance.itemId)}
                  >
                    <TableCell className="font-medium">
                      {variance.itemName}
                    </TableCell>
                    <TableCell>{variance.vendorName}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(variance.networkAverage)}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(variance.minPrice)}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {formatCurrency(variance.maxPrice)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={getVarianceBadgeVariant(variance.variancePercentage)}>
                        {formatPercentage(variance.variancePercentage)}
                      </Badge>
                    </TableCell>
                  </TableRow>

                  {/* Expanded Branch Details */}
                  {showBranchDetails && expandedRowId === variance.itemId && (
                    <TableRow>
                      <TableCell colSpan={6} className="p-0">
                        <div className="border-t border-b border-border">
                          <div className="py-2 px-4 bg-muted/50 text-xs font-medium text-muted-foreground">
                            Branch Price Breakdown (Network Avg: {formatCurrency(variance.networkAverage)})
                          </div>
                          {variance.branchPrices.map((branch) => (
                            <BranchPriceDetail
                              key={branch.branchId}
                              branchName={branch.branchName}
                              price={branch.price}
                              deviationPercentage={branch.deviationPercentage}
                              networkAverage={variance.networkAverage}
                            />
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default PriceVarianceTable;
