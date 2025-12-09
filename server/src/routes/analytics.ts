import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { Permission } from '../constants/permissions';
import * as analyticsService from '../services/analyticsService';
import { logger } from '../utils/logger';

const router = express.Router();

router.use(authenticateToken);

// GET /api/analytics - Dashboard analytics
router.get('/', authorize(Permission.ANALYTICS_READ), async (req, res) => {
  const { startDate, endDate, period } = req.query;

  try {
    const result = await analyticsService.getAnalytics({
      startDate: startDate as string,
      endDate: endDate as string,
      period: period as any,
    });
    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'Failed to retrieve analytics');
    res.status(500).json({ error: 'Failed to retrieve analytics' });
  }
});

// GET /api/analytics/spending - Spending breakdown
router.get('/spending', authorize(Permission.ANALYTICS_READ), async (req, res) => {
  const { startDate, endDate, groupBy = 'vendor' } = req.query;

  try {
    const result = await analyticsService.getSpendingAnalytics({
      startDate: startDate as string,
      endDate: endDate as string,
      groupBy: groupBy as any,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve spending analytics' });
  }
});

// GET /api/analytics/trends - Invoice amount trends
router.get('/trends', authorize(Permission.ANALYTICS_READ), async (req, res) => {
  const { period = 'monthly', periods = '12' } = req.query;

  try {
    const result = await analyticsService.getTrendAnalytics({
      period: period as any,
      periods: parseInt(periods as string, 10),
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve trend analytics' });
  }
});

// GET /api/analytics/price-changes - Recent price changes
router.get('/price-changes', authorize(Permission.ANALYTICS_READ), async (req, res) => {
  const { page = '1', limit = '20' } = req.query;

  try {
    const result = await analyticsService.getPriceChangeAnalytics({
      page: page as string,
      limit: limit as string,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve price change analytics' });
  }
});

export default router;
