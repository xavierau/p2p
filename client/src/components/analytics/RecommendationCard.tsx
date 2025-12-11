/**
 * RecommendationCard Component
 *
 * Displays a single recommendation with actions to view, dismiss, or apply.
 * Shows priority, type, estimated savings, and confidence level.
 */

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type {
  Recommendation,
  RecommendationType,
  RecommendationStatus,
} from '@/types/analytics';
import { getPriorityLabel } from '@/types/analytics';

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
 * Get priority badge variant
 * Priority: 1=critical, 2=high, 3=medium, 4=low, 5=very low
 */
const getPriorityBadgeVariant = (
  priority: number
): 'success' | 'warning' | 'error' | 'gray' | 'info' => {
  switch (priority) {
    case 1:
      return 'error';     // Critical
    case 2:
      return 'warning';   // High
    case 3:
      return 'info';      // Medium
    case 4:
    case 5:
    default:
      return 'gray';      // Low/Very Low
  }
};

/**
 * Get status badge variant
 */
const getStatusBadgeVariant = (
  status: RecommendationStatus
): 'success' | 'warning' | 'error' | 'gray' | 'info' => {
  switch (status) {
    case 'APPLIED':
      return 'success';
    case 'VIEWED':
      return 'info';
    case 'PENDING':
      return 'warning';
    case 'DISMISSED':
      return 'gray';
    case 'EXPIRED':
      return 'error';
    default:
      return 'gray';
  }
};

/**
 * Get type icon and label
 * NOTE: Must match backend RecommendationType enum
 */
const getTypeInfo = (
  type: RecommendationType
): { icon: string; label: string } => {
  switch (type) {
    case 'COST_OPTIMIZATION':
      return { icon: '$', label: 'Cost Optimization' };
    case 'VENDOR_SWITCH':
      return { icon: 'V', label: 'Vendor Switch' };
    case 'CONSOLIDATION':
      return { icon: '#', label: 'Consolidation' };
    case 'WASTE_PREVENTION':
      return { icon: 'W', label: 'Waste Prevention' };
    case 'RISK_ALERT':
      return { icon: '!', label: 'Risk Alert' };
    case 'SEASONAL_OPPORTUNITY':
      return { icon: 'S', label: 'Seasonal Opportunity' };
    case 'INVENTORY_REORDER':
      return { icon: 'R', label: 'Inventory Reorder' };
    case 'PRICE_NEGOTIATION':
      return { icon: 'N', label: 'Price Negotiation' };
    default:
      return { icon: '?', label: type };
  }
};

/**
 * Format confidence as percentage
 */
const formatConfidence = (confidence: number): string => {
  return `${(confidence * 100).toFixed(0)}%`;
};

/**
 * Format date
 */
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// ============================================================================
// Loading Skeleton
// ============================================================================

export const RecommendationCardSkeleton: React.FC = () => (
  <Card>
    <CardHeader>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Skeleton className="h-5 w-48 mb-2" />
          <Skeleton className="h-4 w-full" />
        </div>
        <Skeleton className="h-6 w-16" />
      </div>
    </CardHeader>
    <CardContent>
      <div className="flex gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-28" />
      </div>
    </CardContent>
    <CardFooter>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-20" />
      </div>
    </CardFooter>
  </Card>
);

// ============================================================================
// Main Component
// ============================================================================

