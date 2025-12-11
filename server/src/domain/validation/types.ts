/**
 * Invoice Validation System - Type Definitions
 *
 * Core types and interfaces for the validation domain.
 * These types represent the domain model independent of persistence layer.
 */

// ============================================================================
// Enums (Value Objects)
// ============================================================================

export enum ValidationRuleType {
  DUPLICATE_INVOICE_NUMBER = 'DUPLICATE_INVOICE_NUMBER',
  MISSING_INVOICE_NUMBER = 'MISSING_INVOICE_NUMBER',
  AMOUNT_THRESHOLD_EXCEEDED = 'AMOUNT_THRESHOLD_EXCEEDED',
  ROUND_AMOUNT_PATTERN = 'ROUND_AMOUNT_PATTERN',
  PO_AMOUNT_VARIANCE = 'PO_AMOUNT_VARIANCE',
  PO_ITEM_MISMATCH = 'PO_ITEM_MISMATCH',
  DELIVERY_NOTE_MISMATCH = 'DELIVERY_NOTE_MISMATCH',
  PRICE_VARIANCE = 'PRICE_VARIANCE',
}

export enum ValidationSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

export enum ValidationStatus {
  FLAGGED = 'FLAGGED',
  REVIEWED = 'REVIEWED',
  OVERRIDDEN = 'OVERRIDDEN',
  DISMISSED = 'DISMISSED',
}

// ============================================================================
// Value Objects
// ============================================================================

/**
 * Result of a single validation rule execution
 */
export interface ValidationResult {
  readonly ruleType: ValidationRuleType;
  readonly severity: ValidationSeverity;
  readonly passed: boolean;
  readonly details: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Configuration for a validation rule
 */
export interface RuleConfig {
  // Common configs
  enabled?: boolean;
  severity?: ValidationSeverity;

  // Amount threshold configs
  amountThreshold?: number;

  // Round amount configs
  roundingIncrement?: number;
  minAmount?: number;

  // Variance configs
  varianceThresholdPercent?: number;
  poVarianceThreshold?: number;
  priceVarianceThreshold?: number;

