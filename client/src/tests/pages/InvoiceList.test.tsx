import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import InvoiceList from '@/pages/InvoiceList';
import { invoiceService } from '@/services/invoiceService';
import type { Invoice, PaginatedResponse } from '@/types';

// Mock the invoiceService module
vi.mock('@/services/invoiceService', () => ({
  invoiceService: {
    getInvoices: vi.fn(),
    updateInvoiceStatus: vi.fn(),
  },
}));

/**
 * Test wrapper that provides required routing context.
 */
function renderInvoiceList() {
  return render(
    <BrowserRouter>
      <InvoiceList />
    </BrowserRouter>
  );
}

/**
 * Factory function for creating mock invoice data.
 */
function createMockInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 1,
    date: '2024-01-15T00:00:00.000Z',
    status: 'PENDING',
    totalAmount: 1500.0,
    userId: 1,
    project: 'Test Project',
    accountingId: null,
    syncStatus: 'PENDING',
    syncError: null,
    purchaseOrderId: null,
    branchId: null,
    departmentId: null,
    costCenterId: null,
    ...overrides,
  };
}

/**
 * Factory function for creating paginated invoice response.
 */
function createMockPaginatedResponse(
  invoices: Invoice[]
): PaginatedResponse<Invoice> {
  return {
    data: invoices,
    pagination: {
      total: invoices.length,
      page: 1,
      limit: 10,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    },
  };
}

