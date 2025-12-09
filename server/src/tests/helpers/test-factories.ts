import { UserRole } from '@prisma/client';

/**
 * Test data factories for creating consistent test fixtures.
 * All factories return plain objects matching Prisma model shapes.
 */

// Counter for generating unique IDs
let idCounter = 1;

/**
 * Generates a unique auto-incrementing ID for test entities.
 */
export const generateId = (): number => idCounter++;

/**
 * Resets the ID counter. Call in beforeEach() if needed.
 */
export const resetIdCounter = (): void => {
  idCounter = 1;
};

// ============================================================================
// User Factory
// ============================================================================

export interface TestUser {
  id: number;
  email: string;
  password: string;
  name: string | null;
  role: UserRole;
  // Refresh token fields
  refreshToken: string | null;
  refreshTokenExpiresAt: Date | null;
  lastLoginAt: Date | null;
  loginAttempts: number;
  lockedUntil: Date | null;
}

export const createTestUser = (overrides: Partial<TestUser> = {}): TestUser => {
  const id = overrides.id ?? generateId();
  return {
    id,
    email: `user${id}@test.com`,
    password: '$2a$12$hashedpassword',
    name: `Test User ${id}`,
    role: UserRole.USER,
    // Default refresh token fields
    refreshToken: null,
    refreshTokenExpiresAt: null,
    lastLoginAt: null,
    loginAttempts: 0,
    lockedUntil: null,
    ...overrides,
  };
};

export const createTestAdmin = (overrides: Partial<TestUser> = {}): TestUser => {
  return createTestUser({ role: UserRole.ADMIN, ...overrides });
};

export const createTestManager = (overrides: Partial<TestUser> = {}): TestUser => {
  return createTestUser({ role: UserRole.MANAGER, ...overrides });
};

export const createTestViewer = (overrides: Partial<TestUser> = {}): TestUser => {
  return createTestUser({ role: UserRole.VIEWER, ...overrides });
};

// ============================================================================
// Vendor Factory
// ============================================================================

export interface TestVendor {
  id: number;
  name: string;
  contact: string | null;
  deletedAt: Date | null;
  items?: TestItem[];
}

export const createTestVendor = (overrides: Partial<TestVendor> = {}): TestVendor => {
  const id = overrides.id ?? generateId();
  return {
    id,
    name: `Vendor ${id}`,
    contact: `vendor${id}@example.com`,
    deletedAt: null,
    ...overrides,
  };
};

// ============================================================================
// Item Factory
// ============================================================================

export interface TestItem {
  id: number;
  name: string;
  item_code: string | null;
  price: number;
  vendorId: number;
  deletedAt: Date | null;
  vendor?: TestVendor;
}

export const createTestItem = (overrides: Partial<TestItem> = {}): TestItem => {
  const id = overrides.id ?? generateId();
  return {
    id,
    name: `Item ${id}`,
    item_code: `ITEM-${id}`,
    price: 100.0,
    vendorId: overrides.vendorId ?? 1,
    deletedAt: null,
    ...overrides,
  };
};

// ============================================================================
// Item Price History Factory
// ============================================================================

export interface TestItemPriceHistory {
  id: number;
  itemId: number;
  price: number;
  date: Date;
}

export const createTestItemPriceHistory = (
  overrides: Partial<TestItemPriceHistory> = {}
): TestItemPriceHistory => {
  const id = overrides.id ?? generateId();
  return {
    id,
    itemId: overrides.itemId ?? 1,
    price: 100.0,
    date: new Date(),
    ...overrides,
  };
};

// ============================================================================
// Invoice Factory
// ============================================================================

export interface TestInvoiceItem {
  id: number;
  invoiceId: number;
  itemId: number;
  quantity: number;
  price: number;
  item?: TestItem;
}

export interface TestInvoice {
  id: number;
  date: Date;
  status: string;
  totalAmount: number;
  userId: number | null;
  project: string | null;
  accountingId: string | null;
  syncStatus: string;
  syncError: string | null;
  deletedAt: Date | null;
  purchaseOrderId: number | null;
  branchId: number | null;
  departmentId: number | null;
  costCenterId: number | null;
  items?: TestInvoiceItem[];
  user?: Pick<TestUser, 'id' | 'name' | 'email'>;
}

