import { Button } from '@/components/ui/button';
import type { PaginationMeta } from '@/types';

/**
 * Props for the Pagination component
 */
export interface PaginationProps {
  /** Pagination metadata from API response */
  pagination: PaginationMeta;
  /** Callback invoked when user navigates to a different page */
  onPageChange: (page: number) => void;
}

/**
 * A reusable pagination component for list pages.
 *
 * Displays current page information and navigation controls for
 * paginated data sets. Shows "Page X of Y (Z total)" text with
 * Previous and Next buttons that are disabled when not available.
 *
 * @example
 * ```tsx
 * <Pagination
 *   pagination={{ page: 1, totalPages: 5, total: 50, limit: 10, hasNext: true, hasPrevious: false }}
 *   onPageChange={(page) => setCurrentPage(page)}
 * />
 * ```
 */
export function Pagination({ pagination, onPageChange }: PaginationProps) {
  const { page, totalPages, total, hasPrevious, hasNext } = pagination;

  const handlePrevious = () => {
    if (hasPrevious) {
      onPageChange(page - 1);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      onPageChange(page + 1);
    }
  };

  return (
    <div className="flex items-center justify-between px-2 py-4">
      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages} ({total} total)
      </span>
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevious}
          disabled={!hasPrevious}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          disabled={!hasNext}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
