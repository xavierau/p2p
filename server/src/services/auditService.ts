import prisma from '../prisma';

/**
 * Actions that can be audited in the system.
 */
export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  SOFT_DELETE = 'SOFT_DELETE',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  STATUS_CHANGE = 'STATUS_CHANGE',
}

/**
 * Input for creating an audit log entry.
 */
interface AuditLogEntry {
  userId?: number;
  action: AuditAction;
  entity: string;
  entityId: number;
  changes?: Record<string, { old: unknown; new: unknown }>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Filters for querying audit logs.
 */
interface AuditLogFilters {
  entity?: string;
  entityId?: number;
  userId?: number;
  action?: AuditAction;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

/**
 * Creates an audit log entry for tracking changes to entities.
 */
export const createAuditLog = async (entry: AuditLogEntry): Promise<void> => {
  await prisma.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      changes: entry.changes ? JSON.stringify(entry.changes) : null,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
    },
  });
};

/**
 * Computes the differences between two objects for the specified fields.
 * Returns null if there are no changes.
 */
export const computeChanges = (
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  fieldsToTrack: string[]
): Record<string, { old: unknown; new: unknown }> | null => {
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  for (const field of fieldsToTrack) {
    const oldValue = oldObj[field];
    const newValue = newObj[field];

    // Deep equality check for objects/arrays
    const oldStr = JSON.stringify(oldValue);
    const newStr = JSON.stringify(newValue);

    if (oldStr !== newStr) {
      changes[field] = { old: oldValue, new: newValue };
    }
  }

  return Object.keys(changes).length > 0 ? changes : null;
};

/**
 * Retrieves audit logs with optional filtering and pagination.
 */
export const getAuditLogs = async (filters: AuditLogFilters) => {
  const { entity, entityId, userId, action, startDate, endDate, page = 1, limit = 20 } = filters;

  const pageNum = Math.max(1, page);
  const limitNum = Math.min(100, Math.max(1, limit));
  const skip = (pageNum - 1) * limitNum;

  const where: Record<string, unknown> = {};

  if (entity) {
    where.entity = entity;
  }
  if (entityId !== undefined) {
    where.entityId = entityId;
  }
  if (userId !== undefined) {
    where.userId = userId;
  }
  if (action) {
    where.action = action;
  }
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      (where.createdAt as Record<string, Date>).gte = startDate;
    }
    if (endDate) {
      (where.createdAt as Record<string, Date>).lte = endDate;
    }
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const totalPages = Math.ceil(total / limitNum);

  return {
    data: logs.map((log) => ({
      ...log,
      changes: log.changes ? JSON.parse(log.changes) : null,
    })),
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

/**
 * Retrieves audit logs for a specific entity.
 */
export const getEntityAuditLogs = async (entity: string, entityId: number) => {
  return getAuditLogs({ entity, entityId });
};
