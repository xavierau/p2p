import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { validateParams } from '../middleware/validateParams';
import { Permission } from '../constants/permissions';
import { IdParamSchema } from '../utils/validation';
import { AuthRequest } from '../types/auth';
import * as invoiceService from '../services/invoiceService';
import { logger } from '../utils/logger';
import {
  GetInvoicesFiltersInput,
  PaginationInput,
  InvoiceStatus,
  SyncStatus,
} from '../schemas';

const router = express.Router();

router.use(authenticateToken);

router.get('/', authorize(Permission.INVOICE_READ), async (req, res) => {
  const {
    status,
    vendorId,
    startDate,
    endDate,
    project,
    branchId,
    departmentId,
    costCenterId,
    syncStatus,
    page = '1',
    limit = '10',
  } = req.query;

  const filters: GetInvoicesFiltersInput = {
    status: status as InvoiceStatus | undefined,
    vendorId: vendorId as string | undefined,
    startDate: startDate as string | undefined,
    endDate: endDate as string | undefined,
    project: project as string | undefined,
    branchId: branchId as string | undefined,
    departmentId: departmentId as string | undefined,
    costCenterId: costCenterId as string | undefined,
    syncStatus: syncStatus as SyncStatus | undefined,
  };
  const pagination: PaginationInput = {
    page: page as string,
    limit: limit as string,
  };

  try {
    const result = await invoiceService.getInvoices(filters, pagination);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve invoices' });
  }
});

router.get(
  '/:id',
  authorize(Permission.INVOICE_READ),
  validateParams(IdParamSchema),
  async (req, res) => {
    const { id } = req.params;
    try {
      const invoice = await invoiceService.getInvoiceById(Number(id));
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve invoice' });
    }
  }
);

router.post('/', authorize(Permission.INVOICE_CREATE), async (req: AuthRequest, res) => {
  const { items, project, branchId, departmentId, costCenterId } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'User authentication required' });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items are required' });
  }

  try {
    const invoice = await invoiceService.createInvoice(
      { items, project, branchId, departmentId, costCenterId },
      userId
    );
    res.status(201).json(invoice);
  } catch (error) {
    logger.error({ err: error }, 'Failed to create invoice');
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

router.put(
  '/:id/approve',
  authorize(Permission.INVOICE_APPROVE),
  validateParams(IdParamSchema),
  async (req, res) => {
    const { id } = req.params;
    try {
      const invoice = await invoiceService.approveInvoice(Number(id));
      res.json(invoice);
    } catch (error) {
      logger.error({ err: error, invoiceId: id }, 'Failed to approve invoice');
      res.status(500).json({ error: 'Failed to approve invoice' });
    }
  }
);

router.put(
  '/:id/reject',
  authorize(Permission.INVOICE_REJECT),
  validateParams(IdParamSchema),
  async (req, res) => {
    const { id } = req.params;
    try {
      const invoice = await invoiceService.rejectInvoice(Number(id));
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: 'Failed to reject invoice' });
    }
  }
);

router.put(
  '/:id',
  authorize(Permission.INVOICE_UPDATE),
  validateParams(IdParamSchema),
  async (req, res) => {
    const { id } = req.params;
    const { items, project, branchId, departmentId, costCenterId, purchaseOrderId } = req.body;
    try {
      const invoice = await invoiceService.updateInvoice(Number(id), {
        items,
        project,
        branchId,
        departmentId,
        costCenterId,
        purchaseOrderId,
      });
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      res.json(invoice);
    } catch (error) {
      if (error instanceof Error && error.message?.includes('only update')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to update invoice' });
    }
  }
);

router.delete(
  '/:id',
  authorize(Permission.INVOICE_DELETE),
  validateParams(IdParamSchema),
  async (req, res) => {
    const { id } = req.params;
    try {
      const invoice = await invoiceService.deleteInvoice(Number(id));
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete invoice' });
    }
  }
);

export default router;
