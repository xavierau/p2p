import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import metricsRoutes from '../../routes/metrics';
import * as metricsService from '../../services/metricsService';

// Create a minimal Express app for testing
const createTestApp = (): Express => {
  const app = express();
  app.use('/metrics', metricsRoutes);
  return app;
};

describe('metrics routes', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  // ==========================================================================
  // GET /metrics
  // ==========================================================================
  describe('GET /metrics', () => {
    it('should return 200 status code', async () => {
      // Act
      const response = await request(app).get('/metrics');

      // Assert
      expect(response.status).toBe(200);
    });

    it('should return Prometheus-compatible content type', async () => {
      // Act
      const response = await request(app).get('/metrics');

      // Assert
      expect(response.headers['content-type']).toContain('text/plain');
    });

    it('should return metrics in Prometheus format', async () => {
      // Act
      const response = await request(app).get('/metrics');

      // Assert
      expect(response.text).toContain('# HELP');
      expect(response.text).toContain('# TYPE');
    });

    it('should call getMetrics from metricsService', async () => {
      // Arrange
      const getMetricsSpy = vi.spyOn(metricsService, 'getMetrics');

      // Act
      await request(app).get('/metrics');

      // Assert
      expect(getMetricsSpy).toHaveBeenCalled();
    });

    it('should call getContentType from metricsService', async () => {
      // Arrange
      const getContentTypeSpy = vi.spyOn(metricsService, 'getContentType');

      // Act
      await request(app).get('/metrics');

      // Assert
      expect(getContentTypeSpy).toHaveBeenCalled();
    });

    it('should return 500 when metrics collection fails', async () => {
      // Arrange
      vi.spyOn(metricsService, 'getMetrics').mockRejectedValueOnce(new Error('Collection error'));

      // Act
      const response = await request(app).get('/metrics');

      // Assert
      expect(response.status).toBe(500);
      expect(response.text).toBe('Error collecting metrics');
    });

    it('should include cache metrics', async () => {
      // Act
      const response = await request(app).get('/metrics');

      // Assert
      expect(response.text).toContain('cache_hit_rate');
      expect(response.text).toContain('cache_keys_total');
    });
  });
});
