/**
 * SpendingMetricsCard Component
 *
 * Displays spending summary metrics in a card format.
 * Shows total spending, transaction count, and top categories.
 */

import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { SpendingSummary } from '@/types/analytics';

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
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Format percentage
 */
const formatPercentage = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

// ============================================================================
// Sub-components
// ============================================================================

interface MetricItemProps {
  label: string;
  value: string | number;
  subValue?: string;
}

const MetricItem: React.FC<MetricItemProps> = ({ label, value, subValue }) => (
  <div className="flex flex-col">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-2xl font-bold">{value}</span>
    {subValue && (
      <span className="text-xs text-muted-foreground">{subValue}</span>
    )}
  </div>
);

interface TopItemProps {
  name: string;
  amount: number;
  percentage: number;
}

const TopItem: React.FC<TopItemProps> = ({ name, amount, percentage }) => (
  <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium truncate">{name}</p>
      <p className="text-xs text-muted-foreground">{formatCurrency(amount)}</p>
    </div>
    <div className="ml-4">
      <span className="text-sm font-medium">{formatPercentage(percentage)}</span>
    </div>
  </div>
);

// ============================================================================
// Loading Skeleton
// ============================================================================

const SpendingMetricsCardSkeleton: React.FC = () => (
  <Card>
    <CardHeader>
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-60 mt-1" />
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-16" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

// ============================================================================
// Main Component
// ============================================================================

export interface SpendingMetricsCardProps {
  /** Spending summary data */
  summary: SpendingSummary | null;
  /** Loading state */
  isLoading?: boolean;
  /** Title override */
  title?: string;
  /** Description override */
  description?: string;
  /** Show top vendors section */
  showTopVendors?: boolean;
  /** Show top items section */
  showTopItems?: boolean;
  /** Show by branch section */
  showByBranch?: boolean;
  /** Maximum items to show in top lists */
  maxTopItems?: number;
  /** Additional className */
  className?: string;
}

export const SpendingMetricsCard: React.FC<SpendingMetricsCardProps> = ({
  summary,
  isLoading = false,
  title = 'Spending Overview',
  description = 'Summary of spending metrics',
  showTopVendors = true,
  showTopItems = false,
  showByBranch = false,
  maxTopItems = 5,
  className = '',
}) => {
  if (isLoading) {
    return <SpendingMetricsCardSkeleton />;
  }

  if (!summary) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>No data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Main Metrics */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <MetricItem
            label="Total Spending"
            value={formatCurrency(summary.totalSpending)}
          />
          <MetricItem
            label="Transactions"
            value={summary.totalTransactions.toLocaleString()}
          />
          <MetricItem
            label="Avg Transaction"
            value={formatCurrency(summary.averageTransactionValue)}
          />
        </div>

        {/* Top Vendors */}
        {showTopVendors && summary.topVendors.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold mb-2">Top Vendors</h4>
            <div className="space-y-1">
              {summary.topVendors.slice(0, maxTopItems).map((vendor) => (
                <TopItem
                  key={vendor.vendorId}
                  name={vendor.vendorName}
                  amount={vendor.totalAmount}
                  percentage={vendor.percentage}
                />
              ))}
            </div>
          </div>
        )}

        {/* Top Items */}
        {showTopItems && summary.topItems.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold mb-2">Top Items</h4>
            <div className="space-y-1">
              {summary.topItems.slice(0, maxTopItems).map((item) => (
                <TopItem
                  key={item.itemId}
                  name={item.itemName}
                  amount={item.totalAmount}
                  percentage={item.percentage}
                />
              ))}
            </div>
          </div>
        )}

        {/* By Branch */}
        {showByBranch && summary.byBranch.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">By Branch</h4>
            <div className="space-y-1">
              {summary.byBranch.slice(0, maxTopItems).map((branch) => (
                <TopItem
                  key={branch.branchId}
                  name={branch.branchName}
                  amount={branch.totalAmount}
                  percentage={branch.percentage}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SpendingMetricsCard;
