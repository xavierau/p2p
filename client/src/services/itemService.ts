import api from '@/lib/api';
import type {
  Item,
  ItemPriceHistory,
  PaginatedResponse,
  PaginationParams,
  ItemFilters,
  CreateItemInput,
  UpdateItemInput,
} from '@/types';

// Re-export types for convenience
export type { Item };

// Helper to build query params
const buildQueryParams = (
  filters?: ItemFilters,
  pagination?: PaginationParams
): string => {
  const params = new URLSearchParams();

  if (filters?.vendorId) params.append('vendorId', String(filters.vendorId));
  if (filters?.vendorName) params.append('vendorName', filters.vendorName);
  if (pagination?.page) params.append('page', String(pagination.page));
  if (pagination?.limit) params.append('limit', String(pagination.limit));

  return params.toString();
};

const getItems = async (
  filters?: ItemFilters,
  pagination?: PaginationParams
): Promise<PaginatedResponse<Item>> => {
  const queryString = buildQueryParams(filters, pagination);
  const response = await api.get(`/items${queryString ? `?${queryString}` : ''}`);
  return response.data;
};

const getItemById = async (id: number): Promise<Item & { priceHistory: ItemPriceHistory[] }> => {
  const response = await api.get(`/items/${id}`);
  return response.data;
};

const getPriceHistory = async (
  itemId: number,
  pagination?: PaginationParams
): Promise<PaginatedResponse<ItemPriceHistory>> => {
  const params = new URLSearchParams();
  if (pagination?.page) params.append('page', String(pagination.page));
  if (pagination?.limit) params.append('limit', String(pagination.limit));

  const queryString = params.toString();
  const response = await api.get(`/items/${itemId}/price-history${queryString ? `?${queryString}` : ''}`);
  return response.data;
};

const createItem = async (data: CreateItemInput): Promise<Item> => {
  const response = await api.post('/items', data);
  return response.data;
};

const updateItem = async (id: number, data: UpdateItemInput): Promise<Item> => {
  const response = await api.put(`/items/${id}`, data);
  return response.data;
};

const deleteItem = async (id: number): Promise<void> => {
  await api.delete(`/items/${id}`);
};

export const itemService = {
  getItems,
  getItemById,
  getPriceHistory,
  createItem,
  updateItem,
  deleteItem,
};
