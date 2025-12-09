import prisma from '../prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { getOrSet, generateCacheKey, CacheTTL } from './cacheService';

const AnalyticsFiltersSchema = z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    period: z.enum(['weekly', 'monthly', 'quarterly']).optional(),
}).partial();

const SpendingFiltersSchema = z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    groupBy: z.enum(['vendor', 'item', 'department', 'branch']).optional(),
}).partial();

const TrendFiltersSchema = z.object({
    period: z.enum(['weekly', 'monthly', 'quarterly']).optional(),
    periods: z.number().int().min(1).max(52).optional(),
}).partial();

const PaginationSchema = z.object({
    page: z.string().default('1'),
    limit: z.string().default('20'),
}).partial();

// Main analytics endpoint - dashboard totals
export const getAnalytics = async (filters: z.infer<typeof AnalyticsFiltersSchema> = {}) => {
    const validated = AnalyticsFiltersSchema.parse(filters);
    const { startDate, endDate } = validated;

    const cacheKey = generateCacheKey('analytics:dashboard', { startDate, endDate });

    return getOrSet(cacheKey, CacheTTL.ANALYTICS_DASHBOARD, async () => {
        const dateFilter: any = {};
        if (startDate) dateFilter.gte = new Date(startDate);
        if (endDate) dateFilter.lte = new Date(endDate);

        const whereInvoice: any = { deletedAt: null };
        const wherePO: any = { deletedAt: null };
        const whereVendor: any = { deletedAt: null };
        const whereItem: any = { deletedAt: null };

        if (Object.keys(dateFilter).length > 0) {
            whereInvoice.date = dateFilter;
            wherePO.date = dateFilter;
        }

        // Basic counts
        const [
            totalInvoices,
            totalVendors,
            totalItems,
            totalPurchaseOrders,
            invoiceStatusCounts,
            poStatusCounts,
        ] = await Promise.all([
            prisma.invoice.count({ where: whereInvoice }),
            prisma.vendor.count({ where: whereVendor }),
            prisma.item.count({ where: whereItem }),
            prisma.purchaseOrder.count({ where: wherePO }),
            prisma.invoice.groupBy({
                by: ['status'],
                where: whereInvoice,
                _count: { status: true },
            }),
            prisma.purchaseOrder.groupBy({
                by: ['status'],
                where: wherePO,
                _count: { status: true },
            }),
        ]);

        // Total spending (approved invoices only)
        const totalSpending = await prisma.invoice.aggregate({
            where: { ...whereInvoice, status: 'APPROVED' },
            _sum: { totalAmount: true },
        });

        // Average invoice amount
        const avgInvoice = await prisma.invoice.aggregate({
            where: whereInvoice,
            _avg: { totalAmount: true },
        });

        return {
            totals: {
                invoices: totalInvoices,
                vendors: totalVendors,
                items: totalItems,
                purchaseOrders: totalPurchaseOrders,
                spending: totalSpending._sum.totalAmount || 0,
                averageInvoiceAmount: avgInvoice._avg.totalAmount || 0,
            },
            invoiceStatusCounts: invoiceStatusCounts.map(s => ({
                status: s.status,
                count: s._count.status,
            })),
            poStatusCounts: poStatusCounts.map(s => ({
                status: s.status,
                count: s._count.status,
            })),
        };
    });
};

// Type definitions for raw SQL query results
interface SpendingByVendorResult {
    vendorId: number;
    vendorName: string;
    total: Prisma.Decimal;
}

interface SpendingByItemResult {
    itemId: number;
    itemName: string;
    total: Prisma.Decimal;
}

interface SpendingByDepartmentResult {
    departmentId: number | null;
    departmentName: string | null;
    total: Prisma.Decimal;
}

interface SpendingByBranchResult {
    branchId: number | null;
    branchName: string | null;
    total: Prisma.Decimal;
}

