import { Prisma, ValidationStatus, ValidationSeverity } from '@prisma/client';
import prisma from '../prisma';
import pubsub, { PubSubService } from './pubsub';
import { ValidationOrchestrator } from '../domain/validation/services/ValidationOrchestrator';
import { DuplicateDetector } from '../domain/validation/services/DuplicateDetector';
import { SuspiciousDetector } from '../domain/validation/services/SuspiciousDetector';
import { ValidationRuleCache } from '../domain/validation/services/ValidationRuleCache';
import { PrismaInvoiceRepository } from '../infrastructure/persistence/prisma/repositories/PrismaInvoiceRepository';
import { PrismaValidationRuleRepository } from '../infrastructure/persistence/prisma/repositories/PrismaValidationRuleRepository';
import { PrismaInvoiceValidationRepository } from '../infrastructure/persistence/prisma/repositories/PrismaInvoiceValidationRepository';

/**
 * Validate an invoice using all enabled rules
 */
export const validateInvoice = async (invoiceId: number) => {
  // Create repository instances
  const invoiceRepository = new PrismaInvoiceRepository(prisma);
  const validationRuleRepository = new PrismaValidationRuleRepository(prisma);
  const invoiceValidationRepository = new PrismaInvoiceValidationRepository(prisma);

  // Create cache and detectors with repository dependencies
  const ruleCache = new ValidationRuleCache(validationRuleRepository);
  const duplicateDetector = new DuplicateDetector(invoiceRepository);
  const suspiciousDetector = new SuspiciousDetector(ruleCache);

  // Create orchestrator with all dependencies
  const orchestrator = new ValidationOrchestrator(
    duplicateDetector,
    suspiciousDetector,
    invoiceRepository,
    invoiceValidationRepository
  );

  const summary = await orchestrator.validateInvoice(invoiceId);

  // Publish events based on results
  pubsub.publish(PubSubService.INVOICE_VALIDATED, { invoiceId, summary });

  if (summary.hasBlockingIssues) {
    pubsub.publish(PubSubService.DUPLICATE_DETECTED, { invoiceId });
  }

  if (summary.flagCount > 0 && !summary.hasBlockingIssues) {
    pubsub.publish(PubSubService.SUSPICIOUS_DETECTED, { invoiceId, flagCount: summary.flagCount });
  }

  return summary;
};

/**
 * Get validation summary for an invoice
 */
export const getValidationSummary = async (invoiceId: number) => {
  const validations = await prisma.invoiceValidation.findMany({
    where: { invoiceId },
    include: {
      override: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      }
    },
    orderBy: [
      { severity: 'desc' },
      { createdAt: 'desc' }
    ]
  });

  const hasBlockingIssues = validations.some(
    v => v.severity === ValidationSeverity.CRITICAL && v.status === ValidationStatus.FLAGGED
  );

  return {
    invoiceId,
    flagCount: validations.length,
    hasBlockingIssues,
    validations
  };
};

/**
 * Get flagged invoices with filters and pagination
 */
