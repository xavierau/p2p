import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import LoginPage from '@/pages/LoginPage';
import { AuthProvider } from '@/context/AuthContext';
import { authService } from '@/services/authService';

// Mock the authService module
vi.mock('@/services/authService', () => ({
  authService: {
    login: vi.fn(),
  },
}));

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

/**
 * Test wrapper that provides required context and routing.
 */
function renderLoginPage() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </BrowserRouter>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Form Rendering', () => {
    it('renders the login form correctly', () => {
      renderLoginPage();

      // CardTitle renders as a div, not a heading element
      // Check for title text by using a more specific query
      expect(screen.getByText(/enter your credentials/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
    });

    it('renders register and forgot password links', () => {
      renderLoginPage();

      expect(screen.getByRole('link', { name: /register/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /forgot password/i })).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('requires email field to be filled', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /login/i });

      // Fill only password
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      // HTML5 validation should prevent submission
      expect(emailInput).toBeInvalid();
    });

    it('requires password field to be filled', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /login/i });

      // Fill only email
      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      // HTML5 validation should prevent submission
      expect(passwordInput).toBeInvalid();
    });

    it('validates email format', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);

      await user.type(emailInput, 'invalid-email');

      // HTML5 email validation
      expect(emailInput).toBeInvalid();
    });
  });

  describe('Successful Login', () => {
    it('calls authService.login with correct credentials', async () => {
      const user = userEvent.setup();
      const mockLoginResponse = {
        accessToken: 'test-token-123',
        expiresIn: 900,
        user: {
          id: 1,
          email: 'test@example.com',
          name: 'Test User',
          role: 'USER',
        },
      };
      vi.mocked(authService.login).mockResolvedValue(mockLoginResponse);

      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /login/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(authService.login).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
      });
    });

    it('navigates to dashboard on successful login', async () => {
      const user = userEvent.setup();
      const mockLoginResponse = {
        accessToken: 'test-token-123',
        expiresIn: 900,
        user: {
          id: 1,
          email: 'test@example.com',
          name: 'Test User',
          role: 'USER',
        },
      };
      vi.mocked(authService.login).mockResolvedValue(mockLoginResponse);

      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /login/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('shows loading state while logging in', async () => {
      const user = userEvent.setup();
      // Make login hang to test loading state
      vi.mocked(authService.login).mockImplementation(
        () => new Promise(() => {})
      );

      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /login/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      // Button should show loading text
      expect(screen.getByRole('button', { name: /logging in/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /logging in/i })).toBeDisabled();
    });
  });

  describe('Failed Login', () => {
    it('displays error message on login failure', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.login).mockRejectedValue(new Error('Invalid credentials'));

      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /login/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
      });
    });

    it('does not navigate on login failure', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.login).mockRejectedValue(new Error('Invalid credentials'));

      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /login/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
      });

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('re-enables submit button after login failure', async () => {
      const user = userEvent.setup();
      vi.mocked(authService.login).mockRejectedValue(new Error('Invalid credentials'));

      renderLoginPage();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /login/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /login/i })).not.toBeDisabled();
      });
    });
  });
});
