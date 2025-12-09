import React, { useState, useEffect, useCallback } from 'react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from 'recharts';
import ItemDetails from '@/components/ItemDetails';
import {
    analyticsService,
    type TrendPeriod,
} from '@/services/analyticsService';
import type {
    AnalyticsResponse,
    TrendData,
    SpendingData,
    PriceChangeData,
} from '@/types';

// Loading spinner component
const LoadingSpinner: React.FC = () => (
    <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
);

// Error message component
const ErrorMessage: React.FC<{ message: string; onRetry: () => void }> = ({
    message,
    onRetry,
}) => (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="text-destructive text-lg">{message}</div>
        <button
            onClick={onRetry}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
            Retry
        </button>
    </div>
);

// Summary card component for key metrics
const SummaryCard: React.FC<{
    title: string;
    value: string | number;
    description?: string;
}> = ({ title, value, description }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            {description && (
                <p className="text-xs text-muted-foreground">{description}</p>
            )}
        </CardContent>
    </Card>
);

// Currency formatter
const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

const Dashboard: React.FC = () => {
    // Analytics data state
    const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
    const [trends, setTrends] = useState<TrendData[]>([]);
    const [vendorSpending, setVendorSpending] = useState<SpendingData[]>([]);
    const [itemSpending, setItemSpending] = useState<SpendingData[]>([]);
    const [priceChanges, setPriceChanges] = useState<PriceChangeData[]>([]);

    // UI state
    const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('monthly');
    const [selectedItem, setSelectedItem] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

    // Fetch all dashboard data
    const fetchDashboardData = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const [analyticsRes, trendsRes, vendorRes, itemRes, priceRes] =
                await Promise.all([
                    analyticsService.getAnalytics(),
                    analyticsService.getTrends({ period: trendPeriod }),
                    analyticsService.getSpending({ groupBy: 'vendor' }),
                    analyticsService.getSpending({ groupBy: 'item' }),
                    analyticsService.getPriceChanges({ limit: 10 }),
                ]);

            setAnalytics(analyticsRes);
            setTrends(trendsRes.data);
            setVendorSpending(vendorRes.data);
            setItemSpending(itemRes.data);
            setPriceChanges(priceRes.data);
        } catch (err) {
            setError('Failed to load dashboard data. Please try again.');
            console.error('Dashboard data fetch error:', err);
        } finally {
            setIsLoading(false);
        }
    }, [trendPeriod]);

    // Fetch only trends when period changes (after initial load)
    const fetchTrends = useCallback(async () => {
        // Skip if still in initial loading state
        if (isLoading && !analytics) return;

        try {
            const trendsRes = await analyticsService.getTrends({
                period: trendPeriod,
            });
            setTrends(trendsRes.data);
        } catch (err) {
            console.error('Trends fetch error:', err);
            // Don't set global error for just trends refresh
        }
    }, [trendPeriod, isLoading, analytics]);

    // Initial data fetch
    useEffect(() => {
        fetchDashboardData();
    }, []); // Only run once on mount

    // Fetch trends when period changes (after initial load)
    useEffect(() => {
        if (analytics) {
            fetchTrends();
        }
    }, [trendPeriod]); // Only depend on trendPeriod, not fetchTrends

    const handleTrendPeriodChange = (value: TrendPeriod) => {
        setTrendPeriod(value);
    };

    const handleItemClick = (data: unknown) => {
        const chartData = data as {
            activePayload?: Array<{ payload: { name: string } }>;
        };
        if (chartData?.activePayload?.[0]) {
            setSelectedItem(chartData.activePayload[0].payload.name);
        }
    };

    const handleCloseItemDetails = () => {
        setSelectedItem(null);
    };

    // Sort item spending for Pareto chart (descending by value)
    const sortedItemSpending = [...itemSpending].sort(
        (a, b) => b.value - a.value
    );

    // Show loading state
    if (isLoading) {
        return <LoadingSpinner />;
    }

    // Show error state
    if (error) {
        return <ErrorMessage message={error} onRetry={fetchDashboardData} />;
    }

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            {analytics && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <SummaryCard
                        title="Total Invoices"
                        value={analytics.totals.invoices}
                        description="All invoices in the system"
                    />
                    <SummaryCard
                        title="Total Vendors"
                        value={analytics.totals.vendors}
                        description="Active vendors"
                    />
                    <SummaryCard
                        title="Total Spending"
                        value={formatCurrency(analytics.totals.spending)}
                        description="Total invoice amount"
                    />
                    <SummaryCard
                        title="Avg Invoice Amount"
                        value={formatCurrency(analytics.totals.averageInvoiceAmount)}
                        description="Average per invoice"
                    />
                </div>
            )}

            {/* Invoice Amount Trend Chart */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Invoice Amount Trend
                    </CardTitle>
                    <Select
                        onValueChange={handleTrendPeriodChange}
                        value={trendPeriod}
                    >
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                        </SelectContent>
                    </Select>
                </CardHeader>
                <CardContent>
                    {trends.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={trends}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip
                                    formatter={(value: number) => [
                                        formatCurrency(value),
                                        'Amount',
                                    ]}
                                />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="amount"
                                    stroke="#8884d8"
                                    activeDot={{ r: 8 }}
                                    name="Invoice Amount"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                            No trend data available
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Vendor Share and Item Share Charts */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Vendor Share</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {vendorSpending.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={vendorSpending}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        dataKey="value"
                                        label={({ name, percent }) =>
                                            `${name} (${(percent * 100).toFixed(0)}%)`
                                        }
                                    >
                                        {vendorSpending.map((_, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={COLORS[index % COLORS.length]}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: number) => [
                                            formatCurrency(value),
                                            'Spending',
                                        ]}
                                    />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                                No vendor data available
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Item Share (Pareto)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {sortedItemSpending.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart
                                    data={sortedItemSpending}
                                    onClick={handleItemClick}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip
                                        formatter={(value: number) => [
                                            formatCurrency(value),
                                            'Spending',
                                        ]}
                                    />
                                    <Legend />
                                    <Bar
                                        dataKey="value"
                                        fill="#82ca9d"
                                        name="Item Spending"
                                        cursor="pointer"
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                                No item data available
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Price Changes Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Price Changes</CardTitle>
                </CardHeader>
                <CardContent>
                    {priceChanges.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Item</TableHead>
                                    <TableHead>Vendor</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Old Price</TableHead>
                                    <TableHead className="text-right">New Price</TableHead>
                                    <TableHead className="text-right">Change</TableHead>
                                    <TableHead className="text-right">Percentage</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {priceChanges.map((item, index) => (
                                    <TableRow key={`${item.name}-${item.date}-${index}`}>
                                        <TableCell className="font-medium">
                                            {item.name}
                                        </TableCell>
                                        <TableCell>{item.vendor}</TableCell>
                                        <TableCell>
                                            {new Date(item.date).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {formatCurrency(item.oldPrice)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {formatCurrency(item.newPrice)}
                                        </TableCell>
                                        <TableCell
                                            className={`text-right ${
                                                item.change > 0
                                                    ? 'text-red-500'
                                                    : item.change < 0
                                                    ? 'text-green-500'
                                                    : ''
                                            }`}
                                        >
                                            {item.change > 0 ? '+' : ''}
                                            {formatCurrency(item.change)}
                                        </TableCell>
                                        <TableCell
                                            className={`text-right ${
                                                item.percentageChange > 0
                                                    ? 'text-red-500'
                                                    : item.percentageChange < 0
                                                    ? 'text-green-500'
                                                    : ''
                                            }`}
                                        >
                                            {item.percentageChange > 0 ? '+' : ''}
                                            {(item.percentageChange * 100).toFixed(2)}%
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="flex items-center justify-center h-[100px] text-muted-foreground">
                            No price change data available
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Item Details Modal */}
            {selectedItem && (
                <ItemDetails
                    isOpen={!!selectedItem}
                    onClose={handleCloseItemDetails}
                    itemName={selectedItem}
                />
            )}
        </div>
    );
};

export default Dashboard;
