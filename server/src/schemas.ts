import { z } from 'zod';
import { sanitizeString } from './utils/sanitization';

// ============================================================================
// Sanitization Helpers
// ============================================================================

/**
 * Creates a sanitized string schema that strips HTML and trims whitespace.
 * Use this for user-provided text inputs to prevent XSS attacks.
 */
export const sanitizedString = (maxLength?: number) => {
  let schema = z.string().transform(sanitizeString);
  if (maxLength) {
    schema = z.string().max(maxLength).transform(sanitizeString);
  }
  return schema;
};

/**
 * Creates an optional sanitized string schema.
 */
export const optionalSanitizedString = (maxLength?: number) => {
  return sanitizedString(maxLength).optional();
};

/**
 * Creates a nullable sanitized string schema.
 */
export const nullableSanitizedString = (maxLength?: number) => {
  return sanitizedString(maxLength).nullable();
};

// ============================================================================
// Operators
// ============================================================================
export const StringOperatorSchema = z.enum(['=', 'contains']);
export type StringOperator = z.infer<typeof StringOperatorSchema>;

export const NumericOperatorSchema = z.enum(['=', '>', '<', '>=', '<=']);
export type NumericOperator = z.infer<typeof NumericOperatorSchema>;

export const IdOperatorSchema = z.enum(['=']);
export type IdOperator = z.infer<typeof IdOperatorSchema>;

// ============================================================================
// Status Enums
// ============================================================================
export const PurchaseOrderStatusSchema = z.enum(['DRAFT', 'SENT', 'FULFILLED']);
export type PurchaseOrderStatus = z.infer<typeof PurchaseOrderStatusSchema>;

export const InvoiceStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>;

export const SyncStatusSchema = z.enum(['PENDING', 'SYNCED', 'FAILED']);
export type SyncStatus = z.infer<typeof SyncStatusSchema>;

// ============================================================================
// Pagination
// ============================================================================
export const PaginationSchema = z.object({
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('10'),
});
export type PaginationInput = z.infer<typeof PaginationSchema>;

export interface ParsedPagination {
    page: number;
    limit: number;
    skip: number;
}

export const parsePagination = (pagination: PaginationInput): ParsedPagination => {
    const pageNum = Math.max(1, parseInt(pagination.page || '1', 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(pagination.limit || '10', 10)));
    return {
        page: pageNum,
        limit: limitNum,
        skip: (pageNum - 1) * limitNum,
    };
};

// We need to handle date strings from API calls and convert them to Date objects
const dateSchema = z.preprocess((arg) => {
  if (typeof arg == "string" || arg instanceof Date) return new Date(arg);
}, z.date());

// Model Schemas
export const vendorSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  contact: z.string().nullable(),
});

export const itemSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  item_code: z.string().nullable(),
  price: z.number(),
  vendorId: z.number().int(),
});

export const invoiceSchema = z.object({
  id: z.number().int(),
  date: dateSchema,
  status: InvoiceStatusSchema,
  totalAmount: z.number(),
  userId: z.number().int().nullable(),
  project: z.string().nullable(),
  accountingId: z.string().nullable(),
  syncStatus: SyncStatusSchema,
  syncError: z.string().nullable(),
  purchaseOrderId: z.number().int().nullable(),
  branchId: z.number().int().nullable(),
  departmentId: z.number().int().nullable(),
  costCenterId: z.number().int().nullable(),
});

export const purchaseOrderSchema = z.object({
  id: z.number().int(),
  vendorId: z.number().int(),
  date: dateSchema,
  status: PurchaseOrderStatusSchema,
});

export const analyticsSchema = z.object({
  totalInvoices: z.number(),
  totalVendors: z.number(),
  totalItems: z.number(),
  totalPurchaseOrders: z.number(),
  invoiceStatusCounts: z.array(z.object({
      _count: z.object({ status: z.number() }),
      status: z.string()
  })),
  poStatusCounts: z.array(z.object({
      _count: z.object({ status: z.number() }),
      status: z.string()
  })),
});

export const createInvoiceSchema = z.object({
    invoiceNumber: optionalSanitizedString(100),
    items: z.array(z.object({
        itemId: z.number(),
        quantity: z.number(),
        price: z.number(),
    })),
    project: optionalSanitizedString(255),
    branchId: z.number().optional(),
    departmentId: z.number().optional(),
    costCenterId: z.number().optional(),
    purchaseOrderId: z.number().optional(),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

// ============================================================================
// Validation Schemas
// ============================================================================
export const ValidationSeveritySchema = z.enum(['INFO', 'WARNING', 'CRITICAL']);
export type ValidationSeverity = z.infer<typeof ValidationSeveritySchema>;

export const ValidationStatusSchema = z.enum(['FLAGGED', 'REVIEWED', 'DISMISSED', 'OVERRIDDEN']);
export type ValidationStatus = z.infer<typeof ValidationStatusSchema>;

export const ReviewValidationActionSchema = z.enum(['DISMISS', 'ESCALATE']);
export type ReviewValidationAction = z.infer<typeof ReviewValidationActionSchema>;

export const ReviewValidationSchema = z.object({
  action: ReviewValidationActionSchema,
});
export type ReviewValidationInput = z.infer<typeof ReviewValidationSchema>;

export const OverrideValidationSchema = z.object({
  reason: sanitizedString(500).refine(v => v.length >= 10,
    'Override reason must be at least 10 characters'
  ),
});
export type OverrideValidationInput = z.infer<typeof OverrideValidationSchema>;

export const GetFlaggedInvoicesFiltersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  severity: ValidationSeveritySchema.optional(),
  status: ValidationStatusSchema.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
}).partial();
export type GetFlaggedInvoicesFiltersInput = z.infer<typeof GetFlaggedInvoicesFiltersSchema>;

