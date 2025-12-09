import { cn } from '@/lib/utils';

/**
 * Supported status badge variants for different entity types
 */
export type StatusBadgeVariant = 'invoice' | 'purchaseOrder' | 'sync';

/**
 * Props for the StatusBadge component
 */
export interface StatusBadgeProps {
  /** The status value to display */
  status: string;
  /** The variant determines the color mapping for statuses */
  variant: StatusBadgeVariant;
}

/**
 * Color configurations for each status by variant.
 * Uses Tailwind CSS classes for consistent styling.
 */
const STATUS_COLORS: Record<StatusBadgeVariant, Record<string, string>> = {
  invoice: {
    PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    APPROVED: 'bg-green-100 text-green-800 border-green-200',
    REJECTED: 'bg-red-100 text-red-800 border-red-200',
  },
  purchaseOrder: {
    DRAFT: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    SENT: 'bg-blue-100 text-blue-800 border-blue-200',
    FULFILLED: 'bg-green-100 text-green-800 border-green-200',
  },
  sync: {
    PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    SYNCED: 'bg-green-100 text-green-800 border-green-200',
    FAILED: 'bg-red-100 text-red-800 border-red-200',
  },
};

/** Default styling for unknown statuses */
const DEFAULT_COLOR = 'bg-gray-100 text-gray-800 border-gray-200';

/**
 * A generic status badge component that displays color-coded status labels.
 *
 * Supports three variants:
 * - `invoice`: PENDING (yellow), APPROVED (green), REJECTED (red)
 * - `purchaseOrder`: DRAFT (yellow), SENT (blue), FULFILLED (green)
 * - `sync`: PENDING (yellow), SYNCED (green), FAILED (red)
 *
 * @example
 * ```tsx
 * <StatusBadge status="APPROVED" variant="invoice" />
 * <StatusBadge status="SENT" variant="purchaseOrder" />
 * <StatusBadge status="SYNCED" variant="sync" />
 * ```
 */
export function StatusBadge({ status, variant }: StatusBadgeProps) {
  const colorMap = STATUS_COLORS[variant];
  const colorClasses = colorMap[status] ?? DEFAULT_COLOR;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        colorClasses
      )}
    >
      {status}
    </span>
  );
}
