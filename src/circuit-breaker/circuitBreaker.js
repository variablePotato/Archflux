import { ServiceUnavailableError } from '../core/errors.js';
import { logger } from '../core/logger.js';
import { metricsService } from '../metrics/metricsService.js';

export const CircuitState = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
};

export class CircuitBreaker {
  constructor() {
    /**
     * Map<string, { state, failureCount, successCount, nextAttempt, config }>
     */
    this.breakers = new Map();
  }

  getBreaker(key, config = {}) {
    let breaker = this.breakers.get(key);
    if (!breaker) {
      breaker = {
        state: CircuitState.CLOSED,
        failureCount: 0,
        successCount: 0,
        nextAttempt: 0,
        config: {
          failureThreshold: config.failureThreshold || 5,
          successThreshold: config.successThreshold || 2,
          resetTimeoutMs: config.resetTimeoutMs || 10000,
        },
      };
      this.breakers.set(key, breaker);
    }
    return breaker;
  }

  /**
   * Execute fn within Circuit Breaker protection.
   */
  async execute(key, fn, config = {}) {
    const breaker = this.getBreaker(key, config);
    const now = Date.now();

    // 1. Check if OPEN state should transition to HALF_OPEN
    if (breaker.state === CircuitState.OPEN) {
      if (now >= breaker.nextAttempt) {
        breaker.state = CircuitState.HALF_OPEN;
        breaker.successCount = 0;
        logger.info({ key }, 'Circuit Breaker transitioning from OPEN to HALF_OPEN');
      } else {
        const retryAfterMs = Math.ceil((breaker.nextAttempt - now) / 1000);
        logger.warn({ key, retryAfterMs }, 'Circuit Breaker is OPEN, failing fast');
        throw new ServiceUnavailableError(`Circuit breaker is OPEN for '${key}'. Try again in ${retryAfterMs}s`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess(breaker, key);
      return result;
    } catch (err) {
      this.onFailure(breaker, key, err);
      throw err;
    }
  }

  onSuccess(breaker, key) {
    if (breaker.state === CircuitState.HALF_OPEN) {
      breaker.successCount += 1;
      if (breaker.successCount >= breaker.config.successThreshold) {
        breaker.state = CircuitState.CLOSED;
        breaker.failureCount = 0;
        breaker.successCount = 0;
        logger.info({ key }, 'Circuit Breaker recovered to CLOSED state');
        metricsService.setCircuitState(key, CircuitState.CLOSED);
      }
    } else if (breaker.state === CircuitState.CLOSED) {
      breaker.failureCount = 0;
    }
  }

  onFailure(breaker, key, err) {
    breaker.failureCount += 1;
    logger.warn({ key, failureCount: breaker.failureCount, errMessage: err.message }, 'Circuit Breaker registered failure');

    if (
      breaker.state === CircuitState.HALF_OPEN ||
      breaker.failureCount >= breaker.config.failureThreshold
    ) {
      breaker.state = CircuitState.OPEN;
      breaker.nextAttempt = Date.now() + breaker.config.resetTimeoutMs;
      logger.error({ key, nextAttemptInMs: breaker.config.resetTimeoutMs }, 'Circuit Breaker tripped to OPEN state');
      metricsService.setCircuitState(key, CircuitState.OPEN);
    }
  }

  getState(key) {
    return this.breakers.get(key)?.state || CircuitState.CLOSED;
  }

  clear() {
    this.breakers.clear();
  }
}

export const circuitBreaker = new CircuitBreaker();
