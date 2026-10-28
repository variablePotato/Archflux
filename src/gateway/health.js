import { checkDbHealth } from '../config/db.js';
import { checkRedisHealth } from '../config/redis.js';

export const healthService = {
  checkDb: async () => await checkDbHealth(),
  checkRedis: async () => await checkRedisHealth(),
};
