import api from '@/lib/api';
import type {
  DeliveryNote,
  DeliveryNoteStatus,
  PaginatedResponse,
  PaginationParams,
  DeliveryNoteFilters,
  CreateDeliveryNoteInput,
  UpdateDeliveryNoteInput,
} from '@/types';

// Re-export types for convenience
export type { DeliveryNote, DeliveryNoteStatus };

/**
 * Builds URLSearchParams from filters and pagination options.
 * Filters out undefined values to keep the query string clean.
 */
const buildQueryParams = (
  filters?: DeliveryNoteFilters,
  pagination?: PaginationParams
): URLSearchParams => {
  const params = new URLSearchParams();

  if (filters) {
    if (filters.purchaseOrderId !== undefined) {
      params.append('purchaseOrderId', String(filters.purchaseOrderId));
    }
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
 * Fetches a paginated list of delivery notes with optional filtering.
 */
const getDeliveryNotes = async (
  filters?: DeliveryNoteFilters,
  pagination?: PaginationParams
): Promise<PaginatedResponse<DeliveryNote>> => {
  const params = buildQueryParams(filters, pagination);
  const queryString = params.toString();
  const url = queryString ? `/delivery-notes?${queryString}` : '/delivery-notes';

  const response = await api.get<PaginatedResponse<DeliveryNote>>(url);
  return response.data;
};

/**
 * Fetches a single delivery note by ID, including all related data.
 */
const getDeliveryNoteById = async (id: number): Promise<DeliveryNote> => {
  const response = await api.get<DeliveryNote>(`/delivery-notes/${id}`);
  return response.data;
};

/**
 * Creates a new delivery note for a purchase order.
 */
const createDeliveryNote = async (
  data: CreateDeliveryNoteInput
): Promise<DeliveryNote> => {
  const response = await api.post<DeliveryNote>('/delivery-notes', data);
  return response.data;
};

/**
 * Updates an existing delivery note. Only allowed for DRAFT status notes.
 */
const updateDeliveryNote = async (
  id: number,
  data: UpdateDeliveryNoteInput
): Promise<DeliveryNote> => {
  const response = await api.put<DeliveryNote>(`/delivery-notes/${id}`, data);
  return response.data;
};

/**
 * Confirms a delivery note, changing status from DRAFT to CONFIRMED.
 */
const confirmDeliveryNote = async (id: number): Promise<DeliveryNote> => {
  const response = await api.put<DeliveryNote>(`/delivery-notes/${id}/confirm`);
  return response.data;
};

/**
 * Soft-deletes a delivery note by ID.
 */
const deleteDeliveryNote = async (id: number): Promise<void> => {
  await api.delete(`/delivery-notes/${id}`);
};

export const deliveryNoteService = {
  getDeliveryNotes,
  getDeliveryNoteById,
  createDeliveryNote,
  updateDeliveryNote,
  confirmDeliveryNote,
  deleteDeliveryNote,
};
