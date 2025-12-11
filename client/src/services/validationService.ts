import api from '@/lib/api';
import type {
  InvoiceValidation,
  ValidationRule,
  InvoiceValidationSummary,
  ValidationDashboardStats,
  FlaggedInvoicesFilters,
  OverrideValidationInput,
  ReviewValidationInput,
  UpdateValidationRuleInput,
  PaginatedResponse,
} from '@/types';

/**
 * Build query parameters for flagged invoices
 */
const buildFlaggedInvoicesQuery = (filters: FlaggedInvoicesFilters): string => {
  const params = new URLSearchParams();

  if (filters.severity) params.append('severity', filters.severity);
  if (filters.status) params.append('status', filters.status);
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  if (filters.page) params.append('page', String(filters.page));
  if (filters.limit) params.append('limit', String(filters.limit));

  return params.toString();
};

/**
 * Get list of flagged invoices with filters
 */
const getFlaggedInvoices = async (
  filters: FlaggedInvoicesFilters = {}
): Promise<PaginatedResponse<InvoiceValidation>> => {
  const queryString = buildFlaggedInvoicesQuery(filters);
  const response = await api.get(`/validations/flagged${queryString ? `?${queryString}` : ''}`);
  return response.data;
};

/**
 * Get validation summary for a specific invoice
 */
const getValidationSummary = async (invoiceId: number): Promise<InvoiceValidationSummary> => {
  const response = await api.get(`/validations/invoices/${invoiceId}`);
  return response.data;
};

/**
 * Override a validation issue with a reason
 */
const overrideValidation = async (
  validationId: number,
  input: OverrideValidationInput
): Promise<{ validation: InvoiceValidation; override: unknown }> => {
  const response = await api.post(`/validations/${validationId}/override`, input);
  return response.data;
};

/**
 * Review a validation issue (dismiss or escalate)
 */
const reviewValidation = async (
  validationId: number,
  input: ReviewValidationInput
): Promise<InvoiceValidation> => {
  const response = await api.put(`/validations/${validationId}/review`, input);
  return response.data;
};

/**
 * Trigger revalidation of an invoice
 */
const revalidateInvoice = async (invoiceId: number): Promise<InvoiceValidationSummary> => {
  const response = await api.post(`/validations/invoices/${invoiceId}/revalidate`);
  return response.data;
};

/**
 * Get all validation rules
 */
const getValidationRules = async (): Promise<ValidationRule[]> => {
  const response = await api.get('/validations/rules');
  return response.data;
};

/**
 * Update a validation rule configuration
 */
const updateValidationRule = async (
  ruleId: number,
  input: UpdateValidationRuleInput
): Promise<ValidationRule> => {
  const response = await api.patch(`/validations/rules/${ruleId}`, input);
  return response.data;
};

/**
 * Get dashboard statistics
 */
const getDashboardStats = async (): Promise<ValidationDashboardStats> => {
  const response = await api.get('/validations/dashboard/stats');
  return response.data;
};

export const validationService = {
  getFlaggedInvoices,
  getValidationSummary,
  overrideValidation,
  reviewValidation,
  revalidateInvoice,
  getValidationRules,
  updateValidationRule,
  getDashboardStats,
};
