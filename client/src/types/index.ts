/**
 * Centralized Type Definitions for Payment Management Frontend
 *
 * This file contains all TypeScript type definitions matching the backend API contracts.
 * All entity IDs are typed as `number` to match the database schema.
 */

// ============================================================================
// Pagination Types
// ============================================================================

/**
 * Parameters for paginated API requests
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

/**
 * Metadata returned with paginated responses
 */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Generic wrapper for paginated API responses
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

// ============================================================================
// Status Enums
// ============================================================================

/**
 * Status values for purchase orders
 */
export type PurchaseOrderStatus = 'DRAFT' | 'SENT' | 'FULFILLED';

/**
 * Status values for invoices
 */
export type InvoiceStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * Status values for accounting system synchronization
 */
export type SyncStatus = 'PENDING' | 'SYNCED' | 'FAILED';

// ============================================================================
// Core Entities
// ============================================================================

/**
 * Vendor entity representing a supplier
 */
export interface Vendor {
  id: number;
  name: string;
  contact: string | null;
  items?: Item[];
}

/**
 * Item entity representing a purchasable product or service
 */
export interface Item {
  id: number;
  name: string;
  item_code: string | null;
  price: number;
  vendorId: number;
  vendor?: Vendor;
}

/**
 * Historical record of item price changes
 */
export interface ItemPriceHistory {
  id: number;
  itemId: number;
  price: number;
  date: string;
}

/**
 * Line item within a purchase order
 */
export interface PurchaseOrderItem {
  id: number;
  purchaseOrderId: number;
  itemId: number;
  quantity: number;
  price: number;
  item?: Item;
}

/**
 * Purchase order entity
 */
export interface PurchaseOrder {
  id: number;
  vendorId: number;
  date: string;
  status: PurchaseOrderStatus;
  vendor?: Vendor;
  items?: PurchaseOrderItem[];
  invoices?: Invoice[];
  attachments?: EntityFileAttachment[];
}

/**
 * Line item within an invoice
 */
export interface InvoiceItem {
  id: number;
  invoiceId: number;
  itemId: number;
  quantity: number;
  price: number;
  item?: Item;
}

/**
 * User entity (minimal representation for invoice relationships)
 */
export interface User {
  id: number;
  name: string;
  email: string;
}

/**
 * Branch entity for organizational hierarchy
 */
export interface Branch {
  id: number;
  name: string;
}

/**
 * Department entity for organizational hierarchy
 */
export interface Department {
  id: number;
  name: string;
}

/**
 * Cost center entity for financial tracking
 */
export interface CostCenter {
  id: number;
  name: string;
}

/**
 * Invoice entity representing a billing document
 */
export interface Invoice {
  id: number;
  date: string;
  status: InvoiceStatus;
  totalAmount: number;
  userId: number;
  project: string | null;
  accountingId: string | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  purchaseOrderId: number | null;
  branchId: number | null;
  departmentId: number | null;
  costCenterId: number | null;
  items?: InvoiceItem[];
  user?: User;
  branch?: Branch | null;
  department?: Department | null;
  costCenter?: CostCenter | null;
  purchaseOrder?: PurchaseOrder | null;
  attachments?: EntityFileAttachment[];
}

// ============================================================================
// Analytics Types
// ============================================================================

/**
 * Summary totals for analytics dashboard
 */
export interface AnalyticsTotals {
  invoices: number;
  vendors: number;
  items: number;
  purchaseOrders: number;
  spending: number;
  averageInvoiceAmount: number;
}

/**
 * Count of entities grouped by status
 */
export interface StatusCount {
  status: string;
  count: number;
}

/**
 * Full analytics response including totals and status breakdowns
 */
export interface AnalyticsResponse {
  totals: AnalyticsTotals;
  invoiceStatusCounts: StatusCount[];
  poStatusCounts: StatusCount[];
}

/**
 * Data point for spending breakdown charts
 */
export interface SpendingData {
  name: string;
  value: number;
}

/**
 * Response for spending breakdown endpoint
 */
export interface SpendingResponse {
  groupBy: string;
  data: SpendingData[];
}

