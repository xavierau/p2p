import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { validateParams } from '../middleware/validateParams';
import { Permission } from '../constants/permissions';
import { IdParamSchema } from '../utils/validation';
import * as purchaseOrderService from '../services/purchaseOrderService';
import {
  GetPurchaseOrdersFiltersInput,
  PaginationInput,
  PurchaseOrderStatus,
} from '../schemas';

const router = express.Router();

router.use(authenticateToken);

router.get('/', authorize(Permission.PO_READ), async (req, res) => {
  const { vendorId, status, startDate, endDate, page = '1', limit = '10' } = req.query;

  const filters: GetPurchaseOrdersFiltersInput = {
    vendorId: vendorId as string | undefined,
    status: status as PurchaseOrderStatus | undefined,
    startDate: startDate as string | undefined,
    endDate: endDate as string | undefined,
  };
  const pagination: PaginationInput = {
    page: page as string,
    limit: limit as string,
  };

  try {
    const result = await purchaseOrderService.getPurchaseOrders(filters, pagination);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve purchase orders' });
  }
});

router.get(
  '/:id',
  authorize(Permission.PO_READ),
  validateParams(IdParamSchema),
  async (req, res) => {
    const { id } = req.params;
    try {
      const po = await purchaseOrderService.getPurchaseOrderById(Number(id));
      if (!po) {
        return res.status(404).json({ error: 'Purchase order not found' });
      }
      res.json(po);
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve purchase order' });
    }
  }
);

router.post('/', authorize(Permission.PO_CREATE), async (req, res) => {
  const { vendorId, items } = req.body;
  if (!vendorId || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing required fields: vendorId, items' });
  }

  try {
    const po = await purchaseOrderService.createPurchaseOrder({ vendorId, items });
    res.status(201).json(po);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create purchase order' });
  }
});

router.put(
  '/:id',
  authorize(Permission.PO_UPDATE),
  validateParams(IdParamSchema),
  async (req, res) => {
    const { id } = req.params;
    const { vendorId, items } = req.body;
    try {
      const po = await purchaseOrderService.updatePurchaseOrder(Number(id), { vendorId, items });
      if (!po) {
        return res.status(404).json({ error: 'Purchase order not found' });
      }
      res.json(po);
    } catch (error) {
      if (error instanceof Error && error.message?.includes('only update')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to update purchase order' });
    }
  }
);

router.put(
  '/:id/status',
  authorize(Permission.PO_STATUS_CHANGE),
  validateParams(IdParamSchema),
  async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Missing required field: status' });
    }

    try {
      const po = await purchaseOrderService.updatePurchaseOrderStatus(Number(id), status);
      if (!po) {
        return res.status(404).json({ error: 'Purchase order not found' });
      }
      res.json(po);
    } catch (error) {
      if (error instanceof Error && error.message?.includes('Invalid status')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to update purchase order status' });
    }
  }
);

router.delete(
  '/:id',
  authorize(Permission.PO_DELETE),
  validateParams(IdParamSchema),
  async (req, res) => {
    const { id } = req.params;
    try {
      const po = await purchaseOrderService.deletePurchaseOrder(Number(id));
      if (!po) {
        return res.status(404).json({ error: 'Purchase order not found' });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete purchase order' });
    }
  }
);

export default router;
