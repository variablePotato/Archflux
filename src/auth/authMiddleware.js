import { jwtService } from './jwtService.js';
import { apiKeyRepository } from './apiKeyRepository.js';
import { UnauthorizedError } from '../core/errors.js';
import { logger } from '../core/logger.js';

/**
  Authenticate incoming request against configured route auth strategy.
 */
export const authenticateRequest = async (req, routeConfig) => {
  const strategy = routeConfig?.authStrategy || 'none';

  if (strategy === 'none') {
    return; // Public route, no authentication required
  }

  let jwtSuccess = false;
  let apiKeySuccess = false;

  // 1. Attempt JWT Authentication
  if (strategy === 'jwt' || strategy === 'any') {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      try {
        const decoded = jwtService.verify(token);
        req.user = decoded;
        // Inject user identity context header for upstream microservices
        req.headers['x-user-id'] = decoded.sub || decoded.userId || decoded.id || '';
        jwtSuccess = true;
      } catch (err) {
        if (strategy === 'jwt') throw err;
      }
    } else if (strategy === 'jwt') {
      throw new UnauthorizedError('Missing or malformed Bearer Authorization header');
    }
  }

  // 2. Attempt API Key Authentication
  if (strategy === 'apiKey' || (strategy === 'any' && !jwtSuccess)) {
    const rawApiKey = req.headers['x-api-key'] || req.query.apikey || req.query.api_key;
    if (rawApiKey) {
      const keyRecord = await apiKeyRepository.findByKey(String(rawApiKey));
      if (keyRecord && keyRecord.enabled) {
        req.apiKey = keyRecord;
        // Inject client owner context header for upstream microservices
        req.headers['x-consumer-id'] = keyRecord.clientOwnerId;
        apiKeySuccess = true;
      } else if (strategy === 'apiKey') {
        throw new UnauthorizedError('Invalid or revoked API Key');
      }
    } else if (strategy === 'apiKey') {
      throw new UnauthorizedError('Missing API Key header (x-api-key) or query parameter');
    }
  }

  // 3. Evaluate Strategy Enforcements
  if (strategy === 'any' && !jwtSuccess && !apiKeySuccess) {
    throw new UnauthorizedError('Authentication failed: Valid JWT Bearer token or x-api-key required');
  }
};