// Spending breakdown by vendor/item/department/branch
export const getSpendingAnalytics = async (filters: z.infer<typeof SpendingFiltersSchema> = {}) => {
    const validated = SpendingFiltersSchema.parse(filters);
    const { startDate, endDate, groupBy = 'vendor' } = validated;

    const cacheKey = generateCacheKey('analytics:spending', { groupBy, startDate, endDate });

    return getOrSet(cacheKey, CacheTTL.ANALYTICS_SPENDING, async () => {
        // Build date filter conditions for raw SQL
        const startDateValue = startDate ? new Date(startDate) : null;
        const endDateValue = endDate ? new Date(endDate) : null;

        let spending: { name: string; value: number }[] = [];

        switch (groupBy) {
            case 'vendor': {
                const results = await prisma.$queryRaw<SpendingByVendorResult[]>`
                    SELECT
                        v.id as "vendorId",
                        v.name as "vendorName",
                        COALESCE(SUM(ii.price * ii.quantity), 0) as total
                    FROM "Invoice" i
                    JOIN "InvoiceItem" ii ON ii."invoiceId" = i.id
                    JOIN "Item" it ON it.id = ii."itemId"
                    JOIN "Vendor" v ON v.id = it."vendorId"
                    WHERE i."deletedAt" IS NULL
                      AND i.status = 'APPROVED'
                      ${startDateValue ? Prisma.sql`AND i.date >= ${startDateValue}` : Prisma.empty}
                      ${endDateValue ? Prisma.sql`AND i.date <= ${endDateValue}` : Prisma.empty}
                    GROUP BY v.id, v.name
                    ORDER BY total DESC
                `;
                spending = results.map(r => ({ name: r.vendorName, value: Number(r.total) }));
                break;
            }
            case 'item': {
                const results = await prisma.$queryRaw<SpendingByItemResult[]>`
                    SELECT
                        it.id as "itemId",
                        it.name as "itemName",
                        COALESCE(SUM(ii.price * ii.quantity), 0) as total
                    FROM "Invoice" i
                    JOIN "InvoiceItem" ii ON ii."invoiceId" = i.id
                    JOIN "Item" it ON it.id = ii."itemId"
                    WHERE i."deletedAt" IS NULL
                      AND i.status = 'APPROVED'
                      ${startDateValue ? Prisma.sql`AND i.date >= ${startDateValue}` : Prisma.empty}
                      ${endDateValue ? Prisma.sql`AND i.date <= ${endDateValue}` : Prisma.empty}
                    GROUP BY it.id, it.name
                    ORDER BY total DESC
                `;
                spending = results.map(r => ({ name: r.itemName, value: Number(r.total) }));
                break;
            }
            case 'department': {
                const results = await prisma.$queryRaw<SpendingByDepartmentResult[]>`
                    SELECT
                        d.id as "departmentId",
                        COALESCE(d.name, 'Unassigned') as "departmentName",
                        COALESCE(SUM(ii.price * ii.quantity), 0) as total
                    FROM "Invoice" i
                    JOIN "InvoiceItem" ii ON ii."invoiceId" = i.id
                    LEFT JOIN "Department" d ON d.id = i."departmentId"
                    WHERE i."deletedAt" IS NULL
                      AND i.status = 'APPROVED'
                      ${startDateValue ? Prisma.sql`AND i.date >= ${startDateValue}` : Prisma.empty}
                      ${endDateValue ? Prisma.sql`AND i.date <= ${endDateValue}` : Prisma.empty}
                    GROUP BY d.id, d.name
                    ORDER BY total DESC
                `;
                spending = results.map(r => ({ name: r.departmentName || 'Unassigned', value: Number(r.total) }));
                break;
            }
            case 'branch': {
                const results = await prisma.$queryRaw<SpendingByBranchResult[]>`
                    SELECT
                        b.id as "branchId",
                        COALESCE(b.name, 'Unassigned') as "branchName",
                        COALESCE(SUM(ii.price * ii.quantity), 0) as total
                    FROM "Invoice" i
                    JOIN "InvoiceItem" ii ON ii."invoiceId" = i.id
                    LEFT JOIN "Branch" b ON b.id = i."branchId"
                    WHERE i."deletedAt" IS NULL
                      AND i.status = 'APPROVED'
                      ${startDateValue ? Prisma.sql`AND i.date >= ${startDateValue}` : Prisma.empty}
                      ${endDateValue ? Prisma.sql`AND i.date <= ${endDateValue}` : Prisma.empty}
                    GROUP BY b.id, b.name
                    ORDER BY total DESC
                `;
                spending = results.map(r => ({ name: r.branchName || 'Unassigned', value: Number(r.total) }));
                break;
            }
            default: {
                // Fallback to vendor grouping
                const results = await prisma.$queryRaw<SpendingByVendorResult[]>`
                    SELECT
                        v.id as "vendorId",
                        v.name as "vendorName",
                        COALESCE(SUM(ii.price * ii.quantity), 0) as total
                    FROM "Invoice" i
                    JOIN "InvoiceItem" ii ON ii."invoiceId" = i.id
                    JOIN "Item" it ON it.id = ii."itemId"
                    JOIN "Vendor" v ON v.id = it."vendorId"
                    WHERE i."deletedAt" IS NULL
                      AND i.status = 'APPROVED'
                      ${startDateValue ? Prisma.sql`AND i.date >= ${startDateValue}` : Prisma.empty}
                      ${endDateValue ? Prisma.sql`AND i.date <= ${endDateValue}` : Prisma.empty}
                    GROUP BY v.id, v.name
                    ORDER BY total DESC
                `;
                spending = results.map(r => ({ name: r.vendorName, value: Number(r.total) }));
            }
        }

        return {
            groupBy,
            data: spending,
        };
    });
};

