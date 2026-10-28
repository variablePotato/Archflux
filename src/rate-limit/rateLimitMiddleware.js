import { rateLimiter } from './rateLimiter.js';
import { TooManyRequestsError } from '../core/errors.js';
import { logger } from '../core/logger.js';

export const resolveRateLimitKey = (req, routeConfig, keyBy = 'auto') => {
  const routeId = routeConfig?.id || 'global';

  if (keyBy === 'consumer' || (keyBy === 'auto' && req.apiKey)) {
    if (req.apiKey) {
      return `ratelimit:${routeId}:consumer:${req.apiKey.clientOwnerId}`;
    }
  }

  if (keyBy === 'user' || (keyBy === 'auto' && req.user)) {
    if (req.user) {
      const userId = req.user.sub || req.user.userId || req.user.id;
      return `ratelimit:${routeId}:user:${userId}`;
    }
  }

  // Fallback to Client IP
  const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  return `ratelimit:${routeId}:ip:${clientIp}`;
};

export const enforceRateLimit = async (req, res, routeConfig) => {
  const config = routeConfig?.rateLimit;
  if (!config || config.enabled === false) {
    return; // Rate limiting is not enabled for this route
  }

  const maxRequests = config.maxRequests || 100;
  const windowSeconds = config.windowSeconds || 60;
  const algorithm = config.algorithm || 'sliding';
  const keyBy = config.keyBy || 'auto';

  const rateKey = resolveRateLimitKey(req, routeConfig, keyBy);

  const { allowed, remaining, resetSeconds } = await rateLimiter.checkRateLimit(
    rateKey,
    maxRequests,
    windowSeconds,
    algorithm
  );

  // Set RFC-compliant RateLimit headers
  res.setHeader('RateLimit-Limit', maxRequests);
  res.setHeader('RateLimit-Remaining', Math.max(0, remaining));
  res.setHeader('RateLimit-Reset', resetSeconds);

  if (!allowed) {
    res.setHeader('Retry-After', resetSeconds);
    logger.warn({ rateKey, routeId: routeConfig.id, maxRequests }, 'Rate limit exceeded');
    throw new TooManyRequestsError(`Rate limit exceeded. Maximum allowed: ${maxRequests} requests per ${windowSeconds}s`);
  }
};
