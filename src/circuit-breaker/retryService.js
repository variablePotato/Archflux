import { BadGatewayError, GatewayTimeoutError, ServiceUnavailableError } from '../core/errors.js';
import { logger } from '../core/logger.js';

export class RetryService {
  /**
   * Determine if an error is eligible for retry (502, 503, 504 or network socket failures).
   */
  isRetryableError(err) {
    if (
      err instanceof BadGatewayError ||
      err instanceof GatewayTimeoutError ||
      err instanceof ServiceUnavailableError
    ) {
      return true;
    }
    const code = err.statusCode || err.code;
    return code === 502 || code === 503 || code === 504 || code === 'ECONNREFUSED' || code === 'ENOTFOUND';
  }

  /**
   * Calculate exponential backoff with full jitter to avoid thundering herd problem.
   * Full Jitter formula: sleep = Math.random() * min(maxDelay, initialDelay * 2^attempt)
   */
  calculateBackoffWithJitter(attempt, initialDelayMs = 100, maxDelayMs = 2000) {
    const temp = Math.min(maxDelayMs, initialDelayMs * Math.pow(2, attempt));
    return Math.floor(Math.random() * temp);
  }

  /**
   * Execute async function with exponential backoff retry policy.
   */
  async executeWithRetry(fn, config = {}, reqMethod = 'GET') {
    const enabled = config.enabled !== false;
    const maxRetries = enabled ? config.maxRetries || 3 : 0;
    const initialDelayMs = config.initialDelayMs || 100;
    const maxDelayMs = config.maxDelayMs || 2000;

    // Only retry idempotent methods (GET, HEAD, OPTIONS, PUT, DELETE) unless explicitly configured
    const isIdempotent = ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'].includes(reqMethod.toUpperCase());
    if (!isIdempotent) {
      return await fn();
    }

    let attempt = 0;

    while (true) {
      try {
        return await fn();
      } catch (err) {
        attempt += 1;

        if (attempt > maxRetries || !this.isRetryableError(err)) {
          throw err;
        }

        const delayMs = this.calculateBackoffWithJitter(attempt - 1, initialDelayMs, maxDelayMs);
        logger.warn(
          { attempt, maxRetries, delayMs, errMessage: err.message },
          'Retrying failed upstream request with exponential backoff & jitter'
        );

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
}

export const retryService = new RetryService();
