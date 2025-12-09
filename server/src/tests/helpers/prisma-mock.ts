import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended';
import { PrismaClient } from '@prisma/client';

/**
 * Creates a deeply mocked Prisma client for unit testing.
 * All Prisma methods are mocked and can be configured per test.
 *
 * Usage:
 * ```typescript
 * const prismaMock = createPrismaMock();
 * prismaMock.user.findUnique.mockResolvedValue({ id: 1, ... });
 * ```
 */
export type PrismaMock = DeepMockProxy<PrismaClient>;

export const createPrismaMock = (): PrismaMock => {
  const mock = mockDeep<PrismaClient>();

  // Configure $transaction to handle both array and callback patterns
  // Array pattern: $transaction([query1, query2]) - executes queries in parallel
  // Callback pattern: $transaction(async (tx) => {...}) - provides transaction client
  mock.$transaction.mockImplementation(async (arg: any) => {
    if (Array.isArray(arg)) {
      // Array pattern: resolve all promises in the array
      return Promise.all(arg);
    }
    // Callback pattern: call the function with the mock as the transaction client
    return arg(mock);
  });

  return mock;
};

/**
 * Resets all mocks on the Prisma mock instance.
 * Call this in beforeEach() to ensure test isolation.
 */
export const resetPrismaMock = (mock: PrismaMock): void => {
  mockReset(mock);
};

// Singleton instance for use across test files
let prismaMockInstance: PrismaMock | null = null;

/**
 * Gets the singleton Prisma mock instance.
 * Creates one if it doesn't exist.
 */
export const getPrismaMock = (): PrismaMock => {
  if (!prismaMockInstance) {
    prismaMockInstance = createPrismaMock();
  }
  return prismaMockInstance;
};

/**
 * Resets the singleton Prisma mock instance.
 * Re-configures $transaction mock after reset.
 */
export const resetSingletonPrismaMock = (): void => {
  if (prismaMockInstance) {
    resetPrismaMock(prismaMockInstance);
    // Re-configure $transaction after reset
    prismaMockInstance.$transaction.mockImplementation(async (arg: any) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return arg(prismaMockInstance);
    });
  }
};
