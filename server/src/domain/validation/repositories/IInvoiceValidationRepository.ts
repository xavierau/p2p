/**
 * Invoice Validation Repository Interface
 *
 * Domain layer interface for invoice validation data access.
 * Decouples domain logic from persistence implementation.
 */

import { ValidationRuleType, ValidationSeverity, ValidationStatus } from '@prisma/client';

export interface InvoiceValidation {
  id: number;
  invoiceId: number;
  ruleType: ValidationRuleType;
  severity: ValidationSeverity;
  status: ValidationStatus;
  details: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  reviewedAt: Date | null;
  reviewedBy: number | null;
}

export interface CreateInvoiceValidationData {
  invoiceId: number;
  ruleType: ValidationRuleType;
  severity: ValidationSeverity;
  status: ValidationStatus;
  details: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface IInvoiceValidationRepository {
  /**
   * Create multiple invoice validations in bulk
   */
  createMany(data: CreateInvoiceValidationData[]): Promise<void>;

  /**
   * Find all validations for an invoice
   */
  findByInvoiceId(invoiceId: number): Promise<InvoiceValidation[]>;

  /**
   * Delete all validations for an invoice
   */
  deleteByInvoiceId(invoiceId: number): Promise<void>;
}
