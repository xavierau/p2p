import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getDepartments = async (pagination: { page: string, limit: string }) => {
    const { page, limit } = pagination;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const departments = await prisma.department.findMany({
        skip: offset,
        take: parseInt(limit),
    });
    const total = await prisma.department.count();
    return { data: departments, total };
};

export const getBranches = async (pagination: { page: string, limit: string }) => {
    const { page, limit } = pagination;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const branches = await prisma.branch.findMany({
        skip: offset,
        take: parseInt(limit),
    });
    const total = await prisma.branch.count();
    return { data: branches, total };
};

export const getCostCenters = async (pagination: { page: string, limit: string }) => {
    const { page, limit } = pagination;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const costCenters = await prisma.costCenter.findMany({
        skip: offset,
        take: parseInt(limit),
    });
    const total = await prisma.costCenter.count();
    return { data: costCenters, total };
};
