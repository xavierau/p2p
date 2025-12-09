import pubsub from '../services/pubsub';
import { invalidateByPrefix } from '../services/cacheService';
import { logger } from '../utils/logger';

// Initialize cache invalidation listeners
logger.info('Cache invalidator initialized');

// Invoice changes invalidate analytics
pubsub.subscribe('INVOICE_APPROVED', () => {
  invalidateByPrefix('analytics:');
});

// PO changes invalidate analytics
pubsub.subscribe('PO_STATUS_CHANGED', () => {
  invalidateByPrefix('analytics:');
  invalidateByPrefix('purchaseOrder:');
});
