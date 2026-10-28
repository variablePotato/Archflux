import { Router } from 'express';
import { metricsService } from './metricsService.js';
import { asyncHandler } from '../shared/asyncHandler.js';

export const createMetricsRouter = () => {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      res.setHeader('Content-Type', await metricsService.getMetricsContentType());
      const metricsData = await metricsService.getMetrics();
      res.send(metricsData);
    })
  );

  return router;
};
