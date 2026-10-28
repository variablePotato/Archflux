import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from '../core/logger.js';

let redisClient = null;

export const getRedisClient = () => {
  if (!redisClient) {
    redisClient = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) {
          return null; // Stop retrying after 3 attempts when Redis is offline
        }
        const delay = Math.min(times * 200, 2000);
        return delay;
      },
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    redisClient.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        // Silently handled by in-memory fallback
        return;
      }
      logger.error({ err }, 'Redis connection error');
    });

    redisClient.on('close', () => {
      // Redis connection closed
    });
  }

  return redisClient;
};

export const connectRedis = async () => {
  try {
    const client = getRedisClient();
    if (client.status === 'wait') {
      await client.connect();
    }
  } catch (err) {
    logger.warn({ errMessage: err.message }, '⚠️ Redis connection unavailable — relying on in-memory rate limiter fallback');
  }
};

export const checkRedisHealth = async () => {
  try {
    const client = getRedisClient();
    const pingResponse = await client.ping();
    return pingResponse === 'PONG';
  } catch (err) {
    logger.error({ err }, 'Redis health check failed');
    return false;
  }
};

export const closeRedis = async () => {
  if (redisClient) {
    logger.info('Closing Redis connection...');
    await redisClient.quit();
    redisClient = null;
  }
};
