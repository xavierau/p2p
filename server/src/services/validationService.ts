import prisma from '../prisma';

export class EntityNotFoundError extends Error {
  public readonly entity: string;
  public readonly entityId: number;

  constructor(entity: string, id: number) {
    super(`${entity} with id ${id} not found`);
    this.name = 'EntityNotFoundError';
    this.entity = entity;
    this.entityId = id;
  }
}

export class EntitiesNotFoundError extends Error {
  public readonly entity: string;
  public readonly entityIds: number[];

  constructor(entity: string, ids: number[]) {
    super(`${entity}(s) with ids [${ids.join(', ')}] not found`);
    this.name = 'EntitiesNotFoundError';
    this.entity = entity;
    this.entityIds = ids;
  }
}

export const validateVendorExists = async (vendorId: number): Promise<void> => {
  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, deletedAt: null },
  });
  if (!vendor) {
    throw new EntityNotFoundError('Vendor', vendorId);
  }
};

export const validateItemExists = async (itemId: number): Promise<void> => {
  const item = await prisma.item.findFirst({
    where: { id: itemId, deletedAt: null },
  });
  if (!item) {
    throw new EntityNotFoundError('Item', itemId);
  }
};

export const validateItemsExist = async (itemIds: number[]): Promise<void> => {
  const items = await prisma.item.findMany({
    where: {
      id: { in: itemIds },
      deletedAt: null,
    },
    select: { id: true },
  });

  const foundIds = new Set(items.map((item) => item.id));
  const missingIds = itemIds.filter((id) => !foundIds.has(id));

  if (missingIds.length > 0) {
    throw new EntitiesNotFoundError('Item', missingIds);
  }
};

export const validateBranchExists = async (branchId: number): Promise<void> => {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
  });
  if (!branch) {
    throw new EntityNotFoundError('Branch', branchId);
  }
};

export const validateDepartmentExists = async (departmentId: number): Promise<void> => {
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
  });
  if (!department) {
    throw new EntityNotFoundError('Department', departmentId);
  }
};

export const validateCostCenterExists = async (costCenterId: number): Promise<void> => {
  const costCenter = await prisma.costCenter.findUnique({
    where: { id: costCenterId },
  });
  if (!costCenter) {
    throw new EntityNotFoundError('CostCenter', costCenterId);
  }
};

export const validatePurchaseOrderExists = async (purchaseOrderId: number): Promise<void> => {
  const purchaseOrder = await prisma.purchaseOrder.findFirst({
    where: { id: purchaseOrderId, deletedAt: null },
  });
  if (!purchaseOrder) {
    throw new EntityNotFoundError('PurchaseOrder', purchaseOrderId);
  }
};

export const validateInvoiceExists = async (invoiceId: number): Promise<void> => {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, deletedAt: null },
  });
  if (!invoice) {
    throw new EntityNotFoundError('Invoice', invoiceId);
  }
};

export const validateUserExists = async (userId: number): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user) {
    throw new EntityNotFoundError('User', userId);
  }
};
