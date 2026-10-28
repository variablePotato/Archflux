import { getRedisClient } from '../config/redis.js';
import { logger } from '../core/logger.js';

const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local clearBefore = now - windowMs

redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)
local currentCount = redis.call('ZCARD', key)

if currentCount < limit then
    redis.call('ZADD', key, now, now .. '-' .. math.random(1, 100000))
    redis.call('PEXPIRE', key, windowMs)
    return {1, limit - currentCount - 1, math.ceil(windowMs / 1000)}
else
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local resetMs = windowMs
    if #oldest > 0 then
        resetMs = math.max(0, (tonumber(oldest[2]) + windowMs) - now)
    end
    return {0, 0, math.ceil(resetMs / 1000)}
end
`;

const FIXED_WINDOW_LUA = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local windowSec = tonumber(ARGV[2])

local current = redis.call('INCR', key)
if current == 1 then
    redis.call('EXPIRE', key, windowSec)
end

local ttl = redis.call('TTL', key)
if current > limit then
    return {0, 0, ttl}
else
    return {1, limit - current, ttl}
end
`;

export class RateLimiter {
  constructor() {
    /** @type {Map<string, { count: number, resetAt: number }>} In-memory fallback */
    this.memoryStore = new Map();
  }

  /**
   * Check rate limit using Redis atomic Lua script or in-memory fallback.
   * @param {string} key
   * @param {number} limit
   * @param {number} windowSeconds
   * @param {'sliding'|'fixed'} algorithm
   */
  async checkRateLimit(key, limit, windowSeconds = 60, algorithm = 'sliding') {
    try {
      const redis = getRedisClient();
      if (redis.status === 'ready') {
        if (algorithm === 'sliding') {
          const now = Date.now();
          const windowMs = windowSeconds * 1000;
          const result = await redis.eval(SLIDING_WINDOW_LUA, 1, key, now, windowMs, limit);
          return {
            allowed: result[0] === 1,
            remaining: result[1],
            resetSeconds: result[2],
          };
        } else {
          const result = await redis.eval(FIXED_WINDOW_LUA, 1, key, limit, windowSeconds);
          return {
            allowed: result[0] === 1,
            remaining: result[1],
            resetSeconds: result[2],
          };
        }
      }
    } catch (err) {
      logger.warn({ err, key }, 'Redis rate limit execution failed, falling back to memory store');
    }

    // In-memory fallback rate limiter
    return this.checkMemoryRateLimit(key, limit, windowSeconds);
  }

  checkMemoryRateLimit(key, limit, windowSeconds) {
    const now = Date.now();
    let record = this.memoryStore.get(key);

    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + windowSeconds * 1000 };
    }

    record.count += 1;
    this.memoryStore.set(key, record);

    const resetSeconds = Math.max(0, Math.ceil((record.resetAt - now) / 1000));
    if (record.count > limit) {
      return { allowed: false, remaining: 0, resetSeconds };
    }

    return { allowed: true, remaining: limit - record.count, resetSeconds };
  }

  clearMemory() {
    this.memoryStore.clear();
  }
}

export const rateLimiter = new RateLimiter();