  // Custom configs (extensible)
  [key: string]: unknown;
}

/**
 * Summary of all validations for an invoice
 */
export interface InvoiceValidationSummary {
  readonly invoiceId: number;
  readonly isValid: boolean;
  readonly hasBlockingIssues: boolean;
  readonly flagCount: number;
  readonly highestSeverity: ValidationSeverity | null;
  readonly validations: ValidationResult[];
}

// ============================================================================
// Entities
// ============================================================================

/**
 * Invoice Validation entity
 * Represents a single validation check result persisted to database
 */
export interface InvoiceValidation {
  id: number;
  invoiceId: number;
  ruleType: ValidationRuleType;
  severity: ValidationSeverity;
  status: ValidationStatus;
  passed: boolean;
  details: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: number;
  override?: ValidationOverride;
}

/**
 * Validation Rule entity
 * Represents a configurable validation rule
 */
export interface ValidationRule {
  id: number;
  ruleType: ValidationRuleType;
  name: string;
  description?: string;
  enabled: boolean;
  severity: ValidationSeverity;
  config: RuleConfig;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validation Override entity
 * Represents a user's decision to override a validation flag
 */
export interface ValidationOverride {
  id: number;
  validationId: number;
  userId: number;
  reason: string;
  createdAt: Date;
}

// ============================================================================
// Domain Services Interfaces
// ============================================================================

/**
 * DEPRECATED: Use types from './types/ValidationContext' instead
 * Re-export for backward compatibility during migration
 */
export type { ValidationContext } from './types/ValidationContext';

/**
 * DEPRECATED: Use IValidationRule from './interfaces/IValidationRule' instead
 */
export type { IValidationRule } from './interfaces/IValidationRule';

/**
 * Duplicate detection service interface
 */
export interface IDuplicateDetector {
  /**
   * Check if invoice is a duplicate
   * @param invoice - Invoice to check
   * @returns ValidationResult
   */
  checkDuplicate(invoice: InvoiceForDuplicateCheck): Promise<ValidationResult>;
}

/**
 * Simplified Invoice for duplicate detection (minimal fields)
 */
export interface InvoiceForDuplicateCheck {
  id: number;
  invoiceNumber: string | null;
  vendorId: number | null;
  date: Date;
  totalAmount: number;
  status: string;
  deletedAt: Date | null;
}

/**
 * Suspicious pattern detection service interface
 */
export interface ISuspiciousDetector {
  /**
   * Detect suspicious patterns in invoice
   * @param invoice - Invoice to analyze with all relations
   * @param context - Validation context with supporting data
   * @returns Array of ValidationResults (one per triggered rule)
   */
  detectAnomalies(invoice: InvoiceWithRelations, context: import('./types/ValidationContext').ValidationContext): Promise<ValidationResult[]>;
}

/**
 * Invoice with all relations for validation
 */
export interface InvoiceWithRelations {
  id: number;
  invoiceNumber: string | null;
  vendorId: number | null;
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
  items: InvoiceItemWithRelations[];
  purchaseOrder?: PurchaseOrderWithRelations | null;
  deliveryNotes?: InvoiceDeliveryLinkWithRelations[];
  vendor?: VendorEntity | null;
}

export interface InvoiceItemWithRelations {
  id: number;
  invoiceId: number;
  itemId: number;
  quantity: number;
  price: number;
  item: ItemEntity;
}

export interface ItemEntity {
  id: number;
  name: string;
  item_code: string | null;
  price: number;
  vendorId: number;
  deletedAt: Date | null;
}

export interface PurchaseOrderWithRelations {
  id: number;
  vendorId: number;
  date: Date;
  status: string;
  deletedAt: Date | null;
  items: PurchaseOrderItemWithRelations[];
}

export interface PurchaseOrderItemWithRelations {
  id: number;
  purchaseOrderId: number;
  itemId: number;
  quantity: number;
  price: number;
  item?: ItemEntity;
}

export interface InvoiceDeliveryLinkWithRelations {
  id: number;
  invoiceId: number;
  deliveryNoteId: number;
  linkedAt: Date;
  linkedBy: number;
  deliveryNote: DeliveryNoteWithRelations;
}

export interface DeliveryNoteWithRelations {
  id: number;
  deliveryDate: Date;
  receivedBy: string;
  notes: string | null;
  status: 'DRAFT' | 'CONFIRMED';
  purchaseOrderId: number;
  vendorId: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: number;
  items: DeliveryNoteItemWithRelations[];
}

export interface DeliveryNoteItemWithRelations {
  id: number;
  deliveryNoteId: number;
  itemId: number;
  quantityOrdered: number;
  quantityDelivered: number;
  condition: 'GOOD' | 'DAMAGED' | 'PARTIAL';
  discrepancyReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  item?: ItemEntity;
}

export interface VendorEntity {
  id: number;
  name: string;
  contact: string | null;
  deletedAt: Date | null;
}

/**
 * Validation orchestrator interface
 * Coordinates all validation activities
 */
export interface IValidationOrchestrator {
  /**
   * Validate an invoice by running all enabled rules
   * @param invoiceId - ID of invoice to validate
   * @returns InvoiceValidationSummary
   */
  validateInvoice(invoiceId: number): Promise<InvoiceValidationSummary>;
}

// ============================================================================
// Repository Interfaces
// ============================================================================

/**
 * Invoice Validation repository interface
 */
export interface IInvoiceValidationRepository {
  create(validation: CreateInvoiceValidation): Promise<InvoiceValidation>;
  findById(id: number): Promise<InvoiceValidation | null>;
  findByInvoiceId(invoiceId: number): Promise<InvoiceValidation[]>;
  findFlagged(filters: FlaggedFilters, pagination: Pagination): Promise<PaginatedResult<InvoiceValidation>>;
  update(id: number, data: UpdateInvoiceValidation): Promise<InvoiceValidation>;
  delete(id: number): Promise<void>;
  deleteByInvoiceId(invoiceId: number): Promise<void>;
}

/**
 * Validation Rule repository interface
 */
export interface IValidationRuleRepository {
  findAll(): Promise<ValidationRule[]>;
  findEnabled(): Promise<ValidationRule[]>;
  findById(id: number): Promise<ValidationRule | null>;
  findByType(ruleType: ValidationRuleType): Promise<ValidationRule | null>;
  update(id: number, data: UpdateValidationRule): Promise<ValidationRule>;
}

/**
 * Validation Override repository interface
 */
export interface IValidationOverrideRepository {
  create(override: CreateValidationOverride): Promise<ValidationOverride>;
  findByValidationId(validationId: number): Promise<ValidationOverride | null>;
  findByUserId(userId: number, pagination: Pagination): Promise<PaginatedResult<ValidationOverride>>;
}

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

/**
 * Create Invoice Validation DTO
 */
export interface CreateInvoiceValidation {
  invoiceId: number;
  ruleType: ValidationRuleType;
  severity: ValidationSeverity;
  passed: boolean;
  details: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Update Invoice Validation DTO
 */
export interface UpdateInvoiceValidation {
  status?: ValidationStatus;
  reviewedAt?: Date;
  reviewedBy?: number;
}

/**
 * Update Validation Rule DTO
 */
export interface UpdateValidationRule {
  enabled?: boolean;
  severity?: ValidationSeverity;
  config?: RuleConfig;
}

/**
 * Create Validation Override DTO
 */
export interface CreateValidationOverride {
  validationId: number;
  userId: number;
  reason: string;
}

// ============================================================================
// Query Filters
// ============================================================================

/**
 * Filters for querying flagged invoices
 */
export interface FlaggedFilters {
  severity?: ValidationSeverity;
  status?: ValidationStatus;
  ruleType?: ValidationRuleType;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Pagination parameters
 */
export interface Pagination {
  page: number;
  limit: number;
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// ============================================================================
// Domain Events
// ============================================================================

/**
 * Invoice Created Event
 */
export interface InvoiceCreatedEvent {
  invoiceId: number;
  timestamp: Date;
}

/**
 * Invoice Validated Event
 */
export interface InvoiceValidatedEvent {
  invoiceId: number;
  summary: InvoiceValidationSummary;
  timestamp: Date;
}

/**
 * Duplicate Detected Event
 */
export interface DuplicateDetectedEvent {
  invoiceId: number;
  duplicateInvoiceId: number;
  vendorId: number;
  invoiceNumber: string;
  timestamp: Date;
}

/**
 * Suspicious Detected Event
 */
export interface SuspiciousDetectedEvent {
  invoiceId: number;
  ruleType: ValidationRuleType;
  severity: ValidationSeverity;
  details: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Validation Overridden Event
 */
export interface ValidationOverriddenEvent {
  validationId: number;
  invoiceId: number;
  userId: number;
  reason: string;
  timestamp: Date;
}

/**
 * Validation Reviewed Event
 */
export interface ValidationReviewedEvent {
  validationId: number;
  invoiceId: number;
  userId: number;
  action: 'DISMISS' | 'ESCALATE';
  timestamp: Date;
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Helper to determine if validation should block approval
 */
export const isBlockingValidation = (validation: InvoiceValidation): boolean => {
  return (
    validation.severity === ValidationSeverity.CRITICAL &&
    !validation.passed &&
    validation.status !== ValidationStatus.OVERRIDDEN
  );
};

/**
 * Helper to determine highest severity level from array
 */
export const getHighestSeverity = (
  validations: InvoiceValidation[]
): ValidationSeverity | null => {
  if (validations.length === 0) return null;

  // Using partial record since ERROR severity doesn't exist in our validation domain
  const severityOrder: Partial<Record<ValidationSeverity, number>> = {
    [ValidationSeverity.CRITICAL]: 3,
    [ValidationSeverity.WARNING]: 2,
    [ValidationSeverity.INFO]: 1,
  };

  return validations.reduce((highest: ValidationSeverity, current: InvoiceValidation) => {
    const currentValue = severityOrder[current.severity] || 0;
    const highestValue = severityOrder[highest] || 0;
    return currentValue > highestValue ? current.severity : highest;
  }, ValidationSeverity.INFO);
};

/**
 * Helper to check if invoice has blocking issues
 */
export const hasBlockingIssues = (validations: InvoiceValidation[]): boolean => {
  return validations.some(isBlockingValidation);
};

/**
 * Helper to count validations by status
 */
export const countByStatus = (
  validations: InvoiceValidation[]
): Record<ValidationStatus, number> => {
  return validations.reduce(
    (counts, validation) => {
      counts[validation.status] = (counts[validation.status] || 0) + 1;
      return counts;
    },
    {} as Record<ValidationStatus, number>
  );
};

/**
 * Helper to count validations by severity
 */
export const countBySeverity = (
  validations: InvoiceValidation[]
): Record<ValidationSeverity, number> => {
  return validations.reduce(
    (counts, validation) => {
      counts[validation.severity] = (counts[validation.severity] || 0) + 1;
      return counts;
    },
    {} as Record<ValidationSeverity, number>
  );
};
