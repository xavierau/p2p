import prisma from '../prisma';
import { Prisma } from '@prisma/client';
import {
    GetItemsFiltersSchema,
    GetItemsFiltersInput,
    PaginationSchema,
    PaginationInput,
    parsePagination,
    CreateItemSchema,
    CreateItemInput,
    UpdateItemSchema,
    UpdateItemInput,
} from '../schemas';

export const getItems = async (
    filters: GetItemsFiltersInput,
    pagination: PaginationInput
) => {
    const validatedFilters = GetItemsFiltersSchema.parse(filters);
    const validatedPagination = PaginationSchema.parse(pagination);

    const { vendorId, vendorName, vendorIdOperator, vendorNameOperator } = validatedFilters;

    const { page: pageNum, limit: limitNum, skip } = parsePagination(validatedPagination);

    const where: Prisma.ItemWhereInput = { deletedAt: null };

    if (vendorId) {
        if (vendorIdOperator === '=') {
            where.vendorId = parseInt(vendorId);
        }
    }

    if (vendorName) {
        if (vendorNameOperator === '=') {
            where.vendor = {
                name: vendorName
            };
        } else if (vendorNameOperator === 'contains') {
            where.vendor = {
                name: {
                    contains: vendorName,
                    mode: 'insensitive' as const
                }
            };
        }
    }

    // Run count and findMany in parallel within a transaction for consistency and performance
    const [total, items] = await prisma.$transaction([
        prisma.item.count({ where }),
        prisma.item.findMany({
            where,
            include: { vendor: true },
            skip,
            take: limitNum,
            orderBy: {
                id: 'asc'
            }
        }),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return {
        data: items,
        pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages,
            hasNext: pageNum < totalPages,
            hasPrevious: pageNum > 1
        }
    };
};

export const createItem = async (itemData: CreateItemInput) => {
    const validatedItemData = CreateItemSchema.parse(itemData);
    const { name, price, vendorId } = validatedItemData;

    // Use transaction for atomicity - create item and initial price history together
    return prisma.$transaction(async (tx) => {
        const newItem = await tx.item.create({
            data: { name, price, vendorId },
        });

        // Record initial price in history
        await tx.itemPriceHistory.create({
            data: {
                itemId: newItem.id,
                price: price,
            }
        });

        return newItem;
    });
};

export const getItemById = async (id: number) => {
    return prisma.item.findFirst({
        where: { id, deletedAt: null },
        include: {
            vendor: true,
            priceHistory: { orderBy: { date: 'desc' }, take: 10 }
        },
    });
};

export const updateItem = async (id: number, data: UpdateItemInput) => {
    const validated = UpdateItemSchema.parse(data);

    const existing = await prisma.item.findFirst({
        where: { id, deletedAt: null }
    });
    if (!existing) return null;

    // Use transaction when price changes to update item and record history atomically
    if (validated.price !== undefined && validated.price !== existing.price) {
        return prisma.$transaction(async (tx) => {
            // Record old price in history before updating
            await tx.itemPriceHistory.create({
                data: {
                    itemId: id,
                    price: existing.price,
                }
            });

            return tx.item.update({
                where: { id },
                data: validated,
                include: { vendor: true },
            });
        });
    }

    return prisma.item.update({
        where: { id },
        data: validated,
        include: { vendor: true },
    });
};

export const deleteItem = async (id: number) => {
    const existing = await prisma.item.findFirst({
        where: { id, deletedAt: null }
    });
    if (!existing) return null;

    return prisma.item.update({
        where: { id },
        data: { deletedAt: new Date() },
    });
};

export const getItemPriceHistory = async (
    itemId: number,
    pagination: PaginationInput
) => {
    const validated = PaginationSchema.parse(pagination);
    const { page: pageNum, limit: limitNum, skip } = parsePagination(validated);

    // Run count and findMany in parallel within a transaction for consistency and performance
    const [total, history] = await prisma.$transaction([
        prisma.itemPriceHistory.count({ where: { itemId } }),
        prisma.itemPriceHistory.findMany({
            where: { itemId },
            orderBy: { date: 'desc' },
            skip,
            take: limitNum,
        }),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return {
        data: history,
        pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages,
            hasNext: pageNum < totalPages,
            hasPrevious: pageNum > 1
        }
    };
};