/**
 * Data point for spending trend charts
 */
export interface TrendData {
  name: string;
  amount: number;
}

/**
 * Response for spending trends endpoint
 */
export interface TrendResponse {
  period: string;
  data: TrendData[];
}

/**
 * Data point for item price change analysis
 */
export interface PriceChangeData {
  name: string;
  vendor: string;
  oldPrice: number;
  newPrice: number;
  change: number;
  percentageChange: number;
  date: string;
}

/**
 * Response for price changes endpoint with pagination
 */
export interface PriceChangeResponse {
  data: PriceChangeData[];
  pagination: PaginationMeta;
}

// ============================================================================
// Filter Types
// ============================================================================

/**
 * Comparison operators for advanced filtering
 */
export interface FilterOperators {
  eq?: string | number;
  ne?: string | number;
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
  like?: string;
  in?: (string | number)[];
}

/**
 * Filter parameters for vendor queries
 */
export interface VendorFilters {
  id?: number;
  name?: string;
  operators?: {
    id?: FilterOperators;
    name?: FilterOperators;
  };
}

/**
 * Filter parameters for item queries
 */
export interface ItemFilters {
  vendorId?: number;
  vendorName?: string;
  operators?: {
    vendorId?: FilterOperators;
    vendorName?: FilterOperators;
    price?: FilterOperators;
  };
}

/**
 * Filter parameters for purchase order queries
 */
export interface PurchaseOrderFilters {
  vendorId?: number;
  status?: PurchaseOrderStatus;
  startDate?: string;
  endDate?: string;
}

/**
 * Filter parameters for invoice queries
 */
export interface InvoiceFilters {
  status?: InvoiceStatus;
  vendorId?: number;
  startDate?: string;
  endDate?: string;
  project?: string;
  branchId?: number;
  departmentId?: number;
  costCenterId?: number;
  syncStatus?: SyncStatus;
}

// ============================================================================
// Input Types (Create/Update)
// ============================================================================

/**
 * Input for creating a new vendor
 */
export interface CreateVendorInput {
  name: string;
  contact?: string | null;
}

/**
 * Input for updating an existing vendor
 */
export interface UpdateVendorInput {
  name?: string;
  contact?: string | null;
}

/**
 * Input for creating a new item
 * Note: item_code is optional
 */
export interface CreateItemInput {
  name: string;
  price: number;
  vendorId: number;
  item_code?: string;
}

/**
 * Input for updating an existing item
 */
export interface UpdateItemInput {
  name?: string;
  item_code?: string;
  price?: number;
  vendorId?: number;
}

/**
 * Line item input for purchase order creation/update
 */
export interface PurchaseOrderItemInput {
  itemId: number;
  quantity: number;
  price: number;
}

/**
 * Input for creating a new purchase order
 * Note: date is optional as backend sets it automatically
 */
export interface CreatePurchaseOrderInput {
  vendorId: number;
  items: PurchaseOrderItemInput[];
}

/**
 * Input for updating an existing purchase order
 */
export interface UpdatePurchaseOrderInput {
  vendorId?: number;
  items?: PurchaseOrderItemInput[];
}

/**
 * Line item input for invoice creation/update
 */
export interface InvoiceItemInput {
  itemId: number;
  quantity: number;
  price: number;
}

/**
 * Input for creating a new invoice
 * Note: date is optional as backend sets it automatically
 */
export interface CreateInvoiceInput {
  items: InvoiceItemInput[];
  project?: string;
  purchaseOrderId?: number;
  branchId?: number;
  departmentId?: number;
  costCenterId?: number;
}

/**
 * Input for updating an existing invoice
 */
export interface UpdateInvoiceInput {
  items?: InvoiceItemInput[];
  project?: string | null;
  purchaseOrderId?: number | null;
  branchId?: number | null;
  departmentId?: number | null;
  costCenterId?: number | null;
}

// ============================================================================
// File Attachment Types
// ============================================================================

/**
 * Virus scan status for uploaded files
 */
export type VirusScanStatus = 'PENDING' | 'SCANNING' | 'CLEAN' | 'INFECTED' | 'FAILED';

