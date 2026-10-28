import http from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './core/logger.js';

const app = createApp();
const server = http.createServer(app);

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, `👤 User Service running on port ${env.PORT}`);
});

const shutdown = (signal) => {
  logger.info({ signal }, 'User Service shutting down gracefully');
  server.close(() => {
    logger.info('User Service HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
