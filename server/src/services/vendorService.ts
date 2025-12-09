import prisma from '../prisma';
import { Prisma } from '@prisma/client';
import {
    GetVendorsFiltersSchema,
    GetVendorsFiltersInput,
    PaginationSchema,
    PaginationInput,
    parsePagination,
    CreateVendorSchema,
    CreateVendorInput,
    UpdateVendorSchema,
    UpdateVendorInput,
} from '../schemas';

/**
 * Custom error thrown when attempting to delete a vendor that has active items.
 * This enforces referential integrity at the application level.
 */
export class VendorHasActiveItemsError extends Error {
    public readonly vendorId: number;
    public readonly itemCount: number;

    constructor(vendorId: number, itemCount: number) {
        super(`Cannot delete vendor ${vendorId}: has ${itemCount} active items`);
        this.name = 'VendorHasActiveItemsError';
        this.vendorId = vendorId;
        this.itemCount = itemCount;
    }
}

export const getVendors = async (
    filters: GetVendorsFiltersInput,
    pagination: PaginationInput
) => {
    // Validate and parse inputs
    const validatedFilters = GetVendorsFiltersSchema.parse(filters);
    const validatedPagination = PaginationSchema.parse(pagination);

    const { id, name, idOperator, nameOperator } = validatedFilters;

    const { page: pageNum, limit: limitNum, skip } = parsePagination(validatedPagination);

    const whereConditions: Prisma.VendorWhereInput[] = [{ deletedAt: null }];

    if (id) {
        const idNum = parseInt(id);
        if (!isNaN(idNum)) {
            // A simple switch is more scalable than if/else for operators
            switch (idOperator) {
                case '=':
                    whereConditions.push({ id: idNum });
                    break;
                // Future operators like '!=' or '>' can be added here
            }
        }
    }

    if (name) {
        switch (nameOperator) {
            case 'contains':
                whereConditions.push({ name: { contains: name, mode: 'insensitive' as const } });
                break;
            case '=':
            default: // Default to exact match if operator is missing or invalid
                whereConditions.push({ name: name });
                break;
        }
    }

    const where: Prisma.VendorWhereInput = { AND: whereConditions };

    // Run count and findMany in parallel within a transaction for consistency and performance
    const [total, vendors] = await prisma.$transaction([
        prisma.vendor.count({ where }),
        prisma.vendor.findMany({
            where,
            include: { items: { where: { deletedAt: null } } },
            skip,
            take: limitNum,
            orderBy: { id: 'asc' }
        }),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return {
        data: vendors,
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

export const createVendor = async (vendorData: CreateVendorInput) => {
    const validatedVendorData = CreateVendorSchema.parse(vendorData);
    const { name, contact } = validatedVendorData;
    const newVendor = await prisma.vendor.create({
        data: { name, contact },
    });
    return newVendor;
};

export const getVendorById = async (id: number) => {
    return prisma.vendor.findFirst({
        where: { id, deletedAt: null },
        include: {
            items: {
                where: { deletedAt: null },
                select: {
                    id: true,
                    name: true,
                    item_code: true,
                    price: true
                }
            }
        },
    });
};

export const updateVendor = async (id: number, data: UpdateVendorInput) => {
    const validated = UpdateVendorSchema.parse(data);

    const existing = await prisma.vendor.findFirst({
        where: { id, deletedAt: null }
    });
    if (!existing) return null;

    return prisma.vendor.update({
        where: { id },
        data: validated,
        include: { items: { where: { deletedAt: null } } },
    });
};

export const deleteVendor = async (id: number) => {
    const existing = await prisma.vendor.findFirst({
        where: { id, deletedAt: null },
        include: {
            items: {
                where: { deletedAt: null },
                select: { id: true },
            },
        },
    });

    if (!existing) return null;

    // Check for active items - prevent deletion if vendor has active items
    if (existing.items.length > 0) {
        throw new VendorHasActiveItemsError(id, existing.items.length);
    }

    return prisma.vendor.update({
        where: { id },
        data: { deletedAt: new Date() },
    });
};
