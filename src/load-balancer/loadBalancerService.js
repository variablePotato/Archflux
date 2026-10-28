import { logger } from '../core/logger.js';
import { ServiceUnavailableError } from '../core/errors.js';

export class LoadBalancerService {
  constructor() {
    /**
     * Store for route target pools:
     * Map<routeId, { targets: Array<{ url: string, activeConnections: number, state: 'HEALTHY'|'UNHEALTHY', failCount: number }>, roundRobinIndex: number }>
     */
    this.pools = new Map();
  }

  /**
   * Register or update target pool for a route.
   */
  registerTargets(routeId, targetUrls) {
    const urls = Array.isArray(targetUrls) ? targetUrls : [targetUrls];
    const existingPool = this.pools.get(routeId);

    const targets = urls.map((url) => {
      const existing = existingPool?.targets.find((t) => t.url === url);
      return (
        existing || {
          url,
          activeConnections: 0,
          state: 'HEALTHY',
          failCount: 0,
        }
      );
    });

    this.pools.set(routeId, {
      targets,
      roundRobinIndex: 0,
    });
  }

  /**
   * Select a healthy upstream target URL using the configured strategy.
   * @param {Object} routeConfig
   * @returns {string} Selected target URL
   */
  selectTarget(routeConfig) {
    const routeId = routeConfig.id;
    const strategy = routeConfig.loadBalancerStrategy || 'round-robin';
    const targetUrls = routeConfig.targets || [routeConfig.targetUrl];

    let pool = this.pools.get(routeId);
    if (!pool) {
      this.registerTargets(routeId, targetUrls);
      pool = this.pools.get(routeId);
    }

    const healthyTargets = pool.targets.filter((t) => t.state === 'HEALTHY');

    if (healthyTargets.length === 0) {
      logger.error({ routeId }, 'No healthy upstream targets available in pool');
      throw new ServiceUnavailableError(`All upstream targets for route '${routeId}' are currently UNHEALTHY`);
    }

    let selectedTarget = null;

    if (strategy === 'least-connections') {
      // Sort healthy targets by activeConnections ascending
      healthyTargets.sort((a, b) => a.activeConnections - b.activeConnections);
      selectedTarget = healthyTargets[0];
    } else {
      // Round Robin selection
      const index = pool.roundRobinIndex % healthyTargets.length;
      selectedTarget = healthyTargets[index];
      pool.roundRobinIndex = (pool.roundRobinIndex + 1) % healthyTargets.length;
    }

    logger.debug({ routeId, strategy, targetUrl: selectedTarget.url }, 'Selected upstream load balancer target');
    return selectedTarget.url;
  }

  incrementConnections(routeId, targetUrl, allTargets = [targetUrl]) {
    let pool = this.pools.get(routeId);
    if (!pool) {
      this.registerTargets(routeId, allTargets);
      pool = this.pools.get(routeId);
    }
    const target = pool.targets.find((t) => t.url === targetUrl);
    if (target) {
      target.activeConnections += 1;
    }
  }

  decrementConnections(routeId, targetUrl) {
    const pool = this.pools.get(routeId);
    if (pool) {
      const target = pool.targets.find((t) => t.url === targetUrl);
      if (target && target.activeConnections > 0) {
        target.activeConnections -= 1;
      }
    }
  }

  getTargetsForRoute(routeId) {
    return this.pools.get(routeId)?.targets || [];
  }

  updateTargetState(routeId, targetUrl, state, failCount = 0) {
    const pool = this.pools.get(routeId);
    if (pool) {
      const target = pool.targets.find((t) => t.url === targetUrl);
      if (target) {
        target.state = state;
        target.failCount = failCount;
      }
    }
  }

  clear() {
    this.pools.clear();
  }
}

export const loadBalancerService = new LoadBalancerService();
