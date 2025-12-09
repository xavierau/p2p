import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { validateParams } from '../middleware/validateParams';
import { Permission } from '../constants/permissions';
import { IdParamSchema } from '../utils/validation';
import * as itemService from '../services/itemService';
import { GetItemsFiltersInput, PaginationInput } from '../schemas';

const router = express.Router();

router.use(authenticateToken);

router.get('/', authorize(Permission.ITEM_READ), async (req, res) => {
  const {
    vendorId,
    vendorName,
    vendorIdOperator = '=',
    vendorNameOperator = 'contains',
    page = '1',
    limit = '10',
  } = req.query;

  const filters: GetItemsFiltersInput = {
    vendorId: vendorId as string | undefined,
    vendorName: vendorName as string | undefined,
    vendorIdOperator: vendorIdOperator as '=' | undefined,
    vendorNameOperator: vendorNameOperator as '=' | 'contains' | undefined,
  };
  const pagination: PaginationInput = {
    page: page as string,
    limit: limit as string,
  };

  try {
    const result = await itemService.getItems(filters, pagination);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve items' });
  }
});

router.get(
  '/:id',
  authorize(Permission.ITEM_READ),
  validateParams(IdParamSchema),
  async (req, res) => {
    const { id } = req.params;
    try {
      const item = await itemService.getItemById(Number(id));
      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve item' });
    }
  }
);

router.get(
  '/:id/price-history',
  authorize(Permission.ITEM_READ),
  validateParams(IdParamSchema),
  async (req, res) => {
    const { id } = req.params;
    const { page = '1', limit = '20' } = req.query;

    const pagination: PaginationInput = {
      page: page as string,
      limit: limit as string,
    };

    try {
      const result = await itemService.getItemPriceHistory(Number(id), pagination);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve price history' });
    }
  }
);

router.post('/', authorize(Permission.ITEM_CREATE), async (req, res) => {
  const { name, price, vendorId } = req.body;
  if (!name || price === undefined || !vendorId) {
    return res.status(400).json({ error: 'Missing required fields: name, price, vendorId' });
  }

  try {
    const item = await itemService.createItem({ name, price, vendorId });
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create item' });
  }
});

router.put(
  '/:id',
  authorize(Permission.ITEM_UPDATE),
  validateParams(IdParamSchema),
  async (req, res) => {
    const { id } = req.params;
    const { name, item_code, price, vendorId } = req.body;
    try {
      const item = await itemService.updateItem(Number(id), {
        name,
        item_code,
        price,
        vendorId,
      });
      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update item' });
    }
  }
);

router.delete(
  '/:id',
  authorize(Permission.ITEM_DELETE),
  validateParams(IdParamSchema),
  async (req, res) => {
    const { id } = req.params;
    try {
      const item = await itemService.deleteItem(Number(id));
      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete item' });
    }
  }
);

export default router;
