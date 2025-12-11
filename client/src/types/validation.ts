/**
 * Type definitions for Invoice Validation Feature
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * Types of validation rules
 */
export enum ValidationRuleType {
  DUPLICATE_INVOICE_NUMBER = 'DUPLICATE_INVOICE_NUMBER',
  MISSING_INVOICE_NUMBER = 'MISSING_INVOICE_NUMBER',
  AMOUNT_THRESHOLD_EXCEEDED = 'AMOUNT_THRESHOLD_EXCEEDED',
  ROUND_AMOUNT_PATTERN = 'ROUND_AMOUNT_PATTERN',
  PO_AMOUNT_VARIANCE = 'PO_AMOUNT_VARIANCE',
  PO_ITEM_MISMATCH = 'PO_ITEM_MISMATCH',
  DELIVERY_NOTE_MISMATCH = 'DELIVERY_NOTE_MISMATCH',
  PRICE_VARIANCE = 'PRICE_VARIANCE'
}

/**
 * Severity levels for validation issues
 */
export enum ValidationSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL'
}

/**
 * Status of a validation issue
 */
export enum ValidationStatus {
  FLAGGED = 'FLAGGED',
  REVIEWED = 'REVIEWED',
  DISMISSED = 'DISMISSED',
  OVERRIDDEN = 'OVERRIDDEN'
}

// ============================================================================
// Core Entities
// ============================================================================

/**
 * User information (minimal for validation context)
 */
export interface ValidationUser {
  id: number;
  name: string;
  email: string;
}

/**
 * Override record for a validation issue
 */
export interface ValidationOverride {
  id: number;
  validationId: number;
  userId: number;
  reason: string;
  createdAt: string;
  user?: ValidationUser;
}

/**
 * Invoice validation record
 */
export interface InvoiceValidation {
  id: number;
  invoiceId: number;
  ruleType: ValidationRuleType;
  severity: ValidationSeverity;
  status: ValidationStatus;
  details: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewedBy?: number;
  override?: ValidationOverride;
}

/**
 * Validation rule configuration
 */
export interface ValidationRule {
  id: number;
  ruleType: ValidationRuleType;
  name: string;
  description: string;
  enabled: boolean;
  severity: ValidationSeverity;
  config?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Summary of validation issues for an invoice
 */
export interface InvoiceValidationSummary {
  invoiceId: number;
  flagCount: number;
  hasBlockingIssues: boolean;
  validations: InvoiceValidation[];
}

/**
 * Dashboard statistics
 */
export interface ValidationDashboardStats {
  totalFlagged: number;
  bySeverity: Array<{
    severity: ValidationSeverity;
    _count: number;
  }>;
  byStatus: Array<{
    status: ValidationStatus;
    _count: number;
  }>;
  recentFlags: InvoiceValidation[];
}

// ============================================================================
// Filter Types
// ============================================================================

/**
 * Filters for querying flagged invoices
 */
export interface FlaggedInvoicesFilters {
  severity?: ValidationSeverity;
  status?: ValidationStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

// ============================================================================
// Input Types
// ============================================================================

/**
 * Input for overriding a validation
 */
export interface OverrideValidationInput {
  reason: string;
}

/**
 * Input for reviewing a validation
 */
export interface ReviewValidationInput {
  action: 'DISMISS' | 'ESCALATE';
}

/**
 * Input for updating a validation rule
 */
export interface UpdateValidationRuleInput {
  enabled?: boolean;
  severity?: ValidationSeverity;
  config?: Record<string, unknown>;
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Severity configuration for UI display
 */
export interface SeverityConfig {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  variant: 'default' | 'destructive' | 'warning' | 'info';
}

/**
 * Rule type display information
 */
export interface RuleTypeInfo {
  label: string;
  description: string;
  category: 'duplicate' | 'quality' | 'variance' | 'mismatch';
}
