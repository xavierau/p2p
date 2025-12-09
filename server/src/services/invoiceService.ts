import prisma from '../prisma';
import pubsub, { PubSubService } from './pubsub';
import { Prisma } from '@prisma/client';
import {
    invoicesCreated,
    invoicesApproved,
    invoicesRejected,
} from './metricsService';
import {
    createInvoiceSchema,
    CreateInvoiceInput,
    GetInvoicesFiltersSchema,
    GetInvoicesFiltersInput,
    PaginationSchema,
    PaginationInput,
    parsePagination,
    UpdateInvoiceSchema,
    UpdateInvoiceInput,
} from '../schemas';

export const getInvoices = async (
    filters: GetInvoicesFiltersInput,
    pagination: PaginationInput
) => {
    const validatedFilters = GetInvoicesFiltersSchema.parse(filters);
    const validatedPagination = PaginationSchema.parse(pagination);

    const {
        status, vendorId, startDate, endDate,
        project, branchId, departmentId, costCenterId, syncStatus
    } = validatedFilters;

    const { page: pageNum, limit: limitNum, skip } = parsePagination(validatedPagination);

    const where: Prisma.InvoiceWhereInput = { deletedAt: null };

    if (status) where.status = status;
    if (syncStatus) where.syncStatus = syncStatus;
    if (project) where.project = { contains: project, mode: 'insensitive' };
    if (branchId) where.branchId = parseInt(branchId);
    if (departmentId) where.departmentId = parseInt(departmentId);
    if (costCenterId) where.costCenterId = parseInt(costCenterId);

    if (startDate || endDate) {
        const dateFilter: Prisma.DateTimeFilter = {};
        if (startDate) dateFilter.gte = new Date(startDate);
        if (endDate) dateFilter.lte = new Date(endDate);
        where.date = dateFilter;
    }

    // Filter by vendor (through items)
    if (vendorId) {
        where.items = {
            some: {
                item: { vendorId: parseInt(vendorId) }
            }
        };
    }

    // Run count and findMany in parallel within a transaction for consistency and performance
    const [total, invoices] = await prisma.$transaction([
        prisma.invoice.count({ where }),
        prisma.invoice.findMany({
            where,
            include: {
                items: {
                    include: {
                        item: true,
                    },
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            skip,
            take: limitNum,
            orderBy: {
                date: 'desc'
            }
        }),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return {
        data: invoices,
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

export const createInvoice = async (invoiceData: CreateInvoiceInput, userId: number) => {
    const validatedInvoiceData = createInvoiceSchema.parse(invoiceData);
    const { items, project, branchId, departmentId, costCenterId } = validatedInvoiceData;

    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const invoice = await prisma.invoice.create({
        data: {
            totalAmount,
            userId,
            project,
            branchId,
            departmentId,
            costCenterId,
            items: {
                create: items.map((item) => ({
                    itemId: item.itemId,
                    quantity: item.quantity,
                    price: item.price,
                })),
            },
        },
        include: {
            items: true,
        },
    });

    invoicesCreated.inc();

    return invoice;
};

export const approveInvoice = async (invoiceId: number) => {
    const invoice = await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: 'APPROVED' },
        include: {
            items: {
                include: {
                    item: {
                        include: {
                            vendor: true
                        }
                    }
                }
            }
        }
    });

    invoicesApproved.inc();
    pubsub.publish(PubSubService.INVOICE_APPROVED, invoice.id);

    return invoice;
};

export const rejectInvoice = async (invoiceId: number) => {
    const invoice = await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: 'REJECTED' },
    });

    invoicesRejected.inc();

    return invoice;
};

export const getInvoiceById = async (id: number) => {
    return prisma.invoice.findFirst({
        where: { id, deletedAt: null },
        include: {
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
                            price: true,
                            vendor: {
                                select: { id: true, name: true }
                            }
                        }
                    }
                }
            },
            user: {
                select: { id: true, name: true, email: true },
            },
            branch: {
                select: { id: true, name: true }
            },
            department: {
                select: { id: true, name: true }
            },
            costCenter: {
                select: { id: true, name: true }
            },
            purchaseOrder: {
                select: { id: true, status: true, date: true }
            },
        },
    });
};

export const updateInvoice = async (
    id: number,
    data: UpdateInvoiceInput
) => {
    const validated = UpdateInvoiceSchema.parse(data);

    const existing = await prisma.invoice.findFirst({
        where: { id, deletedAt: null }
    });
    if (!existing) return null;

    // Only allow updates if status is PENDING
    if (existing.status !== 'PENDING') {
        throw new Error('Can only update invoices in PENDING status');
    }

    // Use transaction for atomicity when updating items
    if (validated.items) {
        const validatedItems = validated.items;
        const totalAmount = validatedItems.reduce(
            (sum, item) => sum + (item.price * item.quantity),
            0
        );

        return prisma.$transaction(async (tx) => {
            // Delete existing items
            await tx.invoiceItem.deleteMany({
                where: { invoiceId: id }
            });

            // Update invoice and create new items atomically
            return tx.invoice.update({
                where: { id },
                data: {
                    project: validated.project,
                    branchId: validated.branchId,
                    departmentId: validated.departmentId,
                    costCenterId: validated.costCenterId,
                    purchaseOrderId: validated.purchaseOrderId,
                    totalAmount,
                    items: {
                        create: validatedItems.map(item => ({
                            itemId: item.itemId,
                            quantity: item.quantity,
                            price: item.price,
                        })),
                    },
                },
                include: {
                    items: { include: { item: true } },
                },
            });
        });
    }

    return prisma.invoice.update({
        where: { id },
        data: {
            project: validated.project,
            branchId: validated.branchId,
            departmentId: validated.departmentId,
            costCenterId: validated.costCenterId,
            purchaseOrderId: validated.purchaseOrderId,
        },
        include: {
            items: { include: { item: true } },
        },
    });
};

export const deleteInvoice = async (id: number) => {
    const existing = await prisma.invoice.findFirst({
        where: { id, deletedAt: null }
    });
    if (!existing) return null;

    return prisma.invoice.update({
        where: { id },
        data: { deletedAt: new Date() },
    });
};
