import api from '@/lib/api';
import type {
  Vendor,
  PaginatedResponse,
  PaginationParams,
  VendorFilters,
  CreateVendorInput,
  UpdateVendorInput,
} from '@/types';

// Re-export types for convenience
export type { Vendor };

// Helper to build query params
const buildQueryParams = (
  filters?: VendorFilters,
  pagination?: PaginationParams
): string => {
  const params = new URLSearchParams();

  if (filters?.id) params.append('id', String(filters.id));
  if (filters?.name) params.append('name', filters.name);
  if (pagination?.page) params.append('page', String(pagination.page));
  if (pagination?.limit) params.append('limit', String(pagination.limit));

  return params.toString();
};

const getVendors = async (
  filters?: VendorFilters,
  pagination?: PaginationParams
): Promise<PaginatedResponse<Vendor>> => {
  const queryString = buildQueryParams(filters, pagination);
  const response = await api.get(`/vendors${queryString ? `?${queryString}` : ''}`);
  return response.data;
};

const getVendorById = async (id: number): Promise<Vendor> => {
  const response = await api.get(`/vendors/${id}`);
  return response.data;
};

const createVendor = async (data: CreateVendorInput): Promise<Vendor> => {
  const response = await api.post('/vendors', data);
  return response.data;
};

const updateVendor = async (id: number, data: UpdateVendorInput): Promise<Vendor> => {
  const response = await api.put(`/vendors/${id}`, data);
  return response.data;
};

const deleteVendor = async (id: number): Promise<void> => {
  await api.delete(`/vendors/${id}`);
};

export const vendorService = {
  getVendors,
  getVendorById,
  createVendor,
  updateVendor,
  deleteVendor,
};