/**
 * Entity types that can have file attachments
 */
export type AttachableEntityType = 'INVOICE' | 'PURCHASE_ORDER' | 'DELIVERY_NOTE' | 'VENDOR';

/**
 * File attachment entity
 */
export interface FileAttachment {
  id: number;
  s3Key: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  checksum: string;
  uploadedBy: number;
  uploadedAt: string;
  virusScanStatus: VirusScanStatus;
  virusScanResult: string | null;
  version: number;
  previousVersionId: number | null;
  uploadedByUser?: User;
  previousVersion?: FileAttachment | null;
  attachments?: EntityFileAttachment[];
}

/**
 * Junction table entity linking files to entities
 */
export interface EntityFileAttachment {
  id: number;
  fileId: number;
  entityType: AttachableEntityType;
  entityId: number;
  attachedAt: string;
  attachedBy: number;
  file?: FileAttachment;
  attachedByUser?: User;
}

/**
 * Input for initiating file upload (get presigned URL)
 */
export interface InitiateUploadInput {
  filename: string;
  mimeType: string;
  fileSize: number;
  checksum: string;
}

/**
 * Response from initiate upload endpoint
 */
export interface InitiateUploadResponse {
  uploadId: string;
  uploadUrl: string;
  s3Key: string;
}

/**
 * Input for confirming upload completion
 */
export interface ConfirmUploadInput {
  uploadId: string;
}

/**
 * Input for attaching file to entity
 */
export interface AttachFileInput {
  fileId: number;
  entityType: AttachableEntityType;
  entityId: number;
}

/**
 * Input for detaching file from entity
 */
export interface DetachFileInput {
  attachmentId: number;
}

/**
 * Response for file download (presigned URL)
 */
export interface DownloadFileResponse {
  downloadUrl: string;
  filename: string;
  expiresIn: number;
}

/**
 * Filter parameters for file queries
 */
export interface FileFilters {
  entityType?: AttachableEntityType;
  entityId?: number;
  virusScanStatus?: VirusScanStatus;
  uploadedBy?: number;
}

// ============================================================================
// Delivery Note Types
// ============================================================================

/**
 * Status values for delivery notes
 */
export type DeliveryNoteStatus = 'DRAFT' | 'CONFIRMED';

/**
 * Condition of delivered items
 */
export type ItemCondition = 'GOOD' | 'DAMAGED' | 'PARTIAL';

/**
 * Line item within a delivery note
 */
export interface DeliveryNoteItem {
  id: number;
  deliveryNoteId: number;
  itemId: number;
  quantityOrdered: number;
  quantityDelivered: number;
  condition: ItemCondition;
  discrepancyReason: string | null;
  item?: Item;
}

/**
 * Delivery note entity
 */
export interface DeliveryNote {
  id: number;
  purchaseOrderId: number;
  deliveryDate: string;
  receivedBy: string;
  status: DeliveryNoteStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  purchaseOrder?: PurchaseOrder;
  items?: DeliveryNoteItem[];
  invoices?: Invoice[];
  attachments?: EntityFileAttachment[];
}

/**
 * Input for creating a delivery note item
 */
export interface CreateDeliveryNoteItemInput {
  itemId: number;
  quantityOrdered: number;
  quantityDelivered: number;
  condition: ItemCondition;
  discrepancyReason?: string | null;
}

/**
 * Input for creating a new delivery note
 */
export interface CreateDeliveryNoteInput {
  purchaseOrderId: number;
  deliveryDate: string;
  receivedBy: string;
  notes?: string | null;
  items: CreateDeliveryNoteItemInput[];
}

/**
 * Input for updating an existing delivery note
 */
export interface UpdateDeliveryNoteInput {
  deliveryDate?: string;
  receivedBy?: string;
  notes?: string | null;
  items?: CreateDeliveryNoteItemInput[];
}

/**
 * Filter parameters for delivery note queries
 */
export interface DeliveryNoteFilters {
  purchaseOrderId?: number;
  status?: DeliveryNoteStatus;
  startDate?: string;
  endDate?: string;
  vendorId?: number;
}
