import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { Permission } from '../constants/permissions';
import * as departmentService from '../services/departmentService';

const router = express.Router();

router.use(authenticateToken);

router.get('/', authorize(Permission.DEPARTMENT_READ), async (req, res) => {
  const { page = '1', limit = '10' } = req.query;
  const pagination = { page, limit } as any;

  try {
    const result = await departmentService.getDepartments(pagination);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve departments' });
  }
});

router.get('/branches', authorize(Permission.DEPARTMENT_READ), async (req, res) => {
  const { page = '1', limit = '10' } = req.query;
  const pagination = { page, limit } as any;

  try {
    const result = await departmentService.getBranches(pagination);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve branches' });
  }
});

router.get('/cost-centers', authorize(Permission.DEPARTMENT_READ), async (req, res) => {
  const { page = '1', limit = '10' } = req.query;
  const pagination = { page, limit } as any;

  try {
    const result = await departmentService.getCostCenters(pagination);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve cost centers' });
  }
});

export default router;
