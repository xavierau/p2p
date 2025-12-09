import api from '@/lib/api';
import type {
  PurchaseOrder,
  PurchaseOrderStatus,
  PaginatedResponse,
  PaginationParams,
  PurchaseOrderFilters,
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
} from '@/types';

// Re-export types for convenience
export type { PurchaseOrder, PurchaseOrderStatus };

/**
 * Builds URLSearchParams from filters and pagination options.
 * Filters out undefined values to keep the query string clean.
 */
const buildQueryParams = (
  filters?: PurchaseOrderFilters,
  pagination?: PaginationParams
): URLSearchParams => {
  const params = new URLSearchParams();

  if (filters) {
    if (filters.vendorId !== undefined) {
      params.append('vendorId', String(filters.vendorId));
    }
    if (filters.status) {
      params.append('status', filters.status);
    }
    if (filters.startDate) {
      params.append('startDate', filters.startDate);
    }
    if (filters.endDate) {
      params.append('endDate', filters.endDate);
    }
  }

  if (pagination) {
    if (pagination.page !== undefined) {
      params.append('page', String(pagination.page));
    }
    if (pagination.limit !== undefined) {
      params.append('limit', String(pagination.limit));
    }
  }

  return params;
};

/**
 * Fetches a paginated list of purchase orders with optional filtering.
 */
const getPurchaseOrders = async (
  filters?: PurchaseOrderFilters,
  pagination?: PaginationParams
): Promise<PaginatedResponse<PurchaseOrder>> => {
  const params = buildQueryParams(filters, pagination);
  const queryString = params.toString();
  const url = queryString ? `/purchase-orders?${queryString}` : '/purchase-orders';

  const response = await api.get<PaginatedResponse<PurchaseOrder>>(url);
  return response.data;
};

/**
 * Fetches a single purchase order by ID, including vendor, items, and linked invoices.
 */
const getPurchaseOrderById = async (id: number): Promise<PurchaseOrder> => {
  const response = await api.get<PurchaseOrder>(`/purchase-orders/${id}`);
  return response.data;
};

/**
 * Creates a new purchase order with the specified vendor and items.
 */
const createPurchaseOrder = async (
  data: CreatePurchaseOrderInput
): Promise<PurchaseOrder> => {
  const response = await api.post<PurchaseOrder>('/purchase-orders', data);
  return response.data;
};

/**
 * Updates an existing purchase order. Only allowed for DRAFT status orders.
 */
const updatePurchaseOrder = async (
  id: number,
  data: UpdatePurchaseOrderInput
): Promise<PurchaseOrder> => {
  const response = await api.put<PurchaseOrder>(`/purchase-orders/${id}`, data);
  return response.data;
};

/**
 * Updates the status of a purchase order.
 * Valid transitions: DRAFT -> SENT, SENT -> FULFILLED or DRAFT
 */
const updateStatus = async (
  id: number,
  status: PurchaseOrderStatus
): Promise<PurchaseOrder> => {
  const response = await api.put<PurchaseOrder>(`/purchase-orders/${id}/status`, {
    status,
  });
  return response.data;
};

/**
 * Soft-deletes a purchase order by ID.
 */
const deletePurchaseOrder = async (id: number): Promise<void> => {
  await api.delete(`/purchase-orders/${id}`);
};

export const purchaseOrderService = {
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrder,
  updateStatus,
  deletePurchaseOrder,
};
