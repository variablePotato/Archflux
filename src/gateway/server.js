import http from 'http';
import { createApp } from './app.js';
import { env } from '../config/env.js';
import { logger } from '../core/logger.js';
import { connectDb, closeDbPool } from '../config/db.js';
import { connectRedis, closeRedis } from '../config/redis.js';
import { initializeDefaultMicroserviceRoutes } from './initRoutes.js';
import { activeHealthChecker } from '../load-balancer/healthChecker.js';

let server = null;

const startServer = async () => {
  try {
    logger.info('Starting API Gateway initialization...');

    // Connect infrastructure services
    await connectDb();
    await connectRedis();

    // Register default backend routes & start health checker
    initializeDefaultMicroserviceRoutes();
    activeHealthChecker.start(10000);

    const app = createApp();
    server = http.createServer(app);

    server.listen(env.PORT, () => {
      logger.info({ port: env.PORT, env: env.NODE_ENV }, `🚀 API Gateway listening on port ${env.PORT}`);
    });
  } catch (error) {
    logger.fatal({ error }, 'Failed to start API Gateway server');
    process.exit(1);
  }
};

const shutdown = async (signal) => {
  logger.info({ signal }, `Received ${signal}. Starting graceful shutdown...`);

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed.');

      try {
        await closeRedis();
        await closeDbPool();
        logger.info('Graceful shutdown completed successfully.');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during graceful shutdown cleanup');
        process.exit(1);
      }
    });

    // Force exit if connections take too long to close
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught Exception detected');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason, promise }, 'Unhandled Rejection detected');
  process.exit(1);
});

startServer();
