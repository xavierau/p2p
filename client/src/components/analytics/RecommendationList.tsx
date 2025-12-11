/**
 * RecommendationList Component
 *
 * Displays a list of recommendations with filtering and actions.
 * Supports view, dismiss, and apply actions on recommendations.
 */

import React, { useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RecommendationCard, RecommendationCardSkeleton } from './RecommendationCard';
import type {
  Recommendation,
  RecommendationType,
  RecommendationStatus,
} from '@/types/analytics';
import type { PaginationInfo } from '@/hooks/useRecommendations';

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
// Filter Options
// ============================================================================

/**
 * Type options matching backend RecommendationType enum
 */
const TYPE_OPTIONS: Array<{ value: RecommendationType | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All Types' },
  { value: 'COST_OPTIMIZATION', label: 'Cost Optimization' },
  { value: 'VENDOR_SWITCH', label: 'Vendor Switch' },
  { value: 'CONSOLIDATION', label: 'Consolidation' },
  { value: 'WASTE_PREVENTION', label: 'Waste Prevention' },
  { value: 'RISK_ALERT', label: 'Risk Alert' },
  { value: 'SEASONAL_OPPORTUNITY', label: 'Seasonal Opportunity' },
  { value: 'INVENTORY_REORDER', label: 'Inventory Reorder' },
  { value: 'PRICE_NEGOTIATION', label: 'Price Negotiation' },
];

/**
 * Priority options - backend uses numbers (1=critical to 5=very low)
 */
const PRIORITY_OPTIONS: Array<{ value: number | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All Priorities' },
  { value: 1, label: 'Critical' },
  { value: 2, label: 'High' },
  { value: 3, label: 'Medium' },
  { value: 4, label: 'Low' },
  { value: 5, label: 'Very Low' },
];

const STATUS_OPTIONS: Array<{ value: RecommendationStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'VIEWED', label: 'Viewed' },
  { value: 'APPLIED', label: 'Applied' },
  { value: 'DISMISSED', label: 'Dismissed' },
  { value: 'EXPIRED', label: 'Expired' },
];

// ============================================================================
// Summary Stats Component
// ============================================================================

interface SummaryStatsProps {
  recommendations: Recommendation[];
  pagination: PaginationInfo | null;
  isLoading?: boolean;
}

/**
 * Compute summary stats from recommendations list
 * NOTE: Backend doesn't provide summary, so we compute locally
 */
const SummaryStats: React.FC<SummaryStatsProps> = ({ recommendations, pagination, isLoading }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col gap-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 w-12" />
          </div>
        ))}
      </div>
    );
  }

  // Compute stats from the current page of recommendations
  const pending = recommendations.filter((r) => r.status === 'PENDING').length;
  const applied = recommendations.filter((r) => r.status === 'APPLIED').length;
  const totalSavings = recommendations
    .filter((r) => r.estimatedSavings != null)
    .reduce((sum, r) => sum + (r.estimatedSavings ?? 0), 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">Total (all pages)</span>
        <span className="text-lg font-bold">{pagination?.total ?? recommendations.length}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">Pending (this page)</span>
        <span className="text-lg font-bold text-yellow-600">{pending}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">Applied (this page)</span>
        <span className="text-lg font-bold text-green-600">{applied}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">Est. Savings (this page)</span>
        <span className="text-lg font-bold text-green-600">
          {formatCurrency(totalSavings)}
        </span>
      </div>
    </div>
  );
};

// ============================================================================
// Empty State
// ============================================================================

interface EmptyStateProps {
  hasFilters?: boolean;
  onClearFilters?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ hasFilters, onClearFilters }) => (
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
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
      />
    </svg>
    <p className="text-muted-foreground mb-4">
      {hasFilters
        ? 'No recommendations match your filters'
        : 'No recommendations available'}
    </p>
    {hasFilters && onClearFilters && (
      <Button variant="outline" onClick={onClearFilters}>
        Clear Filters
      </Button>
    )}
  </div>
);

// ============================================================================
// Loading State
// ============================================================================

