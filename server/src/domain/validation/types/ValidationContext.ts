/**
 * Validation Context Type Definitions
 *
 * Context provided to validation rules during execution.
 * Contains supporting data needed for rule evaluation.
 */

import { PrismaClient } from '@prisma/client';
import {
  PurchaseOrderWithRelations,
  DeliveryNoteWithRelations,
  ItemPriceHistoryEntry,
  InvoiceWithRelations
} from './Invoice';

/**
 * Configuration for validation rules
 * Loaded from database ValidationRule.config JSON field
 */
export interface RuleConfig {
  enabled?: boolean;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';

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
 * Validation Context
 * Passed to all validation rules during execution
 */
export interface ValidationContext {
  /**
   * Prisma client instance for database queries
   * Note: Using PrismaClient type from @prisma/client
   */
  prisma?: PrismaClient;

  /**
   * Rule-specific configuration from database
   */
  config?: RuleConfig;

  /**
   * Purchase Order linked to the invoice (if any)
   */
  purchaseOrder?: PurchaseOrderWithRelations;

  /**
   * Delivery Notes linked to the invoice
   */
  deliveryNotes?: DeliveryNoteWithRelations[];

  /**
   * Historical invoices for the same vendor (for pattern detection)
   */
  historicalInvoices?: InvoiceWithRelations[];

  /**
   * Item price history for all items in the invoice
   */
  priceHistory?: ItemPriceHistoryEntry[];
}