export interface RecommendationCardProps {
  /** Recommendation data */
  recommendation: Recommendation;
  /** Loading state */
  isLoading?: boolean;
  /** Action in progress */
  isActioning?: boolean;
  /** Callback when view is clicked */
  onView?: (id: number) => Promise<void>;
  /** Callback when dismiss is clicked */
  onDismiss?: (id: number, reason?: string) => Promise<void>;
  /** Callback when apply is clicked */
  onApply?: (id: number, notes?: string) => Promise<void>;
  /** Show full details */
  expanded?: boolean;
  /** Additional className */
  className?: string;
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
  isLoading = false,
  isActioning = false,
  onView,
  onDismiss,
  onApply,
  expanded = false,
  className = '',
}) => {
  const [showDismissDialog, setShowDismissDialog] = useState(false);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [dismissReason, setDismissReason] = useState('');
  const [applyNotes, setApplyNotes] = useState('');

  if (isLoading) {
    return <RecommendationCardSkeleton />;
  }

  const typeInfo = getTypeInfo(recommendation.type);
  const isPending = recommendation.status === 'PENDING';
  const isViewed = recommendation.status === 'VIEWED';
  const canAct = isPending || isViewed;

  const handleView = async () => {
    if (onView && (isPending || !recommendation.viewedAt)) {
      await onView(recommendation.id);
    }
  };

  const handleDismissConfirm = async () => {
    if (onDismiss) {
      await onDismiss(recommendation.id, dismissReason || undefined);
      setShowDismissDialog(false);
      setDismissReason('');
    }
  };

  const handleApplyConfirm = async () => {
    if (onApply) {
      await onApply(recommendation.id, applyNotes || undefined);
      setShowApplyDialog(false);
      setApplyNotes('');
    }
  };

  return (
    <>
      <Card
        className={`${className} ${
          recommendation.priority === 1 ? 'border-red-300 dark:border-red-800' : ''
        } ${
          recommendation.priority === 2 ? 'border-yellow-300 dark:border-yellow-800' : ''
        }`}
        onClick={handleView}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex items-center justify-center w-6 h-6 rounded bg-primary/10 text-primary text-xs font-bold">
                  {typeInfo.icon}
                </div>
                <span className="text-xs text-muted-foreground">{typeInfo.label}</span>
              </div>
              <CardTitle className="text-base line-clamp-2">
                {recommendation.title}
              </CardTitle>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant={getPriorityBadgeVariant(recommendation.priority)}>
                {getPriorityLabel(recommendation.priority)}
              </Badge>
              <Badge variant={getStatusBadgeVariant(recommendation.status)}>
                {recommendation.status}
              </Badge>
            </div>
          </div>
          <CardDescription className="line-clamp-2 mt-1">
            {recommendation.description}
          </CardDescription>
        </CardHeader>

        <CardContent className="pb-2">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {recommendation.estimatedSavings && recommendation.estimatedSavings > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Savings:</span>
                <span className="font-medium text-green-600">
                  {formatCurrency(recommendation.estimatedSavings)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Confidence:</span>
              <span className="font-medium">
                {formatConfidence(recommendation.confidenceScore)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Created:</span>
              <span>{formatDate(recommendation.createdAt)}</span>
            </div>
          </div>

          {/* Expanded Details - show reasoning */}
          {expanded && recommendation.reasoning && (
            <div className="mt-3 p-3 bg-muted/50 rounded-md">
              <p className="text-sm font-medium mb-1">Reasoning</p>
              <p className="text-sm text-muted-foreground">{recommendation.reasoning}</p>
            </div>
          )}
        </CardContent>

        {canAct && (onDismiss || onApply) && (
          <CardFooter className="pt-2">
            <div className="flex gap-2">
              {onDismiss && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isActioning}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDismissDialog(true);
                  }}
                >
                  Dismiss
                </Button>
              )}
              {onApply && (
                <Button
                  size="sm"
                  disabled={isActioning}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowApplyDialog(true);
                  }}
                >
                  Apply
                </Button>
              )}
            </div>
          </CardFooter>
        )}

        {/* Applied/Dismissed Info */}
        {recommendation.status === 'APPLIED' && recommendation.appliedAt && (
          <CardFooter className="pt-2 text-xs text-muted-foreground">
            Applied on {formatDate(recommendation.appliedAt)}
          </CardFooter>
        )}
        {recommendation.status === 'DISMISSED' && recommendation.dismissedAt && (
          <CardFooter className="pt-2 text-xs text-muted-foreground">
            Dismissed on {formatDate(recommendation.dismissedAt)}
            {recommendation.dismissReason && `: ${recommendation.dismissReason}`}
          </CardFooter>
        )}
      </Card>

      {/* Dismiss Dialog */}
      <Dialog open={showDismissDialog} onOpenChange={setShowDismissDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dismiss Recommendation</DialogTitle>
            <DialogDescription>
              Are you sure you want to dismiss this recommendation? You can optionally provide a reason.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="dismiss-reason">Reason (optional)</Label>
            <Textarea
              id="dismiss-reason"
              placeholder="Enter a reason for dismissing..."
              value={dismissReason}
              onChange={(e) => setDismissReason(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDismissDialog(false)}
              disabled={isActioning}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDismissConfirm}
              disabled={isActioning}
            >
              {isActioning ? 'Dismissing...' : 'Dismiss'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Dialog */}
      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Recommendation</DialogTitle>
            <DialogDescription>
              Confirm that you want to apply this recommendation. You can optionally add notes.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="mb-4 p-3 bg-muted rounded-md">
              <p className="font-medium">{recommendation.title}</p>
              {recommendation.estimatedSavings && recommendation.estimatedSavings > 0 && (
                <p className="text-sm text-green-600 mt-1">
                  Estimated savings: {formatCurrency(recommendation.estimatedSavings)}
                </p>
              )}
            </div>
            <Label htmlFor="apply-notes">Notes (optional)</Label>
            <Textarea
              id="apply-notes"
              placeholder="Enter any notes about applying this recommendation..."
              value={applyNotes}
              onChange={(e) => setApplyNotes(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApplyDialog(false)}
              disabled={isActioning}
            >
              Cancel
            </Button>
            <Button onClick={handleApplyConfirm} disabled={isActioning}>
              {isActioning ? 'Applying...' : 'Apply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RecommendationCard;
