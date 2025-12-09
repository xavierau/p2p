import '@testing-library/jest-dom';
import { vi, beforeAll, afterEach } from 'vitest';

/**
 * Mock window.matchMedia for components that use responsive queries.
 * This is required for components using CSS media queries in tests.
 */
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock ResizeObserver for components using it (like recharts)
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
});

/**
 * Reset mocks and clear localStorage after each test for isolation.
 */
afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

/**
 * Mock the api module to prevent real network requests during tests.
 * Individual tests should provide their own mock implementations.
 */
vi.mock('@/lib/api', () => {
  return {
    default: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
      defaults: {
        headers: {
          common: {},
        },
      },
    },
  };
});
