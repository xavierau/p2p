import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Extend AxiosRequestConfig to include _retry flag
interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  withCredentials: true, // Required for sending/receiving httpOnly cookies
});

// =============================================================================
// CSRF Token Management
// =============================================================================

const CSRF_HEADER_NAME = 'X-CSRF-Token';
const CSRF_COOKIE_NAME = 'csrf-token';

/**
 * Extract CSRF token from cookie.
 * Used as a fallback if the token isn't set in headers.
 */
const getCsrfFromCookie = (): string | null => {
  const match = document.cookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
};

/**
 * Fetch and store CSRF token from the server.
 * Call this on app initialization to ensure CSRF protection is ready.
 */
export const initializeCsrf = async (): Promise<void> => {
  try {
    const response = await api.get('/auth/csrf');
    const { csrfToken } = response.data;
    if (csrfToken) {
      api.defaults.headers.common[CSRF_HEADER_NAME] = csrfToken;
    }
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
    // Try to use cookie as fallback
    const cookieToken = getCsrfFromCookie();
    if (cookieToken) {
      api.defaults.headers.common[CSRF_HEADER_NAME] = cookieToken;
    }
  }
};

// =============================================================================
// Token Refresh Management
// =============================================================================

// Flag to track if we're currently refreshing to prevent multiple refresh attempts
let isRefreshing = false;
// Queue of requests waiting for token refresh
let refreshSubscribers: Array<(token: string) => void> = [];

/**
 * Subscribe to token refresh completion.
 */
const subscribeTokenRefresh = (callback: (token: string) => void): void => {
  refreshSubscribers.push(callback);
};

/**
 * Notify all subscribers that token has been refreshed.
 */
const onTokenRefreshed = (token: string): void => {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
};

/**
 * Clear all refresh subscribers on failure.
 */
const clearRefreshSubscribers = (): void => {
  refreshSubscribers = [];
};

// Request interceptor: attach auth token and CSRF token
api.interceptors.request.use((config) => {
  // Attach JWT auth token
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Attach CSRF token for state-changing requests
  const method = config.method?.toLowerCase() || '';
  if (!['get', 'head', 'options'].includes(method)) {
    // Try to get CSRF token from headers first, then fall back to cookie
    const csrfToken = config.headers[CSRF_HEADER_NAME] ||
      api.defaults.headers.common[CSRF_HEADER_NAME] ||
      getCsrfFromCookie();

    if (csrfToken) {
      config.headers[CSRF_HEADER_NAME] = csrfToken;
    }
  }

  return config;
});

// Response interceptor: handle 401 with automatic token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomAxiosRequestConfig;

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // Skip refresh for auth endpoints (except logout)
      const isAuthEndpoint =
        originalRequest.url?.includes('/auth/login') ||
        originalRequest.url?.includes('/auth/register') ||
        originalRequest.url?.includes('/auth/refresh');

      if (isAuthEndpoint) {
        return Promise.reject(error);
      }

      // Mark this request as retried
      originalRequest._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;

        try {
          // Try to refresh the token
          // The refresh token is sent automatically via httpOnly cookie
          const response = await axios.post(
            `${api.defaults.baseURL}/auth/refresh`,
            {},
            { withCredentials: true }
          );

          const { accessToken } = response.data;

          // Store new access token
          localStorage.setItem('token', accessToken);

          // Update default auth header
          api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

          // Notify all waiting requests
          onTokenRefreshed(accessToken);

          isRefreshing = false;

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed, clear auth state and redirect
          isRefreshing = false;
          clearRefreshSubscribers();

          localStorage.removeItem('token');
          localStorage.removeItem('user');
          delete api.defaults.headers.common['Authorization'];

          // Only redirect if not already on login page
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }

          return Promise.reject(refreshError);
        }
      } else {
        // Token refresh in progress, queue this request
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }
    }

    // Handle network errors
    if (!error.response) {
      console.error('Network error:', error.message);
    }

    return Promise.reject(error);
  }
);

export default api;
