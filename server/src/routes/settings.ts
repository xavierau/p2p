import express from 'express';
import prisma from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { Permission } from '../constants/permissions';

const router = express.Router();

router.use(authenticateToken);

// Get integration config
router.get('/integration/:key', authorize(Permission.SETTINGS_READ), async (req, res) => {
  const { key } = req.params;
  try {
    const config = await prisma.integrationConfig.findUnique({
      where: { key },
    });
    res.json(config || { key, enabled: false, config: '{}' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update integration config
router.put('/integration/:key', authorize(Permission.SETTINGS_UPDATE), async (req, res) => {
  const { key } = req.params;
  const { enabled, config } = req.body;

  try {
    const updatedConfig = await prisma.integrationConfig.upsert({
      where: { key },
      update: { enabled, config },
      create: { key, enabled, config },
    });
    res.json(updatedConfig);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
