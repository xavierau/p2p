import api from '@/lib/api';
import type {
  Invoice,
  InvoiceStatus,
  PaginatedResponse,
  PaginationParams,
  InvoiceFilters,
  CreateInvoiceInput,
  UpdateInvoiceInput,
} from '@/types';

// Re-export types for convenience
export type { Invoice, InvoiceStatus };

// Helper to build query params
const buildQueryParams = (
  filters?: InvoiceFilters,
  pagination?: PaginationParams
): string => {
  const params = new URLSearchParams();

  if (filters?.status) params.append('status', filters.status);
  if (filters?.vendorId) params.append('vendorId', String(filters.vendorId));
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  if (filters?.project) params.append('project', filters.project);
  if (filters?.branchId) params.append('branchId', String(filters.branchId));
  if (filters?.departmentId) params.append('departmentId', String(filters.departmentId));
  if (filters?.costCenterId) params.append('costCenterId', String(filters.costCenterId));
  if (filters?.syncStatus) params.append('syncStatus', filters.syncStatus);
  if (pagination?.page) params.append('page', String(pagination.page));
  if (pagination?.limit) params.append('limit', String(pagination.limit));

  return params.toString();
};

const getInvoices = async (
  filters?: InvoiceFilters,
  pagination?: PaginationParams
): Promise<PaginatedResponse<Invoice>> => {
  const queryString = buildQueryParams(filters, pagination);
  const response = await api.get(`/invoices${queryString ? `?${queryString}` : ''}`);
  return response.data;
};

const getInvoiceById = async (id: number): Promise<Invoice> => {
  const response = await api.get(`/invoices/${id}`);
  return response.data;
};

const createInvoice = async (data: CreateInvoiceInput): Promise<Invoice> => {
  const response = await api.post('/invoices', data);
  return response.data;
};

const updateInvoice = async (id: number, data: UpdateInvoiceInput): Promise<Invoice> => {
  const response = await api.put(`/invoices/${id}`, data);
  return response.data;
};

const approveInvoice = async (id: number): Promise<Invoice> => {
  const response = await api.put(`/invoices/${id}/approve`);
  return response.data;
};

const rejectInvoice = async (id: number): Promise<Invoice> => {
  const response = await api.put(`/invoices/${id}/reject`);
  return response.data;
};

const deleteInvoice = async (id: number): Promise<void> => {
  await api.delete(`/invoices/${id}`);
};

// Legacy method for backward compatibility
const updateInvoiceStatus = async (id: number, status: 'approve' | 'reject'): Promise<Invoice> => {
  const response = await api.put(`/invoices/${id}/${status}`);
  return response.data;
};

export const invoiceService = {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  approveInvoice,
  rejectInvoice,
  deleteInvoice,
  updateInvoiceStatus,
};
