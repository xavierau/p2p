import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { validateParams } from '../middleware/validateParams';
import { Permission } from '../constants/permissions';
import { IdParamSchema } from '../utils/validation';
import * as vendorService from '../services/vendorService';
import { VendorHasActiveItemsError } from '../services/vendorService';
import { GetVendorsFiltersInput, PaginationInput } from '../schemas';

const router = express.Router();

router.use(authenticateToken);

router.get('/', authorize(Permission.VENDOR_READ), async (req, res) => {
  const {
    id,
    name,
    idOperator = '=',
    nameOperator = 'contains',
    page = '1',
    limit = '10',
  } = req.query;

  const filters: GetVendorsFiltersInput = {
    id: id as string | undefined,
    name: name as string | undefined,
    idOperator: idOperator as '=' | undefined,
    nameOperator: nameOperator as '=' | 'contains' | undefined,
  };
  const pagination: PaginationInput = {
    page: page as string,
    limit: limit as string,
  };

  try {
    const result = await vendorService.getVendors(filters, pagination);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve vendors' });
  }
});

router.get(
  '/:id',
  authorize(Permission.VENDOR_READ),
  validateParams(IdParamSchema),
  async (req, res) => {
    const { id } = req.params;
    try {
      const vendor = await vendorService.getVendorById(Number(id));
      if (!vendor) {
        return res.status(404).json({ error: 'Vendor not found' });
      }
      res.json(vendor);
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve vendor' });
    }
  }
);

router.post('/', authorize(Permission.VENDOR_CREATE), async (req, res) => {
  const { name, contact } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Missing required field: name' });
  }

  try {
    const vendor = await vendorService.createVendor({ name, contact });
    res.status(201).json(vendor);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create vendor' });
  }
});

router.put(
  '/:id',
  authorize(Permission.VENDOR_UPDATE),
  validateParams(IdParamSchema),
  async (req, res) => {
    const { id } = req.params;
    const { name, contact } = req.body;
    try {
      const vendor = await vendorService.updateVendor(Number(id), { name, contact });
      if (!vendor) {
        return res.status(404).json({ error: 'Vendor not found' });
      }
      res.json(vendor);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update vendor' });
    }
  }
);

router.delete(
  '/:id',
  authorize(Permission.VENDOR_DELETE),
  validateParams(IdParamSchema),
  async (req, res) => {
    const { id } = req.params;
    try {
      const vendor = await vendorService.deleteVendor(Number(id));
      if (!vendor) {
        return res.status(404).json({ error: 'Vendor not found' });
      }
      res.status(204).send();
    } catch (error) {
      if (error instanceof VendorHasActiveItemsError) {
        return res.status(409).json({
          error: error.message,
          code: 'VENDOR_HAS_ACTIVE_ITEMS',
          vendorId: error.vendorId,
          itemCount: error.itemCount,
        });
      }
      res.status(500).json({ error: 'Failed to delete vendor' });
    }
  }
);

export default router;
