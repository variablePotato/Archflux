import http from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './core/logger.js';

const app = createApp();
const server = http.createServer(app);

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, `🛒 Order Service running on port ${env.PORT}`);
});

const shutdown = (signal) => {
  logger.info({ signal }, 'Order Service shutting down gracefully');
  server.close(() => {
    logger.info('Order Service HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
