import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import api from '@/lib/api';
import { AuthProvider, useAuth } from '@/context/AuthContext';

// api is already mocked in setup.ts, we just need to access the mock

/**
 * Test component that exposes auth context values for testing.
 */
function TestConsumer() {
  const { user, token, isAuthenticated, isLoading, login, logout } = useAuth();

  return (
    <div>
      <div data-testid="is-authenticated">{isAuthenticated.toString()}</div>
      <div data-testid="is-loading">{isLoading.toString()}</div>
      <div data-testid="token">{token ?? 'null'}</div>
      <div data-testid="user-email">{user?.email ?? 'null'}</div>
      <div data-testid="user-name">{user?.name ?? 'null'}</div>
      <button
        onClick={() =>
          login('test-token', { id: 1, email: 'test@example.com', name: 'Test User' })
        }
      >
        Login
      </button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
}

/**
 * Renders the test consumer within AuthProvider.
 */
function renderWithAuthProvider() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Reset api headers
    api.defaults.headers.common = {};
    // Mock the logout API call to resolve successfully
    vi.mocked(api.post).mockResolvedValue({ data: {} });
  });

  describe('Initial State', () => {
    it('provides unauthenticated state when no stored credentials', () => {
      renderWithAuthProvider();

      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false');
      expect(screen.getByTestId('token')).toHaveTextContent('null');
      expect(screen.getByTestId('user-email')).toHaveTextContent('null');
    });

    it('restores authenticated state from localStorage', () => {
      // Setup stored credentials before rendering
      localStorage.setItem('token', 'stored-token');
      localStorage.setItem(
        'user',
        JSON.stringify({ id: 2, email: 'stored@example.com', name: 'Stored User' })
      );

      renderWithAuthProvider();

      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true');
      expect(screen.getByTestId('token')).toHaveTextContent('stored-token');
      expect(screen.getByTestId('user-email')).toHaveTextContent('stored@example.com');
      expect(screen.getByTestId('user-name')).toHaveTextContent('Stored User');
    });

    it('sets api Authorization header from stored token', () => {
      localStorage.setItem('token', 'stored-token');
      localStorage.setItem(
        'user',
        JSON.stringify({ id: 2, email: 'stored@example.com', name: 'Stored User' })
      );

      renderWithAuthProvider();

      expect(api.defaults.headers.common['Authorization']).toBe('Bearer stored-token');
    });

    it('clears invalid stored user data', () => {
      localStorage.setItem('token', 'stored-token');
      localStorage.setItem('user', 'invalid-json');

      renderWithAuthProvider();

      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false');
      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
    });
  });

  describe('Login', () => {
    it('updates state with user and token', async () => {
      const user = userEvent.setup();
      renderWithAuthProvider();

      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false');

      await user.click(screen.getByRole('button', { name: /login/i }));

      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true');
      expect(screen.getByTestId('token')).toHaveTextContent('test-token');
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
      expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
    });

    it('stores credentials in localStorage', async () => {
      const user = userEvent.setup();
      renderWithAuthProvider();

      await user.click(screen.getByRole('button', { name: /login/i }));

      expect(localStorage.getItem('token')).toBe('test-token');
      expect(JSON.parse(localStorage.getItem('user')!)).toEqual({
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
      });
    });

    it('sets api Authorization header', async () => {
      const user = userEvent.setup();
      renderWithAuthProvider();

      await user.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(api.defaults.headers.common['Authorization']).toBe('Bearer test-token');
      });
    });
  });

  describe('Logout', () => {
    it('clears user and token from state', async () => {
      const user = userEvent.setup();

      // Start with authenticated state
      localStorage.setItem('token', 'stored-token');
      localStorage.setItem(
        'user',
        JSON.stringify({ id: 1, email: 'test@example.com', name: 'Test User' })
      );

      renderWithAuthProvider();

      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true');

      await user.click(screen.getByRole('button', { name: /logout/i }));

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false');
        expect(screen.getByTestId('token')).toHaveTextContent('null');
        expect(screen.getByTestId('user-email')).toHaveTextContent('null');
      });
    });

    it('removes credentials from localStorage', async () => {
      const user = userEvent.setup();

      localStorage.setItem('token', 'stored-token');
      localStorage.setItem(
        'user',
        JSON.stringify({ id: 1, email: 'test@example.com', name: 'Test User' })
      );

      renderWithAuthProvider();

      await user.click(screen.getByRole('button', { name: /logout/i }));

      await waitFor(() => {
        expect(localStorage.getItem('token')).toBeNull();
        expect(localStorage.getItem('user')).toBeNull();
      });
    });

    it('removes api Authorization header', async () => {
      const user = userEvent.setup();

      localStorage.setItem('token', 'stored-token');
      localStorage.setItem(
        'user',
        JSON.stringify({ id: 1, email: 'test@example.com', name: 'Test User' })
      );

      renderWithAuthProvider();

      await user.click(screen.getByRole('button', { name: /logout/i }));

      await waitFor(() => {
        expect(api.defaults.headers.common['Authorization']).toBeUndefined();
      });
    });

    it('calls logout API endpoint', async () => {
      const user = userEvent.setup();

      localStorage.setItem('token', 'stored-token');
      localStorage.setItem(
        'user',
        JSON.stringify({ id: 1, email: 'test@example.com', name: 'Test User' })
      );

      renderWithAuthProvider();

      await user.click(screen.getByRole('button', { name: /logout/i }));

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/auth/logout');
      });
    });
  });

  describe('isAuthenticated', () => {
    it('returns true when both token and user are present', async () => {
      const user = userEvent.setup();
      renderWithAuthProvider();

      await user.click(screen.getByRole('button', { name: /login/i }));

      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true');
    });

    it('returns false when token is missing', () => {
      // Only set user, no token
      localStorage.setItem(
        'user',
        JSON.stringify({ id: 1, email: 'test@example.com', name: 'Test User' })
      );

      renderWithAuthProvider();

      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false');
    });

    it('returns false after logout', async () => {
      const user = userEvent.setup();

      localStorage.setItem('token', 'stored-token');
      localStorage.setItem(
        'user',
        JSON.stringify({ id: 1, email: 'test@example.com', name: 'Test User' })
      );

      renderWithAuthProvider();

      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true');

      await user.click(screen.getByRole('button', { name: /logout/i }));

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false');
      });
    });
  });

  describe('useAuth Hook', () => {
    it('throws error when used outside AuthProvider', () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = vi.fn();

      expect(() => {
        render(<TestConsumer />);
      }).toThrow('useAuth must be used within an AuthProvider');

      console.error = originalError;
    });
  });

  describe('Loading State', () => {
    it('provides isLoading as false when not loading', () => {
      renderWithAuthProvider();

      expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
    });
  });

  describe('User Data Handling', () => {
    it('handles user with null name', async () => {
      const user = userEvent.setup();

      // Custom login with null name
      function TestConsumerWithNullName() {
        const { user: authUser, login } = useAuth();
        return (
          <div>
            <div data-testid="user-name">{authUser?.name ?? 'null'}</div>
            <button
              onClick={() =>
                login('test-token', { id: 1, email: 'test@example.com', name: null })
              }
            >
              Login
            </button>
          </div>
        );
      }

      render(
        <AuthProvider>
          <TestConsumerWithNullName />
        </AuthProvider>
      );

      await user.click(screen.getByRole('button', { name: /login/i }));

      expect(screen.getByTestId('user-name')).toHaveTextContent('null');
    });
  });
});
