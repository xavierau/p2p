import { cn } from '@/lib/utils';

/**
 * Available size variants for the loading spinner
 */
export type LoadingSpinnerSize = 'sm' | 'md' | 'lg';

/**
 * Props for the LoadingSpinner component
 */
export interface LoadingSpinnerProps {
  /** Size of the spinner: 'sm' (16px), 'md' (24px), or 'lg' (32px) */
  size?: LoadingSpinnerSize;
  /** Additional CSS classes to apply */
  className?: string;
}

/**
 * Size mappings to Tailwind CSS dimension classes
 */
const SIZE_CLASSES: Record<LoadingSpinnerSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

/**
 * A simple loading indicator component with CSS animation.
 *
 * Displays a spinning circle to indicate loading state.
 * Centered by default within its container.
 *
 * @example
 * ```tsx
 * // Default medium size
 * <LoadingSpinner />
 *
 * // Small spinner with custom color
 * <LoadingSpinner size="sm" className="text-primary" />
 *
 * // Large spinner
 * <LoadingSpinner size="lg" />
 * ```
 */
export function LoadingSpinner({
  size = 'md',
  className,
}: LoadingSpinnerProps) {
  return (
    <div className="flex items-center justify-center" role="status">
      <svg
        className={cn(
          'animate-spin text-muted-foreground',
          SIZE_CLASSES[size],
          className
        )}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span className="sr-only">Loading...</span>
    </div>
  );
}
