import { UserRole } from '@prisma/client';

export enum Permission {
  // Vendor permissions
  VENDOR_READ = 'VENDOR_READ',
  VENDOR_CREATE = 'VENDOR_CREATE',
  VENDOR_UPDATE = 'VENDOR_UPDATE',
  VENDOR_DELETE = 'VENDOR_DELETE',

  // Item permissions
  ITEM_READ = 'ITEM_READ',
  ITEM_CREATE = 'ITEM_CREATE',
  ITEM_UPDATE = 'ITEM_UPDATE',
  ITEM_DELETE = 'ITEM_DELETE',

  // Invoice permissions
  INVOICE_READ = 'INVOICE_READ',
  INVOICE_CREATE = 'INVOICE_CREATE',
  INVOICE_UPDATE = 'INVOICE_UPDATE',
  INVOICE_DELETE = 'INVOICE_DELETE',
  INVOICE_APPROVE = 'INVOICE_APPROVE',
  INVOICE_REJECT = 'INVOICE_REJECT',

  // Purchase Order permissions
  PO_READ = 'PO_READ',
  PO_CREATE = 'PO_CREATE',
  PO_UPDATE = 'PO_UPDATE',
  PO_DELETE = 'PO_DELETE',
  PO_STATUS_CHANGE = 'PO_STATUS_CHANGE',

  // Analytics permissions
  ANALYTICS_READ = 'ANALYTICS_READ',

  // Settings permissions
  SETTINGS_READ = 'SETTINGS_READ',
  SETTINGS_UPDATE = 'SETTINGS_UPDATE',

  // Department/Branch/Cost Center permissions
  DEPARTMENT_READ = 'DEPARTMENT_READ',
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: Object.values(Permission),

  [UserRole.MANAGER]: [
    // Vendor - full access
    Permission.VENDOR_READ,
    Permission.VENDOR_CREATE,
    Permission.VENDOR_UPDATE,
    Permission.VENDOR_DELETE,

    // Item - full access
    Permission.ITEM_READ,
    Permission.ITEM_CREATE,
    Permission.ITEM_UPDATE,
    Permission.ITEM_DELETE,

    // Invoice - full access including approve/reject
    Permission.INVOICE_READ,
    Permission.INVOICE_CREATE,
    Permission.INVOICE_UPDATE,
    Permission.INVOICE_DELETE,
    Permission.INVOICE_APPROVE,
    Permission.INVOICE_REJECT,

    // Purchase Order - full access
    Permission.PO_READ,
    Permission.PO_CREATE,
    Permission.PO_UPDATE,
    Permission.PO_DELETE,
    Permission.PO_STATUS_CHANGE,

    // Analytics - read only
    Permission.ANALYTICS_READ,

    // Settings - read only
    Permission.SETTINGS_READ,

    // Department - read only
    Permission.DEPARTMENT_READ,
  ],

  [UserRole.USER]: [
    // Vendor - read and create
    Permission.VENDOR_READ,
    Permission.VENDOR_CREATE,

    // Item - read and create
    Permission.ITEM_READ,
    Permission.ITEM_CREATE,

    // Invoice - read and create (no approve/reject)
    Permission.INVOICE_READ,
    Permission.INVOICE_CREATE,

    // Purchase Order - read and create
    Permission.PO_READ,
    Permission.PO_CREATE,

    // Analytics - read only
    Permission.ANALYTICS_READ,

    // Settings - read only
    Permission.SETTINGS_READ,

    // Department - read only
    Permission.DEPARTMENT_READ,
  ],

  [UserRole.VIEWER]: [
    // Read-only access to all resources
    Permission.VENDOR_READ,
    Permission.ITEM_READ,
    Permission.INVOICE_READ,
    Permission.PO_READ,
    Permission.ANALYTICS_READ,
    Permission.SETTINGS_READ,
    Permission.DEPARTMENT_READ,
  ],
};

export const hasPermission = (role: UserRole, permission: Permission): boolean => {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions.includes(permission);
};

export const hasAllPermissions = (role: UserRole, requiredPermissions: Permission[]): boolean => {
  return requiredPermissions.every((permission) => hasPermission(role, permission));
};
