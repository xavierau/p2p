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
 * Context passed to validation rules during execution
 */
export interface ValidationContext {
  prisma: any; // PrismaClient (avoid circular dependency)
  config: RuleConfig;
}

/**
 * Base interface for all validation rules
 */
export interface IValidationRule {
  ruleType: ValidationRuleType;
  severity: ValidationSeverity;
  enabled: boolean;

  /**
   * Execute the validation rule
   * @param invoice - Invoice to validate (with all relations loaded)
   * @param context - Validation context (database, config, etc.)
   * @returns ValidationResult
   */
  validate(invoice: any, context: ValidationContext): Promise<ValidationResult>;
}

/**
 * Duplicate detection service interface
 */
export interface IDuplicateDetector {
  /**
   * Check if invoice is a duplicate
   * @param invoice - Invoice to check
   * @returns ValidationResult
   */
  checkDuplicate(invoice: any): Promise<ValidationResult>;
}

/**
 * Suspicious pattern detection service interface
 */
export interface ISuspiciousDetector {
  /**
   * Detect suspicious patterns in invoice
   * @param invoice - Invoice to analyze
   * @returns Array of ValidationResults (one per triggered rule)
   */
  detectAnomalies(invoice: any): Promise<ValidationResult[]>;
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

  const severityOrder = {
    [ValidationSeverity.CRITICAL]: 4,
    [ValidationSeverity.ERROR]: 3,
    [ValidationSeverity.WARNING]: 2,
    [ValidationSeverity.INFO]: 1,
  };

  return validations.reduce((highest, current) => {
    return severityOrder[current.severity] > severityOrder[highest]
      ? current.severity
      : highest;
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
