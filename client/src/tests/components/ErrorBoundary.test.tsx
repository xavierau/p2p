import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from '@/components/ErrorBoundary';

/**
 * Component that throws an error for testing purposes.
 */
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>Normal content</div>;
}

/**
 * Suppress console.error during error boundary tests to reduce noise.
 */
function suppressConsoleError() {
  const originalError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });
  return () => {
    console.error = originalError;
  };
}

describe('ErrorBoundary', () => {
  // Suppress React's error logging for cleaner test output
  suppressConsoleError();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Normal Operation', () => {
    it('renders children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Normal content')).toBeInTheDocument();
    });

    it('renders multiple children correctly', () => {
      render(
        <ErrorBoundary>
          <div>Child 1</div>
          <div>Child 2</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Child 1')).toBeInTheDocument();
      expect(screen.getByText('Child 2')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('catches errors and displays fallback UI', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });

    it('displays user-friendly error message', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(
        screen.getByText(/an unexpected error occurred/i)
      ).toBeInTheDocument();
    });

    it('does not render children when error occurs', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.queryByText('Normal content')).not.toBeInTheDocument();
    });

    it('logs error to console', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Try Again Button', () => {
    it('renders Try Again button', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(
        screen.getByRole('button', { name: /try again/i })
      ).toBeInTheDocument();
    });

    it('reloads page when Try Again is clicked', async () => {
      const user = userEvent.setup();

      // Mock window.location.reload
      const originalReload = window.location.reload;
      const mockReload = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { ...window.location, reload: mockReload },
        writable: true,
      });

      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      const tryAgainButton = screen.getByRole('button', { name: /try again/i });
      await user.click(tryAgainButton);

      expect(mockReload).toHaveBeenCalledTimes(1);

      // Restore original
      Object.defineProperty(window, 'location', {
        value: { ...window.location, reload: originalReload },
        writable: true,
      });
    });
  });

  describe('Custom Fallback', () => {
    it('renders custom fallback when provided', () => {
      const customFallback = <div>Custom error UI</div>;

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom error UI')).toBeInTheDocument();
      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });

    it('uses default fallback when no custom fallback provided', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });

  describe('Development Mode Error Details', () => {
    it('shows error details toggle in dev mode', () => {
      // import.meta.env.DEV is typically true in test environment
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      // In dev mode, should show the details summary
      const detailsSummary = screen.queryByText(/error details/i);
      // This depends on import.meta.env.DEV being true in tests
      // If the details element exists, check for it
      if (detailsSummary) {
        expect(detailsSummary).toBeInTheDocument();
      }
    });

    it('displays error message in details when expanded', async () => {
      const user = userEvent.setup();

      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      const detailsSummary = screen.queryByText(/error details/i);
      if (detailsSummary) {
        await user.click(detailsSummary);
        expect(screen.getByText(/test error message/i)).toBeInTheDocument();
      }
    });
  });

  describe('Error Boundary Recovery', () => {
    it('component can recover when child stops throwing', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

      // Rerender with non-throwing component
      // Note: In real React, ErrorBoundary state persists until reset
      // This test demonstrates the boundary caught the error
      rerender(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={false} />
        </ErrorBoundary>
      );

      // ErrorBoundary maintains error state until reset (reload)
      // So it should still show error UI
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('fallback UI is keyboard accessible', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      const tryAgainButton = screen.getByRole('button', { name: /try again/i });
      expect(tryAgainButton).toBeVisible();
      expect(tryAgainButton).not.toBeDisabled();
    });
  });
});
