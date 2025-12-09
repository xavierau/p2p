import prisma from '../prisma';
import { Prisma } from '@prisma/client';
import pubsub, { PubSubService } from './pubsub';
import { poStatusChanges } from './metricsService';
import {
    PurchaseOrderStatusSchema,
    GetPurchaseOrdersFiltersSchema,
    GetPurchaseOrdersFiltersInput,
    PaginationSchema,
    PaginationInput,
    parsePagination,
    CreatePurchaseOrderSchema,
    CreatePurchaseOrderInput,
    UpdatePurchaseOrderSchema,
    UpdatePurchaseOrderInput,
} from '../schemas';

export const getPurchaseOrders = async (
    filters: GetPurchaseOrdersFiltersInput,
    pagination: PaginationInput
) => {
    const validatedFilters = GetPurchaseOrdersFiltersSchema.parse(filters);
    const validatedPagination = PaginationSchema.parse(pagination);

    const { vendorId, status, startDate, endDate } = validatedFilters;

    const { page: pageNum, limit: limitNum, skip } = parsePagination(validatedPagination);

    const where: Prisma.PurchaseOrderWhereInput = { deletedAt: null };

    if (vendorId) {
        where.vendorId = parseInt(vendorId);
    }

    if (status) {
        where.status = status;
    }

    if (startDate || endDate) {
        const dateFilter: Prisma.DateTimeFilter = {};
        if (startDate) dateFilter.gte = new Date(startDate);
        if (endDate) dateFilter.lte = new Date(endDate);
        where.date = dateFilter;
    }

    // Run count and findMany in parallel within a transaction for consistency and performance
    const [total, purchaseOrders] = await prisma.$transaction([
        prisma.purchaseOrder.count({ where }),
        prisma.purchaseOrder.findMany({
            where,
            include: {
                vendor: true,
                items: {
                    include: {
                        item: true,
                    },
                },
            },
            skip,
            take: limitNum,
            orderBy: {
                date: 'desc',
            },
        }),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return {
        data: purchaseOrders,
        pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages,
            hasNext: pageNum < totalPages,
            hasPrevious: pageNum > 1,
        },
    };
};

export const createPurchaseOrder = async (poData: CreatePurchaseOrderInput) => {
    const validatedPoData = CreatePurchaseOrderSchema.parse(poData);
    const { vendorId, items } = validatedPoData;

    const newPurchaseOrder = await prisma.purchaseOrder.create({
        data: {
            vendorId,
            items: {
                create: items.map((item) => ({
                    itemId: item.itemId,
                    quantity: item.quantity,
                    price: item.price,
                })),
            },
        },
        include: {
            vendor: true,
            items: { include: { item: true } },
        },
    });

    return newPurchaseOrder;
};

export const getPurchaseOrderById = async (id: number) => {
    return prisma.purchaseOrder.findFirst({
        where: { id, deletedAt: null },
        include: {
            vendor: {
                select: { id: true, name: true, contact: true }
            },
            items: {
                select: {
                    id: true,
                    quantity: true,
                    price: true,
                    item: {
                        select: {
                            id: true,
                            name: true,
                            item_code: true,
                            price: true
                        }
                    }
                }
            },
            invoices: {
                where: { deletedAt: null },
                select: { id: true, date: true, status: true, totalAmount: true }
            },
        },
    });
};

export const updatePurchaseOrder = async (
    id: number,
    data: UpdatePurchaseOrderInput
) => {
    const validated = UpdatePurchaseOrderSchema.parse(data);

    const existing = await prisma.purchaseOrder.findFirst({
        where: { id, deletedAt: null }
    });
    if (!existing) return null;

    // Only allow updates if status is DRAFT
    if (existing.status !== 'DRAFT') {
        throw new Error('Can only update purchase orders in DRAFT status');
    }

    // Use transaction for atomicity when updating items
    if (validated.items) {
        const validatedItems = validated.items;
        return prisma.$transaction(async (tx) => {
            // Delete existing items
            await tx.purchaseOrderItem.deleteMany({
                where: { purchaseOrderId: id }
            });

            // Update purchase order and create new items atomically
            return tx.purchaseOrder.update({
                where: { id },
                data: {
                    vendorId: validated.vendorId,
                    items: {
                        create: validatedItems.map(item => ({
                            itemId: item.itemId,
                            quantity: item.quantity,
                            price: item.price,
                        })),
                    },
                },
                include: {
                    vendor: true,
                    items: { include: { item: true } },
                },
            });
        });
    }

    return prisma.purchaseOrder.update({
        where: { id },
        data: { vendorId: validated.vendorId },
        include: {
            vendor: true,
            items: { include: { item: true } },
        },
    });
};

// Valid status transitions
const validTransitions: Record<string, string[]> = {
    'DRAFT': ['SENT'],
    'SENT': ['FULFILLED', 'DRAFT'],
    'FULFILLED': [],  // Terminal state
};

export const updatePurchaseOrderStatus = async (id: number, status: string) => {
    const validatedStatus = PurchaseOrderStatusSchema.parse(status);

    const existing = await prisma.purchaseOrder.findFirst({
        where: { id, deletedAt: null }
    });
    if (!existing) return null;

    if (!validTransitions[existing.status]?.includes(validatedStatus)) {
        throw new Error(`Invalid status transition from ${existing.status} to ${validatedStatus}`);
    }

    const po = await prisma.purchaseOrder.update({
        where: { id },
        data: { status: validatedStatus },
        include: {
            vendor: true,
            items: { include: { item: true } },
        },
    });

    poStatusChanges.inc({
        from_status: existing.status,
        to_status: validatedStatus,
    });

    pubsub.publish(PubSubService.PO_STATUS_CHANGED, {
        id,
        status: validatedStatus,
        previousStatus: existing.status
    });

    return po;
};

export const deletePurchaseOrder = async (id: number) => {
    const existing = await prisma.purchaseOrder.findFirst({
        where: { id, deletedAt: null }
    });
    if (!existing) return null;

    return prisma.purchaseOrder.update({
        where: { id },
        data: { deletedAt: new Date() },
    });
};
