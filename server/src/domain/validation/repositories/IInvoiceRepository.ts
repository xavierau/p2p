/**
 * Invoice Repository Interface
 *
 * Domain layer interface for invoice data access.
 * Decouples domain logic from persistence implementation.
 */

export interface InvoiceQueryOptions {
  includeItems?: boolean;
  includePurchaseOrder?: boolean;
  includeDeliveryNotes?: boolean;
}

export interface Invoice {
  id: number;
  invoiceNumber: string | null;
  vendorId: number;
  totalAmount: number;
  date: Date;
  status: string;
  userId: number;
  deletedAt: Date | null;
  items?: InvoiceItem[];
  purchaseOrder?: PurchaseOrder | null;
  deliveryNotes?: InvoiceDeliveryLink[];
}

export interface InvoiceItem {
  id: number;
  invoiceId: number;
  itemId: number;
  quantity: number;
  price: number;
  item?: Item;
}

export interface Item {
  id: number;
  name: string;
  vendorId: number;
}

export interface PurchaseOrder {
  id: number;
  items?: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: number;
  itemId: number;
  quantity: number;
  price: number;
}

export interface InvoiceDeliveryLink {
  deliveryNote: DeliveryNote;
}

export interface DeliveryNote {
  id: number;
  items?: DeliveryNoteItem[];
}

export interface DeliveryNoteItem {
  id: number;
  itemId: number;
  quantity: number;
}

export interface ItemPriceHistory {
  id: number;
  itemId: number;
  price: number;
  date: Date;
}

export interface IInvoiceRepository {
  /**
   * Find invoice by ID with optional relations
   */
  findById(id: number, options?: InvoiceQueryOptions): Promise<Invoice | null>;

  /**
   * Find duplicate invoice by number and vendor
   */
  findDuplicateByNumberAndVendor(
    invoiceNumber: string,
    vendorId: number,
    excludeInvoiceId?: number
  ): Promise<Invoice | null>;

  /**
   * Find price history for items
   */
  findPriceHistoryForItems(itemIds: number[], limit?: number): Promise<ItemPriceHistory[]>;
}
