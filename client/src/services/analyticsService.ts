import api from '@/lib/api';

// Enums and type aliases for query parameters
export type TrendPeriod = 'weekly' | 'monthly' | 'quarterly';
export type SpendingGroupBy = 'vendor' | 'item' | 'department' | 'branch';

// Response types for analytics endpoints
export interface AnalyticsTotals {
  invoices: number;
  vendors: number;
  items: number;
  purchaseOrders: number;
  spending: number;
  averageInvoiceAmount: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface AnalyticsResponse {
  totals: AnalyticsTotals;
  invoiceStatusCounts: StatusCount[];
  poStatusCounts: StatusCount[];
}

export interface SpendingDataPoint {
  name: string;
  value: number;
}

export interface SpendingResponse {
  groupBy: SpendingGroupBy;
  data: SpendingDataPoint[];
}

export interface TrendDataPoint {
  name: string;
  amount: number;
}

export interface TrendsResponse {
  period: TrendPeriod;
  data: TrendDataPoint[];
}

export interface PriceChangeItem {
  name: string;
  vendor: string;
  oldPrice: number;
  newPrice: number;
  change: number;
  percentageChange: number;
  date: string;
}

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface PriceChangesResponse {
  data: PriceChangeItem[];
  pagination: PaginationInfo;
}

// Request parameter interfaces
export interface AnalyticsParams {
  startDate?: string;
  endDate?: string;
  period?: TrendPeriod;
}

export interface SpendingParams {
  startDate?: string;
  endDate?: string;
  groupBy?: SpendingGroupBy;
}

export interface TrendsParams {
  period?: TrendPeriod;
  periods?: number;
}

export interface PriceChangesParams {
  page?: number;
  limit?: number;
}

// Helper function to build query string from parameters
const buildQueryString = (params: Record<string, string | number | undefined>): string => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
};

const getAnalytics = async (params?: AnalyticsParams): Promise<AnalyticsResponse> => {
  const queryString = buildQueryString({
    startDate: params?.startDate,
    endDate: params?.endDate,
    period: params?.period,
  });

  const response = await api.get<AnalyticsResponse>(`/analytics${queryString}`);
  return response.data;
};

const getSpending = async (params?: SpendingParams): Promise<SpendingResponse> => {
  const queryString = buildQueryString({
    startDate: params?.startDate,
    endDate: params?.endDate,
    groupBy: params?.groupBy,
  });

  const response = await api.get<SpendingResponse>(`/analytics/spending${queryString}`);
  return response.data;
};

const getTrends = async (params?: TrendsParams): Promise<TrendsResponse> => {
  const queryString = buildQueryString({
    period: params?.period,
    periods: params?.periods,
  });

  const response = await api.get<TrendsResponse>(`/analytics/trends${queryString}`);
  return response.data;
};

const getPriceChanges = async (params?: PriceChangesParams): Promise<PriceChangesResponse> => {
  const queryString = buildQueryString({
    page: params?.page,
    limit: params?.limit,
  });

  const response = await api.get<PriceChangesResponse>(`/analytics/price-changes${queryString}`);
  return response.data;
};

export const analyticsService = {
  getAnalytics,
  getSpending,
  getTrends,
  getPriceChanges,
};