export const getFlaggedInvoices = async (
  filters: {
    severity?: ValidationSeverity;
    status?: ValidationStatus;
    startDate?: string;
    endDate?: string;
  } = {},
  pagination: { page?: number; limit?: number } = {}
) => {
  const { severity, status, startDate, endDate } = filters;
  const page = pagination.page ? parseInt(String(pagination.page)) : 1;
  const limit = pagination.limit ? parseInt(String(pagination.limit)) : 20;
  const skip = (page - 1) * limit;

  const where: Prisma.InvoiceValidationWhereInput = {};

  if (severity) where.severity = severity;
  if (status) where.status = status;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  // Optimized query: Use select instead of deep include to avoid N+1
  const [validations, total] = await prisma.$transaction([
    prisma.invoiceValidation.findMany({
      where,
      select: {
        id: true,
        invoiceId: true,
        ruleType: true,
        severity: true,
        status: true,
        details: true,
        metadata: true,
        createdAt: true,
        reviewedAt: true,
        reviewedBy: true,
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            status: true,
            date: true,
            vendorId: true,
            userId: true
          }
        },
        override: {
          select: {
            id: true,
            reason: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.invoiceValidation.count({ where })
  ]);

  // If we need invoice items, fetch them separately with batching
  // This reduces queries from N+1 to just 2 additional queries
  const invoiceIds = validations.map(v => v.invoice.id);

  if (invoiceIds.length > 0) {
    // Batch fetch all invoice items for these invoices
    const invoiceItems = await prisma.invoiceItem.findMany({
      where: { invoiceId: { in: invoiceIds } },
      select: {
        invoiceId: true,
        itemId: true,
        quantity: true,
        price: true,
        item: {
          select: {
            id: true,
            name: true,
            vendorId: true
          }
        }
      }
    });

    // Group items by invoice ID
    const itemsByInvoice = invoiceItems.reduce((acc, item) => {
      if (!acc[item.invoiceId]) acc[item.invoiceId] = [];
      acc[item.invoiceId].push(item);
      return acc;
    }, {} as Record<number, typeof invoiceItems>);

    // Merge items back into validations
    validations.forEach(validation => {
      (validation.invoice as any).items = itemsByInvoice[validation.invoice.id] || [];
    });
  }

  return {
    data: validations,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
};

/**
 * Override a validation with a reason
 * Security: Implements ownership validation and role-based access control
 */
export const overrideValidation = async (
  validationId: number,
  userId: number,
  reason: string
) => {
  if (reason.length < 10) {
    throw new Error('Override reason must be at least 10 characters');
  }

  return prisma.$transaction(async (tx) => {
    // 1. Fetch validation with invoice ownership
    const validation = await tx.invoiceValidation.findUnique({
      where: { id: validationId },
      include: {
        invoice: {
          select: {
            id: true,
            userId: true,
            status: true
          }
        }
      }
    });

    if (!validation) {
      throw new Error('Validation not found');
    }

    // 2. Fetch user with role
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, name: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // 3. Authorization checks
    const isOwner = validation.invoice.userId === userId;
    const isAdmin = user.role === 'ADMIN';
    const isManager = user.role === 'MANAGER';

    // Check if user has permission to override this validation
    if (!isOwner && !isManager && !isAdmin) {
      throw new Error(
        'Unauthorized: You can only override validations for your own invoices or have manager/admin role'
      );
    }

    // 4. Check if validation already overridden
    if (validation.status === ValidationStatus.OVERRIDDEN) {
      throw new Error('Validation already overridden');
    }

    // 5. Check if invoice is already approved/paid (cannot override)
    if (['APPROVED', 'PAID'].includes(validation.invoice.status)) {
      throw new Error('Cannot override validation for approved/paid invoice');
    }

    // 6. Update validation status
    const updatedValidation = await tx.invoiceValidation.update({
      where: { id: validationId },
      data: {
        status: ValidationStatus.OVERRIDDEN,
        reviewedAt: new Date(),
        reviewedBy: userId
      }
    });

    // 7. Create override record
    const override = await tx.validationOverride.create({
      data: {
        validationId,
        userId,
        reason
      }
    });

    // 8. Create comprehensive audit log
    await tx.auditLog.create({
      data: {
        userId,
        action: 'VALIDATION_OVERRIDDEN',
        entity: 'InvoiceValidation',
        entityId: validationId,
        changes: JSON.stringify({
          reason,
          validationId,
          invoiceId: validation.invoiceId,
          ruleType: validation.ruleType,
          severity: validation.severity,
          isOwner,
          userRole: user.role,
          userName: user.name
        })
      }
    });

    // 9. Publish event
    pubsub.publish(PubSubService.VALIDATION_OVERRIDDEN, {
      validationId,
      userId,
      invoiceId: validation.invoiceId
    });

    return { validation: updatedValidation, override };
  });
};

/**
 * Review a validation (dismiss or escalate)
 */
export const reviewValidation = async (
  validationId: number,
  userId: number,
  action: 'DISMISS' | 'ESCALATE'
) => {
  const newStatus = action === 'DISMISS' ? ValidationStatus.DISMISSED : ValidationStatus.REVIEWED;

  const validation = await prisma.invoiceValidation.update({
    where: { id: validationId },
    data: {
      status: newStatus,
      reviewedAt: new Date(),
      reviewedBy: userId
    }
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: `VALIDATION_${action}ED`,
      entity: 'InvoiceValidation',
      entityId: validationId,
      changes: JSON.stringify({ action, newStatus })
    }
  });

  return validation;
};

/**
 * Get all validation rules
 */
export const getValidationRules = async () => {
  return prisma.validationRule.findMany({
    orderBy: { ruleType: 'asc' }
  });
};

/**
 * Update validation rule configuration
 */
export const updateValidationRule = async (
  ruleId: number,
  data: {
    enabled?: boolean;
    severity?: ValidationSeverity;
    config?: Record<string, unknown>;
  }
) => {
  const validationRuleRepository = new PrismaValidationRuleRepository(prisma);
  const rule = await validationRuleRepository.update(ruleId, data);

  // Note: Cache invalidation is handled at the application layer
  // Each validation creates its own cache instance

  return rule;
};

/**
 * Get dashboard statistics
 */
export const getDashboardStats = async () => {
  const [totalFlagged, bySeverity, byStatus, recentFlags] = await Promise.all([
    prisma.invoiceValidation.count({
      where: { status: ValidationStatus.FLAGGED }
    }),

    prisma.invoiceValidation.groupBy({
      by: ['severity'],
      where: { status: ValidationStatus.FLAGGED },
      _count: true
    }),

    prisma.invoiceValidation.groupBy({
      by: ['status'],
      _count: true
    }),

    prisma.invoiceValidation.findMany({
      where: { status: ValidationStatus.FLAGGED },
      include: {
        invoice: {
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
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })
  ]);

  return {
    totalFlagged,
    bySeverity,
    byStatus,
    recentFlags
  };
};