export const UpdateValidationRuleSchema = z.object({
  enabled: z.boolean().optional(),
  severity: ValidationSeveritySchema.optional(),
  config: z.record(z.unknown()).optional(),
});
export type UpdateValidationRuleInput = z.infer<typeof UpdateValidationRuleSchema>;

// ============================================================================
// Vendor Schemas
// ============================================================================
export const CreateVendorSchema = z.object({
    name: sanitizedString(255).refine((v) => v.length >= 1, 'Name is required'),
    contact: optionalSanitizedString(255),
});
export type CreateVendorInput = z.infer<typeof CreateVendorSchema>;

export const UpdateVendorSchema = z.object({
    name: sanitizedString(255).optional(),
    contact: nullableSanitizedString(255).optional(),
});
export type UpdateVendorInput = z.infer<typeof UpdateVendorSchema>;

export const GetVendorsFiltersSchema = z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    idOperator: IdOperatorSchema.optional(),
    nameOperator: StringOperatorSchema.optional(),
}).partial();
export type GetVendorsFiltersInput = z.infer<typeof GetVendorsFiltersSchema>;

// ============================================================================
// Item Schemas
// ============================================================================
export const CreateItemSchema = z.object({
    name: sanitizedString(255).refine((v) => v.length >= 1, 'Name is required'),
    price: z.number(),
    vendorId: z.number(),
});
export type CreateItemInput = z.infer<typeof CreateItemSchema>;

export const UpdateItemSchema = z.object({
    name: sanitizedString(255).optional(),
    item_code: nullableSanitizedString(100).optional(),
    price: z.number().optional(),
    vendorId: z.number().int().optional(),
});
export type UpdateItemInput = z.infer<typeof UpdateItemSchema>;

export const GetItemsFiltersSchema = z.object({
    vendorId: z.string().optional(),
    vendorName: z.string().optional(),
    vendorIdOperator: IdOperatorSchema.optional(),
    vendorNameOperator: StringOperatorSchema.optional(),
}).partial();
export type GetItemsFiltersInput = z.infer<typeof GetItemsFiltersSchema>;

// ============================================================================
// Invoice Schemas
// ============================================================================
export const InvoiceItemSchema = z.object({
    itemId: z.number(),
    quantity: z.number(),
    price: z.number(),
});

export const UpdateInvoiceSchema = z.object({
    items: z.array(InvoiceItemSchema).optional(),
    project: nullableSanitizedString(255).optional(),
    branchId: z.number().nullable().optional(),
    departmentId: z.number().nullable().optional(),
    costCenterId: z.number().nullable().optional(),
    purchaseOrderId: z.number().nullable().optional(),
});
export type UpdateInvoiceInput = z.infer<typeof UpdateInvoiceSchema>;

export const GetInvoicesFiltersSchema = z.object({
    status: InvoiceStatusSchema.optional(),
    vendorId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    project: z.string().optional(),
    branchId: z.string().optional(),
    departmentId: z.string().optional(),
    costCenterId: z.string().optional(),
    syncStatus: SyncStatusSchema.optional(),
}).partial();
export type GetInvoicesFiltersInput = z.infer<typeof GetInvoicesFiltersSchema>;

// ============================================================================
// Purchase Order Schemas
// ============================================================================
export const PurchaseOrderItemSchema = z.object({
    itemId: z.number(),
    quantity: z.number(),
    price: z.number(),
});

export const CreatePurchaseOrderSchema = z.object({
    vendorId: z.number(),
    items: z.array(PurchaseOrderItemSchema),
});
export type CreatePurchaseOrderInput = z.infer<typeof CreatePurchaseOrderSchema>;

export const UpdatePurchaseOrderSchema = z.object({
    vendorId: z.number().optional(),
    items: z.array(PurchaseOrderItemSchema).optional(),
});
export type UpdatePurchaseOrderInput = z.infer<typeof UpdatePurchaseOrderSchema>;

export const GetPurchaseOrdersFiltersSchema = z.object({
    vendorId: z.string().optional(),
    status: PurchaseOrderStatusSchema.optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
}).partial();
export type GetPurchaseOrdersFiltersInput = z.infer<typeof GetPurchaseOrdersFiltersSchema>;

// ============================================================================
// Authentication Schemas
// ============================================================================

/**
 * Password strength requirements:
 * - Minimum 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 * - At least one special character
 */
const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one digit')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: passwordSchema,
  name: sanitizedString(255).refine((v) => v.length >= 1, 'Name is required'),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