describe('InvoiceList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('shows loading spinner while fetching invoices', async () => {
      // Make the API call hang
      vi.mocked(invoiceService.getInvoices).mockImplementation(
        () => new Promise(() => {})
      );

      renderInvoiceList();

      // Should show loading spinner via role="status"
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error message when fetch fails', async () => {
      vi.mocked(invoiceService.getInvoices).mockRejectedValue(
        new Error('Network error')
      );

      renderInvoiceList();

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });

    it('shows retry button on error', async () => {
      vi.mocked(invoiceService.getInvoices).mockRejectedValue(
        new Error('Network error')
      );

      renderInvoiceList();

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /try again/i })
        ).toBeInTheDocument();
      });
    });

    it('retries fetch when retry button is clicked', async () => {
      const user = userEvent.setup();

      // First call fails, second succeeds
      vi.mocked(invoiceService.getInvoices)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(createMockPaginatedResponse([]));

      renderInvoiceList();

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /try again/i });
      await user.click(retryButton);

      await waitFor(() => {
        expect(invoiceService.getInvoices).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Invoice List Display', () => {
    it('renders invoice list correctly', async () => {
      const mockInvoices = [
        createMockInvoice({ id: 1, totalAmount: 1500.0, status: 'PENDING' }),
        createMockInvoice({ id: 2, totalAmount: 2500.0, status: 'APPROVED' }),
        createMockInvoice({ id: 3, totalAmount: 750.0, status: 'REJECTED' }),
      ];

      vi.mocked(invoiceService.getInvoices).mockResolvedValue(
        createMockPaginatedResponse(mockInvoices)
      );

      renderInvoiceList();

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      // Check table headers
      expect(screen.getByRole('columnheader', { name: /id/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /date/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /amount/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /status/i })).toBeInTheDocument();

      // Check invoice data is displayed
      expect(screen.getByRole('link', { name: '1' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: '2' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: '3' })).toBeInTheDocument();

      // Check amounts are formatted
      expect(screen.getByText('$1500.00')).toBeInTheDocument();
      expect(screen.getByText('$2500.00')).toBeInTheDocument();
      expect(screen.getByText('$750.00')).toBeInTheDocument();

      // Check statuses are displayed
      expect(screen.getByText('PENDING')).toBeInTheDocument();
      expect(screen.getByText('APPROVED')).toBeInTheDocument();
      expect(screen.getByText('REJECTED')).toBeInTheDocument();
    });

    it('shows empty state when no invoices', async () => {
      vi.mocked(invoiceService.getInvoices).mockResolvedValue(
        createMockPaginatedResponse([])
      );

      renderInvoiceList();

      await waitFor(() => {
        expect(screen.getByText(/no invoices found/i)).toBeInTheDocument();
      });
    });

    it('renders Create Invoice button', async () => {
      vi.mocked(invoiceService.getInvoices).mockResolvedValue(
        createMockPaginatedResponse([])
      );

      renderInvoiceList();

      await waitFor(() => {
        expect(
          screen.getByRole('link', { name: /create invoice/i })
        ).toBeInTheDocument();
      });
    });
  });

  describe('Invoice Actions', () => {
    it('shows approve and reject buttons for pending invoices', async () => {
      const mockInvoices = [
        createMockInvoice({ id: 1, status: 'PENDING' }),
      ];

      vi.mocked(invoiceService.getInvoices).mockResolvedValue(
        createMockPaginatedResponse(mockInvoices)
      );

      renderInvoiceList();

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /approve/i })
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /reject/i })
        ).toBeInTheDocument();
      });
    });

    it('does not show approve/reject buttons for approved invoices', async () => {
      const mockInvoices = [
        createMockInvoice({ id: 1, status: 'APPROVED' }),
      ];

      vi.mocked(invoiceService.getInvoices).mockResolvedValue(
        createMockPaginatedResponse(mockInvoices)
      );

      renderInvoiceList();

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
    });

    it('calls updateInvoiceStatus when approve is clicked', async () => {
      const user = userEvent.setup();
      const mockInvoices = [createMockInvoice({ id: 1, status: 'PENDING' })];

      vi.mocked(invoiceService.getInvoices).mockResolvedValue(
        createMockPaginatedResponse(mockInvoices)
      );
      vi.mocked(invoiceService.updateInvoiceStatus).mockResolvedValue(
        createMockInvoice({ id: 1, status: 'APPROVED' })
      );

      renderInvoiceList();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
      });

      const approveButton = screen.getByRole('button', { name: /approve/i });
      await user.click(approveButton);

      await waitFor(() => {
        expect(invoiceService.updateInvoiceStatus).toHaveBeenCalledWith(1, 'approve');
      });
    });

    it('calls updateInvoiceStatus when reject is clicked', async () => {
      const user = userEvent.setup();
      const mockInvoices = [createMockInvoice({ id: 1, status: 'PENDING' })];

      vi.mocked(invoiceService.getInvoices).mockResolvedValue(
        createMockPaginatedResponse(mockInvoices)
      );
      vi.mocked(invoiceService.updateInvoiceStatus).mockResolvedValue(
        createMockInvoice({ id: 1, status: 'REJECTED' })
      );

      renderInvoiceList();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
      });

      const rejectButton = screen.getByRole('button', { name: /reject/i });
      await user.click(rejectButton);

      await waitFor(() => {
        expect(invoiceService.updateInvoiceStatus).toHaveBeenCalledWith(1, 'reject');
      });
    });

    it('refreshes invoice list after status update', async () => {
      const user = userEvent.setup();
      const mockInvoices = [createMockInvoice({ id: 1, status: 'PENDING' })];

      vi.mocked(invoiceService.getInvoices).mockResolvedValue(
        createMockPaginatedResponse(mockInvoices)
      );
      vi.mocked(invoiceService.updateInvoiceStatus).mockResolvedValue(
        createMockInvoice({ id: 1, status: 'APPROVED' })
      );

      renderInvoiceList();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
      });

      // Reset call count after initial fetch
      vi.mocked(invoiceService.getInvoices).mockClear();

      const approveButton = screen.getByRole('button', { name: /approve/i });
      await user.click(approveButton);

      await waitFor(() => {
        // Should refetch after status change
        expect(invoiceService.getInvoices).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Invoice Links', () => {
    it('links to invoice detail page', async () => {
      const mockInvoices = [createMockInvoice({ id: 42 })];

      vi.mocked(invoiceService.getInvoices).mockResolvedValue(
        createMockPaginatedResponse(mockInvoices)
      );

      renderInvoiceList();

      await waitFor(() => {
        const link = screen.getByRole('link', { name: '42' });
        expect(link).toHaveAttribute('href', '/invoices/42');
      });
    });
  });
});
