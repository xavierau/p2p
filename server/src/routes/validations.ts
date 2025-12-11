import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { asyncHandler } from '../middleware/asyncHandler';
import { Permission } from '../constants/permissions';
import { AuthRequest } from '../types/auth';
import * as validationService from '../services/invoiceValidationService';
import {
  ReviewValidationSchema,
  OverrideValidationSchema,
  GetFlaggedInvoicesFiltersSchema,
  UpdateValidationRuleSchema
} from '../schemas';
import prisma from '../prisma';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/validations/flagged
 * Get list of flagged invoices with filters
 */
router.get(
  '/flagged',
  authorize(Permission.INVOICE_READ),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = GetFlaggedInvoicesFiltersSchema.parse(req.query);
    const { page, limit, ...filters } = parsed;

    const result = await validationService.getFlaggedInvoices(filters, { page, limit });
    res.json(result);
  })
);

/**
 * GET /api/validations/invoices/:invoiceId
 * Get validation summary for a specific invoice
 */
router.get(
  '/invoices/:invoiceId',
  authorize(Permission.INVOICE_READ),
  asyncHandler(async (req: Request, res: Response) => {
    const invoiceId = parseInt(req.params.invoiceId);
    if (isNaN(invoiceId)) {
      return res.status(400).json({ error: 'Invalid invoice ID' });
    }

    const summary = await validationService.getValidationSummary(invoiceId);
    res.json(summary);
  })
);

/**
 * POST /api/validations/:validationId/override
 * Override a validation with a reason (requires manager or admin)
 */
router.post(
  '/:validationId/override',
  authorize(Permission.INVOICE_APPROVE),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const validationId = parseInt(req.params.validationId);
    if (isNaN(validationId)) {
      return res.status(400).json({ error: 'Invalid validation ID' });
    }

    const { reason } = OverrideValidationSchema.parse(req.body);
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await validationService.overrideValidation(
      validationId,
      userId,
      reason
    );

    res.json(result);
  })
);

/**
 * PUT /api/validations/:validationId/review
 * Review a validation (dismiss or escalate)
 */
router.put(
  '/:validationId/review',
  authorize(Permission.INVOICE_READ),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const validationId = parseInt(req.params.validationId);
    if (isNaN(validationId)) {
      return res.status(400).json({ error: 'Invalid validation ID' });
    }

    const { action } = ReviewValidationSchema.parse(req.body);

    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await validationService.reviewValidation(
      validationId,
      userId,
      action
    );

    res.json(result);
  })
);

/**
 * POST /api/validations/invoices/:invoiceId/revalidate
 * Trigger revalidation of an invoice
 */
router.post(
  '/invoices/:invoiceId/revalidate',
  authorize(Permission.INVOICE_APPROVE),
  asyncHandler(async (req: Request, res: Response) => {
    const invoiceId = parseInt(req.params.invoiceId);
    if (isNaN(invoiceId)) {
      return res.status(400).json({ error: 'Invalid invoice ID' });
    }

    // Delete existing validations
    await prisma.invoiceValidation.deleteMany({
      where: { invoiceId }
    });

    // Run validation again
    const result = await validationService.validateInvoice(invoiceId);
    res.json(result);
  })
);

/**
 * GET /api/validations/rules
 * Get all validation rules
 */
router.get(
  '/rules',
  authorize(Permission.INVOICE_READ),
  asyncHandler(async (req: Request, res: Response) => {
    const rules = await validationService.getValidationRules();
    res.json(rules);
  })
);

/**
 * PATCH /api/validations/rules/:ruleId
 * Update validation rule configuration (admin only)
 */
router.patch(
  '/rules/:ruleId',
  authorize(Permission.SETTINGS_UPDATE),
  asyncHandler(async (req: Request, res: Response) => {
    const ruleId = parseInt(req.params.ruleId);
    if (isNaN(ruleId)) {
      return res.status(400).json({ error: 'Invalid rule ID' });
    }

    const data = UpdateValidationRuleSchema.parse(req.body);
    const rule = await validationService.updateValidationRule(ruleId, data);

    res.json(rule);
  })
);

/**
 * GET /api/validations/dashboard/stats
 * Get dashboard statistics for validations
 */
router.get(
  '/dashboard/stats',
  authorize(Permission.INVOICE_READ),
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await validationService.getDashboardStats();
    res.json(stats);
  })
);

export default router;
