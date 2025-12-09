import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '@/pages/Dashboard';
import { analyticsService } from '@/services/analyticsService';
import type { AnalyticsResponse, SpendingData, TrendData, PriceChangeData } from '@/types';

// Mock the analyticsService module
vi.mock('@/services/analyticsService', () => ({
  analyticsService: {
    getAnalytics: vi.fn(),
    getTrends: vi.fn(),
    getSpending: vi.fn(),
    getPriceChanges: vi.fn(),
  },
}));

// Mock recharts as it requires DOM measurements that jsdom doesn't support
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div data-testid="line" />,
  BarChart: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <div data-testid="bar-chart" onClick={onClick}>{children}</div>
  ),
  Bar: () => <div data-testid="bar" />,
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}));

/**
 * Test wrapper that provides required routing context.
 */
function renderDashboard() {
  return render(
    <BrowserRouter>
      <Dashboard />
    </BrowserRouter>
  );
}

/**
 * Factory function for creating mock analytics response.
 */
function createMockAnalyticsResponse(): AnalyticsResponse {
  return {
    totals: {
      invoices: 150,
      vendors: 25,
      items: 500,
      purchaseOrders: 75,
      spending: 125000,
      averageInvoiceAmount: 833.33,
    },
    invoiceStatusCounts: [
      { status: 'PENDING', count: 30 },
      { status: 'APPROVED', count: 100 },
      { status: 'REJECTED', count: 20 },
    ],
    poStatusCounts: [
      { status: 'DRAFT', count: 10 },
      { status: 'SENT', count: 50 },
      { status: 'FULFILLED', count: 15 },
    ],
  };
}

/**
 * Factory function for creating mock trends data.
 */
function createMockTrendsData(): TrendData[] {
  return [
    { name: 'Jan', amount: 10000 },
    { name: 'Feb', amount: 15000 },
    { name: 'Mar', amount: 12000 },
  ];
}

/**
 * Factory function for creating mock spending data.
 */
function createMockSpendingData(): SpendingData[] {
  return [
    { name: 'Vendor A', value: 50000 },
    { name: 'Vendor B', value: 35000 },
    { name: 'Vendor C', value: 25000 },
  ];
}

/**
 * Factory function for creating mock price changes data.
 */
function createMockPriceChangesData(): PriceChangeData[] {
  return [
    {
      name: 'Item A',
      vendor: 'Vendor A',
      oldPrice: 100,
      newPrice: 110,
      change: 10,
      percentageChange: 0.1,
      date: '2024-01-15T00:00:00.000Z',
    },
    {
      name: 'Item B',
      vendor: 'Vendor B',
      oldPrice: 200,
      newPrice: 180,
      change: -20,
      percentageChange: -0.1,
      date: '2024-01-14T00:00:00.000Z',
    },
  ];
}

/**
 * Helper to setup all mocks with successful responses.
 */
