import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { requestLogger } from '../middleware/requestLogger.js';
import { correlationIdMiddleware } from '../middleware/correlationId.js';
import { metricsMiddleware } from '../metrics/metricsMiddleware.js';
import { createMetricsRouter } from '../metrics/metricsRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { asyncHandler } from '../shared/asyncHandler.js';
import { sendSuccess } from '../shared/response.js';
import { healthService } from './health.js';
import { createAdminRouter } from '../routing/adminRoutes.js';
import { gatewayRouter } from '../routing/routerMiddleware.js';
import { NotFoundError } from '../core/errors.js';

export const createApp = (customRoutes = null) => {
  const app = express();

  // Correlation & Observability Middlewares
  app.use(correlationIdMiddleware);
  app.use(metricsMiddleware);

  // Security & Utility Middlewares
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(requestLogger);

  // Prometheus Metrics Scraping Endpoint
  app.use('/metrics', createMetricsRouter());

  // Health Probe Endpoints
  app.get(
    '/health/liveness',
    asyncHandler(async (req, res) => {
      return sendSuccess(res, { status: 'UP' }, 'Gateway process is live');
    })
  );

  app.get(
    '/health/readiness',
    asyncHandler(async (req, res) => {
      const dbHealthy = await healthService.checkDb();
      const redisHealthy = await healthService.checkRedis();

      const isReady = dbHealthy && redisHealthy;
      const status = isReady ? 'UP' : 'DOWN';
      const statusCode = isReady ? 200 : 503;

      return res.status(statusCode).json({
        success: isReady,
        status,
        services: {
          database: dbHealthy ? 'HEALTHY' : 'UNHEALTHY',
          cache: redisHealthy ? 'HEALTHY' : 'UNHEALTHY',
        },
        timestamp: new Date().toISOString(),
      });
    })
  );

  app.get(
    '/health',
    asyncHandler(async (req, res) => {
      const dbHealthy = await healthService.checkDb();
      const redisHealthy = await healthService.checkRedis();

      return sendSuccess(
        res,
        {
          status: dbHealthy && redisHealthy ? 'HEALTHY' : 'DEGRADED',
          services: {
            postgres: dbHealthy ? 'UP' : 'DOWN',
            redis: redisHealthy ? 'UP' : 'DOWN',
          },
        },
        'Gateway health report'
      );
    })
  );

  // Admin Control Plane API
  app.use('/admin', createAdminRouter());

  // Optional custom routes injection (for testing/plugins)
  if (customRoutes) {
    app.use(customRoutes);
  }

  // Serve Dashboard UI static files
  app.use(express.static('public'));

  // Gateway Dynamic Routing Engine
  app.use(gatewayRouter);

  // 404 Route Handler
  app.use('*', (req, res, next) => {
    next(new NotFoundError(`Route ${req.originalUrl} not found`));
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
};