// Invoice amount trends over time
export const getTrendAnalytics = async (filters: z.infer<typeof TrendFiltersSchema> = {}) => {
    const validated = TrendFiltersSchema.parse(filters);
    const { period = 'monthly', periods = 12 } = validated;

    const cacheKey = generateCacheKey('analytics:trends', { period, periods });

    return getOrSet(cacheKey, CacheTTL.ANALYTICS_TRENDS, async () => {
        const now = new Date();

        // Calculate period intervals
        let intervalMs: number;
        let formatFn: (date: Date, index: number) => string;

        switch (period) {
            case 'weekly':
                intervalMs = 7 * 24 * 60 * 60 * 1000;
                formatFn = (_, i) => `Week ${periods - i}`;
                break;
            case 'quarterly':
                intervalMs = 91 * 24 * 60 * 60 * 1000; // ~3 months
                formatFn = (date) => `Q${Math.ceil((date.getMonth() + 1) / 3)} ${date.getFullYear()}`;
                break;
            case 'monthly':
            default:
                intervalMs = 30 * 24 * 60 * 60 * 1000;
                formatFn = (date) => date.toLocaleString('default', { month: 'short', year: '2-digit' });
        }

        // Build all period queries upfront
        const periodQueries: { index: number; periodStart: Date; periodEnd: Date }[] = [];
        for (let i = periods - 1; i >= 0; i--) {
            const periodEnd = new Date(now.getTime() - (i * intervalMs));
            const periodStart = new Date(periodEnd.getTime() - intervalMs);
            periodQueries.push({ index: i, periodStart, periodEnd });
        }

        // Execute ALL queries in parallel with Promise.all
        const aggregateResults = await Promise.all(
            periodQueries.map(({ periodStart, periodEnd }) =>
                prisma.invoice.aggregate({
                    where: {
                        deletedAt: null,
                        status: 'APPROVED',
                        date: {
                            gte: periodStart,
                            lt: periodEnd,
                        },
                    },
                    _sum: { totalAmount: true },
                })
            )
        );

        // Map results maintaining original order
        const results = periodQueries.map(({ periodStart, index }, arrayIndex) => ({
            name: formatFn(periodStart, index),
            amount: aggregateResults[arrayIndex]._sum.totalAmount || 0,
        }));

        return {
            period,
            data: results,
        };
    });
};

// Price change analytics
export const getPriceChangeAnalytics = async (pagination: z.infer<typeof PaginationSchema>) => {
    const validated = PaginationSchema.parse(pagination);
    const pageNum = Math.max(1, parseInt(validated.page || '1'));
    const limitNum = Math.min(100, Math.max(1, parseInt(validated.limit || '20')));
    const skip = (pageNum - 1) * limitNum;

    const cacheKey = generateCacheKey('analytics:priceChanges', { page: pageNum, limit: limitNum });

    return getOrSet(cacheKey, CacheTTL.ANALYTICS_PRICE_CHANGES, async () => {
        // Get recent price history entries with item and vendor info
        const total = await prisma.itemPriceHistory.count();

        // 1. Fetch price history with item and vendor in single query
        const priceHistory = await prisma.itemPriceHistory.findMany({
            orderBy: { date: 'desc' },
            skip,
            take: limitNum,
            include: {
                item: {
                    include: { vendor: true }
                }
            }
        });

        if (priceHistory.length === 0) {
            return {
                data: [],
                pagination: {
                    total,
                    page: pageNum,
                    limit: limitNum,
                    totalPages: Math.ceil(total / limitNum),
                    hasNext: false,
                    hasPrevious: pageNum > 1,
                },
            };
        }

        // 2. Get unique item IDs from the fetched history
        const itemIds = [...new Set(priceHistory.map(h => h.itemId))];

        // 3. Find the oldest date in our result set for efficient querying
        const oldestDate = priceHistory[priceHistory.length - 1].date;

        // 4. Batch fetch ALL newer entries for these items in ONE query
        const allNewerEntries = await prisma.itemPriceHistory.findMany({
            where: {
                itemId: { in: itemIds },
                date: { gt: oldestDate },
            },
            orderBy: [{ itemId: 'asc' }, { date: 'asc' }],
        });

        // 5. Group by itemId for O(1) lookup using Map
        const newerEntriesByItem = new Map<number, typeof allNewerEntries>();
        for (const entry of allNewerEntries) {
            const existing = newerEntriesByItem.get(entry.itemId) || [];
            existing.push(entry);
            newerEntriesByItem.set(entry.itemId, existing);
        }

        // 6. Calculate changes without additional queries
        const priceChanges = priceHistory.map((entry) => {
            const newerEntries = newerEntriesByItem.get(entry.itemId) || [];
            // Find the first entry newer than current entry's date
            const newerEntry = newerEntries.find(e => e.date > entry.date);

            const newPrice = newerEntry ? newerEntry.price : entry.item.price;
            const oldPrice = entry.price;
            const change = newPrice - oldPrice;
            const percentageChange = oldPrice !== 0 ? (change / oldPrice) * 100 : 0;

            return {
                name: entry.item.name,
                vendor: entry.item.vendor.name,
                oldPrice,
                newPrice,
                change,
                percentageChange: Math.round(percentageChange * 100) / 100,
                date: entry.date.toISOString().split('T')[0],
            };
        });

        const totalPages = Math.ceil(total / limitNum);

        return {
            data: priceChanges,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages,
                hasNext: pageNum < totalPages,
                hasPrevious: pageNum > 1,
            },
        };
    });
};