function setupSuccessfulMocks() {
  vi.mocked(analyticsService.getAnalytics).mockResolvedValue(
    createMockAnalyticsResponse()
  );
  vi.mocked(analyticsService.getTrends).mockResolvedValue({
    period: 'monthly',
    data: createMockTrendsData(),
  });
  vi.mocked(analyticsService.getSpending).mockResolvedValue({
    groupBy: 'vendor',
    data: createMockSpendingData(),
  });
  vi.mocked(analyticsService.getPriceChanges).mockResolvedValue({
    data: createMockPriceChangesData(),
    pagination: {
      total: 2,
      page: 1,
      limit: 10,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    },
  });
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('shows loading spinner while fetching data', async () => {
      // Make all API calls hang
      vi.mocked(analyticsService.getAnalytics).mockImplementation(
        () => new Promise(() => {})
      );
      vi.mocked(analyticsService.getTrends).mockImplementation(
        () => new Promise(() => {})
      );
      vi.mocked(analyticsService.getSpending).mockImplementation(
        () => new Promise(() => {})
      );
      vi.mocked(analyticsService.getPriceChanges).mockImplementation(
        () => new Promise(() => {})
      );

      renderDashboard();

      // Dashboard has its own LoadingSpinner component with animate-spin class
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error message when data fetch fails', async () => {
      vi.mocked(analyticsService.getAnalytics).mockRejectedValue(
        new Error('Failed to fetch')
      );
      vi.mocked(analyticsService.getTrends).mockRejectedValue(
        new Error('Failed to fetch')
      );
      vi.mocked(analyticsService.getSpending).mockRejectedValue(
        new Error('Failed to fetch')
      );
      vi.mocked(analyticsService.getPriceChanges).mockRejectedValue(
        new Error('Failed to fetch')
      );

      renderDashboard();

      await waitFor(() => {
        expect(
          screen.getByText(/failed to load dashboard data/i)
        ).toBeInTheDocument();
      });
    });

    it('shows retry button on error', async () => {
      vi.mocked(analyticsService.getAnalytics).mockRejectedValue(
        new Error('Failed to fetch')
      );
      vi.mocked(analyticsService.getTrends).mockRejectedValue(
        new Error('Failed to fetch')
      );
      vi.mocked(analyticsService.getSpending).mockRejectedValue(
        new Error('Failed to fetch')
      );
      vi.mocked(analyticsService.getPriceChanges).mockRejectedValue(
        new Error('Failed to fetch')
      );

      renderDashboard();

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /retry/i })
        ).toBeInTheDocument();
      });
    });

    it('retries data fetch when retry button is clicked', async () => {
      const user = userEvent.setup();

      // First calls fail, subsequent calls succeed
      vi.mocked(analyticsService.getAnalytics)
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce(createMockAnalyticsResponse());
      vi.mocked(analyticsService.getTrends)
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ period: 'monthly', data: createMockTrendsData() });
      vi.mocked(analyticsService.getSpending)
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ groupBy: 'vendor', data: createMockSpendingData() });
      vi.mocked(analyticsService.getPriceChanges)
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({
          data: createMockPriceChangesData(),
          pagination: { total: 2, page: 1, limit: 10, totalPages: 1, hasNext: false, hasPrevious: false },
        });

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      await waitFor(() => {
        expect(analyticsService.getAnalytics).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Data Display', () => {
    it('displays summary cards with correct data', async () => {
      setupSuccessfulMocks();

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Total Invoices')).toBeInTheDocument();
      });

      // Check summary card values
      expect(screen.getByText('150')).toBeInTheDocument(); // Total Invoices
      expect(screen.getByText('25')).toBeInTheDocument(); // Total Vendors
      expect(screen.getByText('$125,000')).toBeInTheDocument(); // Total Spending
      expect(screen.getByText('$833')).toBeInTheDocument(); // Avg Invoice Amount
    });

    it('displays charts when data is available', async () => {
      setupSuccessfulMocks();

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Invoice Amount Trend')).toBeInTheDocument();
      });

      // Check for chart presence via mocked components
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });

    it('displays vendor share and item share sections', async () => {
      setupSuccessfulMocks();

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Vendor Share')).toBeInTheDocument();
        expect(screen.getByText('Item Share (Pareto)')).toBeInTheDocument();
      });
    });

    it('displays price changes table with data', async () => {
      setupSuccessfulMocks();

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Recent Price Changes')).toBeInTheDocument();
      });

      // Check table headers
      expect(screen.getByRole('columnheader', { name: /item/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /vendor/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /date/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /old price/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /new price/i })).toBeInTheDocument();

      // Check price change data
      expect(screen.getByText('Item A')).toBeInTheDocument();
      expect(screen.getByText('Item B')).toBeInTheDocument();
    });

    it('shows empty state messages when no data available', async () => {
      vi.mocked(analyticsService.getAnalytics).mockResolvedValue(
        createMockAnalyticsResponse()
      );
      vi.mocked(analyticsService.getTrends).mockResolvedValue({
        period: 'monthly',
        data: [],
      });
      vi.mocked(analyticsService.getSpending).mockResolvedValue({
        groupBy: 'vendor',
        data: [],
      });
      vi.mocked(analyticsService.getPriceChanges).mockResolvedValue({
        data: [],
        pagination: { total: 0, page: 1, limit: 10, totalPages: 0, hasNext: false, hasPrevious: false },
      });

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText(/no trend data available/i)).toBeInTheDocument();
        expect(screen.getByText(/no vendor data available/i)).toBeInTheDocument();
        expect(screen.getByText(/no item data available/i)).toBeInTheDocument();
        expect(screen.getByText(/no price change data available/i)).toBeInTheDocument();
      });
    });
  });

  describe('Period Selection', () => {
    it('fetches data with selected period', async () => {
      setupSuccessfulMocks();

      renderDashboard();

      await waitFor(() => {
        expect(analyticsService.getTrends).toHaveBeenCalledWith({
          period: 'monthly',
        });
      });
    });
  });

  describe('API Calls', () => {
    it('calls all analytics endpoints on mount', async () => {
      setupSuccessfulMocks();

      renderDashboard();

      await waitFor(() => {
        expect(analyticsService.getAnalytics).toHaveBeenCalledTimes(1);
        expect(analyticsService.getTrends).toHaveBeenCalled();
        expect(analyticsService.getSpending).toHaveBeenCalledWith({ groupBy: 'vendor' });
        expect(analyticsService.getSpending).toHaveBeenCalledWith({ groupBy: 'item' });
        expect(analyticsService.getPriceChanges).toHaveBeenCalledWith({ limit: 10 });
      });
    });
  });
});
