/**
 * AnalyticsDashboard Page
 *
 * Main analytics dashboard showing spending metrics, price variance,
 * and recommendations from the Analytics Foundation.
 */

import React, { useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  SpendingMetricsCard,
  PriceVarianceTable,
  RecommendationList,
} from '@/components/analytics';
import {
  useSpendingMetrics,
  usePriceVariance,
  useRecommendations,
} from '@/hooks';
import type { MetricPeriod } from '@/types/analytics';

// ============================================================================
// Constants
// ============================================================================

const PERIOD_OPTIONS: Array<{ value: MetricPeriod; label: string }> = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'YEARLY', label: 'Yearly' },
];

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

// ============================================================================
// Quick Stats Card
// ============================================================================

interface QuickStatProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  isLoading?: boolean;
}

const QuickStatCard: React.FC<QuickStatProps> = ({
  title,
  value,
  description,
  trend,
  trendValue,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-3 w-32 mt-1" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {(description || trendValue) && (
          <p className="text-xs text-muted-foreground mt-1">
            {trendValue && (
              <span
                className={`mr-1 ${
                  trend === 'up'
                    ? 'text-green-600'
                    : trend === 'down'
                    ? 'text-red-600'
                    : ''
                }`}
              >
                {trend === 'up' ? '+' : trend === 'down' ? '-' : ''}
                {trendValue}
              </span>
            )}
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

// ============================================================================
// Main Component
// ============================================================================

const AnalyticsDashboard: React.FC = () => {
  // Period filter state
  const [period, setPeriod] = useState<MetricPeriod>('MONTHLY');
  const [expandedVarianceRow, setExpandedVarianceRow] = useState<number | null>(null);

  // Data hooks
  const {
    summary: spendingSummary,
    isLoading: isLoadingSpending,
    error: spendingError,
    refresh: refreshSpending,
    setFilters: setSpendingFilters,
  } = useSpendingMetrics({
    autoFetch: true,
    initialFilters: { period },
  });

  const {
    variances,
    summary: varianceSummary,
    isLoading: isLoadingVariance,
    error: varianceError,
    refresh: refreshVariance,
  } = usePriceVariance({
    autoFetch: true,
    minVarianceThreshold: 5,
  });

  const {
    recommendations,
    summary: recommendationsSummary,
    isLoading: isLoadingRecommendations,
    isActioning,
    error: recommendationsError,
    markAsViewed,
    dismiss,
    apply,
    refresh: refreshRecommendations,
    setFilters: setRecommendationFilters,
  } = useRecommendations({
    autoFetch: true,
    initialFilters: { status: 'PENDING' },
  });

  // Handle period change
  const handlePeriodChange = useCallback(
    (newPeriod: MetricPeriod) => {
      setPeriod(newPeriod);
      setSpendingFilters({ period: newPeriod });
    },
    [setSpendingFilters]
  );

  // Refresh all data
  const handleRefreshAll = useCallback(() => {
    refreshSpending();
    refreshVariance();
    refreshRecommendations();
  }, [refreshSpending, refreshVariance, refreshRecommendations]);

  // Handle recommendation filter changes
  const handleRecommendationFilterChange = useCallback(
    (filters: { type?: string; priority?: string; status?: string }) => {
      setRecommendationFilters(filters as any);
    },
    [setRecommendationFilters]
  );

  // Calculate overall loading state
  const isInitialLoading =
    isLoadingSpending && isLoadingVariance && isLoadingRecommendations;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Insights and recommendations for cost optimization
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={(v) => handlePeriodChange(v as MetricPeriod)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleRefreshAll} disabled={isInitialLoading}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <QuickStatCard
          title="Total Spending"
          value={spendingSummary ? formatCurrency(spendingSummary.totalSpending) : '-'}
          description={`${spendingSummary?.totalTransactions.toLocaleString() ?? 0} transactions`}
          isLoading={isLoadingSpending}
        />
        <QuickStatCard
          title="High Variance Items"
          value={varianceSummary?.itemsWithHighVariance ?? 0}
          description={`of ${varianceSummary?.totalItemsAnalyzed ?? 0} items analyzed`}
          isLoading={isLoadingVariance}
        />
        <QuickStatCard
          title="Potential Savings"
          value={
            varianceSummary
              ? formatCurrency(varianceSummary.potentialSavings)
              : '-'
          }
          description="from price variance"
          isLoading={isLoadingVariance}
        />
        <QuickStatCard
          title="Pending Recommendations"
          value={recommendationsSummary?.pending ?? 0}
          description={
            recommendationsSummary?.totalEstimatedSavings
              ? `${formatCurrency(recommendationsSummary.totalEstimatedSavings)} est. savings`
              : undefined
          }
          isLoading={isLoadingRecommendations}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Spending Metrics */}
        <SpendingMetricsCard
          summary={spendingSummary}
          isLoading={isLoadingSpending}
          title="Spending Overview"
          description={`${period.toLowerCase()} spending breakdown`}
          showTopVendors={true}
          showTopItems={true}
          showByBranch={true}
          maxTopItems={5}
        />

        {/* Price Variance */}
        <PriceVarianceTable
          variances={variances.slice(0, 10)} // Show top 10 variance items
          isLoading={isLoadingVariance}
          title="Price Variance Alert"
          description="Items with significant price differences across locations"
          showBranchDetails={true}
          expandedRowId={expandedVarianceRow}
          onRowExpand={setExpandedVarianceRow}
          highlightThreshold={10}
        />
      </div>

      {/* Recommendations Section */}
      <RecommendationList
        recommendations={recommendations}
        summary={recommendationsSummary}
        isLoading={isLoadingRecommendations}
        isActioning={isActioning}
        error={recommendationsError}
        title="AI Recommendations"
        description="Smart suggestions for cost optimization"
        showSummary={true}
        showFilters={true}
        onView={markAsViewed}
        onDismiss={dismiss}
        onApply={apply}
        onFilterChange={handleRecommendationFilterChange}
        onRefresh={refreshRecommendations}
      />

      {/* Error Messages */}
      {(spendingError || varianceError) && (
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="pt-6">
            <div className="text-sm text-red-600 dark:text-red-400">
              {spendingError && <p>Spending data error: {spendingError}</p>}
              {varianceError && <p>Price variance error: {varianceError}</p>}
            </div>
            <Button variant="outline" size="sm" className="mt-2" onClick={handleRefreshAll}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AnalyticsDashboard;
