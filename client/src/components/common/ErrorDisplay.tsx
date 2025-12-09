import { Button } from '@/components/ui/button';

/**
 * Props for the ErrorDisplay component
 */
export interface ErrorDisplayProps {
  /** Error message to display */
  message: string;
  /** Optional callback when retry button is clicked */
  onRetry?: () => void;
  /** Optional custom class name */
  className?: string;
}

/**
 * A reusable error display component with optional retry functionality.
 *
 * Displays an error message in a centered container with a retry button.
 * Designed to be used as a full-page error state or within a container.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <ErrorDisplay message="Failed to load data" onRetry={fetchData} />
 *
 * // Without retry
 * <ErrorDisplay message="Something went wrong" />
 * ```
 */
export function ErrorDisplay({ message, onRetry, className }: ErrorDisplayProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center h-64 space-y-4 ${className ?? ''}`}
      role="alert"
    >
      <p className="text-destructive text-center">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline">
          Try Again
        </Button>
      )}
    </div>
  );
}