const LoadingState: React.FC = () => (
  <div className="space-y-4">
    {[1, 2, 3].map((i) => (
      <RecommendationCardSkeleton key={i} />
    ))}
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

export interface RecommendationListProps {
  /** Recommendations data */
  recommendations: Recommendation[];
  /** Pagination info */
  pagination?: PaginationInfo | null;
  /** Loading state */
  isLoading?: boolean;
  /** Action in progress */
  isActioning?: boolean;
  /** Error message */
  error?: string | null;
  /** Title override */
  title?: string;
  /** Description override */
  description?: string;
  /** Show summary stats */
  showSummary?: boolean;
  /** Show filters */
  showFilters?: boolean;
  /** Callback when view is clicked */
  onView?: (id: number) => Promise<void>;
  /** Callback when dismiss is clicked */
  onDismiss?: (id: number, reason?: string) => Promise<void>;
  /** Callback when apply is clicked */
  onApply?: (id: number, notes?: string) => Promise<void>;
  /** Callback when filters change */
  onFilterChange?: (filters: {
    type?: RecommendationType;
    priority?: number;
    status?: RecommendationStatus;
  }) => void;
  /** Callback to refresh data */
  onRefresh?: () => void;
  /** Additional className */
  className?: string;
}

export const RecommendationList: React.FC<RecommendationListProps> = ({
  recommendations,
  pagination,
  isLoading = false,
  isActioning = false,
  error,
  title = 'Recommendations',
  description = 'AI-powered optimization suggestions',
  showSummary = true,
  showFilters = true,
  onView,
  onDismiss,
  onApply,
  onFilterChange,
  onRefresh,
  className = '',
}) => {
  const [typeFilter, setTypeFilter] = useState<RecommendationType | 'ALL'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<number | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<RecommendationStatus | 'ALL'>('ALL');

  const hasFilters = typeFilter !== 'ALL' || priorityFilter !== 'ALL' || statusFilter !== 'ALL';

  const handleTypeChange = (value: string) => {
    const newType = value as RecommendationType | 'ALL';
    setTypeFilter(newType);
    if (onFilterChange) {
      onFilterChange({
        type: newType === 'ALL' ? undefined : newType,
        priority: priorityFilter === 'ALL' ? undefined : priorityFilter,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      });
    }
  };

  const handlePriorityChange = (value: string) => {
    const newPriority = value === 'ALL' ? 'ALL' : parseInt(value, 10);
    setPriorityFilter(newPriority);
    if (onFilterChange) {
      onFilterChange({
        type: typeFilter === 'ALL' ? undefined : typeFilter,
        priority: newPriority === 'ALL' ? undefined : newPriority,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      });
    }
  };

  const handleStatusChange = (value: string) => {
    const newStatus = value as RecommendationStatus | 'ALL';
    setStatusFilter(newStatus);
    if (onFilterChange) {
      onFilterChange({
        type: typeFilter === 'ALL' ? undefined : typeFilter,
        priority: priorityFilter === 'ALL' ? undefined : priorityFilter,
        status: newStatus === 'ALL' ? undefined : newStatus,
      });
    }
  };

  const handleClearFilters = () => {
    setTypeFilter('ALL');
    setPriorityFilter('ALL');
    setStatusFilter('ALL');
    if (onFilterChange) {
      onFilterChange({});
    }
  };

  // Filter recommendations locally (if not using server-side filtering)
  const filteredRecommendations = recommendations.filter((rec) => {
    if (typeFilter !== 'ALL' && rec.type !== typeFilter) return false;
    if (priorityFilter !== 'ALL' && rec.priority !== priorityFilter) return false;
    if (statusFilter !== 'ALL' && rec.status !== statusFilter) return false;
    return true;
  });

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {title}
              {pagination && pagination.total > 0 && (
                <Badge variant="warning">{pagination.total} total</Badge>
              )}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
              Refresh
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {/* Summary Stats */}
        {showSummary && (
          <SummaryStats
            recommendations={recommendations}
            pagination={pagination ?? null}
            isLoading={isLoading}
          />
        )}

        {/* Filters */}
        {showFilters && (
          <div className="flex flex-wrap gap-3 mb-6">
            <Select value={typeFilter} onValueChange={handleTypeChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={String(priorityFilter)} onValueChange={handlePriorityChange}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((option) => (
                  <SelectItem key={String(option.value)} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={onRefresh}
              >
                Try Again
              </Button>
            )}
          </div>
        )}

        {/* Loading State */}
        {isLoading && <LoadingState />}

        {/* Empty State */}
        {!isLoading && filteredRecommendations.length === 0 && (
          <EmptyState
            hasFilters={hasFilters}
            onClearFilters={hasFilters ? handleClearFilters : undefined}
          />
        )}

        {/* Recommendations List */}
        {!isLoading && filteredRecommendations.length > 0 && (
          <div className="space-y-4">
            {filteredRecommendations.map((recommendation) => (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                isActioning={isActioning}
                onView={onView}
                onDismiss={onDismiss}
                onApply={onApply}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecommendationList;
