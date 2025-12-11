/**
 * Invoice Type Definitions for Validation Domain
 *
 * These types represent the invoice data structure as loaded by Prisma
 * with all necessary relations for validation rules.
 */

import { PrismaClient } from '@prisma/client';

// Prisma type helper to extract the exact type returned by Prisma queries
type PrismaInvoiceWithRelations = NonNullable<
  Awaited<
    ReturnType<
      PrismaClient['invoice']['findFirst']
    >
  >
>;

/**
 * Invoice item with related Item entity
 */
export interface InvoiceItemWithRelations {
  id: number;
  invoiceId: number;
  itemId: number;
  quantity: number;
  price: number;
  item: {
    id: number;
    name: string;
    item_code: string | null;
    price: number;
    vendorId: number;
    deletedAt: Date | null;
  };
}

/**
 * Purchase Order item with related Item entity
 */
export interface PurchaseOrderItemWithRelations {
  id: number;
  purchaseOrderId: number;
  itemId: number;
  quantity: number;
  price: number;
  item?: {
    id: number;
    name: string;
    item_code: string | null;
    price: number;
    vendorId: number;
  };
}

/**
 * Purchase Order with items
 */
export interface PurchaseOrderWithRelations {
  id: number;
  vendorId: number;
  date: Date;
  status: string;
  deletedAt: Date | null;
  items: PurchaseOrderItemWithRelations[];
}

/**
 * Delivery Note item with related Item entity
 */
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
  item?: {
    id: number;
    name: string;
    item_code: string | null;
    price: number;
    vendorId: number;
  };
}

/**
 * Delivery Note with items
 */
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

/**
 * Invoice Delivery Link (join table)
 */
export interface InvoiceDeliveryLinkWithRelations {
  id: number;
  invoiceId: number;
  deliveryNoteId: number;
  linkedAt: Date;
  linkedBy: number;
  deliveryNote: DeliveryNoteWithRelations;
}

/**
 * Vendor entity
 */
export interface VendorEntity {
  id: number;
  name: string;
  contact: string | null;
  deletedAt: Date | null;
}

/**
 * Item Price History entry
 */
export interface ItemPriceHistoryEntry {
  id: number;
  itemId: number;
  price: number;
  date: Date;
}

/**
 * Complete Invoice entity with all relations needed for validation
 * This is the primary type used throughout the validation domain
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

  // Relations
  items: InvoiceItemWithRelations[];
  purchaseOrder?: PurchaseOrderWithRelations | null;
  deliveryNotes?: InvoiceDeliveryLinkWithRelations[];
  vendor?: VendorEntity | null;
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