export const createTestInvoiceItem = (
  overrides: Partial<TestInvoiceItem> = {}
): TestInvoiceItem => {
  const id = overrides.id ?? generateId();
  return {
    id,
    invoiceId: overrides.invoiceId ?? 1,
    itemId: overrides.itemId ?? 1,
    quantity: 1,
    price: 100.0,
    ...overrides,
  };
};

export const createTestInvoice = (overrides: Partial<TestInvoice> = {}): TestInvoice => {
  const id = overrides.id ?? generateId();
  return {
    id,
    date: new Date(),
    status: 'PENDING',
    totalAmount: 100.0,
    userId: 1,
    project: null,
    accountingId: null,
    syncStatus: 'PENDING',
    syncError: null,
    deletedAt: null,
    purchaseOrderId: null,
    branchId: null,
    departmentId: null,
    costCenterId: null,
    ...overrides,
  };
};

// ============================================================================
// Purchase Order Factory
// ============================================================================

export interface TestPurchaseOrderItem {
  id: number;
  purchaseOrderId: number;
  itemId: number;
  quantity: number;
  price: number;
  item?: TestItem;
}

export interface TestPurchaseOrder {
  id: number;
  vendorId: number;
  date: Date;
  status: string;
  deletedAt: Date | null;
  vendor?: TestVendor;
  items?: TestPurchaseOrderItem[];
  invoices?: Pick<TestInvoice, 'id' | 'date' | 'status' | 'totalAmount'>[];
}

export const createTestPurchaseOrderItem = (
  overrides: Partial<TestPurchaseOrderItem> = {}
): TestPurchaseOrderItem => {
  const id = overrides.id ?? generateId();
  return {
    id,
    purchaseOrderId: overrides.purchaseOrderId ?? 1,
    itemId: overrides.itemId ?? 1,
    quantity: 1,
    price: 100.0,
    ...overrides,
  };
};

export const createTestPurchaseOrder = (
  overrides: Partial<TestPurchaseOrder> = {}
): TestPurchaseOrder => {
  const id = overrides.id ?? generateId();
  return {
    id,
    vendorId: 1,
    date: new Date(),
    status: 'DRAFT',
    deletedAt: null,
    ...overrides,
  };
};

// ============================================================================
// Branch / Department / Cost Center Factories
// ============================================================================

export interface TestBranch {
  id: number;
  name: string;
}

export interface TestDepartment {
  id: number;
  name: string;
}

export interface TestCostCenter {
  id: number;
  name: string;
  departmentId: number;
}

export const createTestBranch = (overrides: Partial<TestBranch> = {}): TestBranch => {
  const id = overrides.id ?? generateId();
  return {
    id,
    name: `Branch ${id}`,
    ...overrides,
  };
};

export const createTestDepartment = (overrides: Partial<TestDepartment> = {}): TestDepartment => {
  const id = overrides.id ?? generateId();
  return {
    id,
    name: `Department ${id}`,
    ...overrides,
  };
};

export const createTestCostCenter = (overrides: Partial<TestCostCenter> = {}): TestCostCenter => {
  const id = overrides.id ?? generateId();
  return {
    id,
    name: `Cost Center ${id}`,
    departmentId: overrides.departmentId ?? 1,
    ...overrides,
  };
};

// ============================================================================
// JWT Token Helpers for Integration Tests
// ============================================================================

import jwt from 'jsonwebtoken';

// Must match the value set in tests/setup.ts
const TEST_JWT_SECRET = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

// Must match the values in config/jwt.ts
const TEST_JWT_ISSUER = 'payment-management-api';
const TEST_JWT_AUDIENCE = 'payment-management-client';

export const createTestToken = (userId: number): string => {
  return jwt.sign({ userId }, TEST_JWT_SECRET, {
    expiresIn: '1h',
    issuer: TEST_JWT_ISSUER,
    audience: TEST_JWT_AUDIENCE,
  });
};

export const getTestJwtSecret = (): string => TEST_JWT_SECRET;
export const getTestJwtIssuer = (): string => TEST_JWT_ISSUER;
export const getTestJwtAudience = (): string => TEST_JWT_AUDIENCE;
