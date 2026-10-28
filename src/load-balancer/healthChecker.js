import { request } from 'undici';
import { loadBalancerService } from './loadBalancerService.js';
import { routeRegistry } from '../routing/routeRegistry.js';
import { logger } from '../core/logger.js';

export class ActiveHealthChecker {
  constructor() {
    this.timer = null;
    this.isChecking = false;
  }

  start(intervalMs = 10000) {
    if (this.timer) return;

    logger.info({ intervalMs }, 'Starting Active Health Checker background monitor');
    this.timer = setInterval(async () => {
      if (this.isChecking) return;
      this.isChecking = true;
      try {
        await this.performHealthChecks();
      } catch (err) {
        logger.error({ err }, 'Error during active health checks execution');
      } finally {
        this.isChecking = false;
      }
    }, intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('Stopped Active Health Checker background monitor');
    }
  }

  async performHealthChecks() {
    const routes = routeRegistry.getAllRoutes().filter((r) => r.enabled);

    for (const route of routes) {
      const config = route.healthCheck;
      if (config && config.enabled === false) continue;

      const path = config?.path || '/health';
      const timeoutMs = config?.timeoutMs || 2000;
      const maxFails = config?.maxFails || 3;

      const targetUrls = route.targets || [route.targetUrl];
      loadBalancerService.registerTargets(route.id, targetUrls);

      const targets = loadBalancerService.getTargetsForRoute(route.id);

      for (const target of targets) {
        const fullCheckUrl = new URL(path, target.url).toString();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const res = await request(fullCheckUrl, {
            method: 'GET',
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (res.statusCode >= 200 && res.statusCode < 400) {
            if (target.state !== 'HEALTHY') {
              logger.info({ routeId: route.id, targetUrl: target.url }, 'Upstream target recovered to HEALTHY');
            }
            loadBalancerService.updateTargetState(route.id, target.url, 'HEALTHY', 0);
          } else {
            const failCount = target.failCount + 1;
            const newState = failCount >= maxFails ? 'UNHEALTHY' : target.state;
            if (newState === 'UNHEALTHY' && target.state !== 'UNHEALTHY') {
              logger.warn({ routeId: route.id, targetUrl: target.url, statusCode: res.statusCode }, 'Upstream target marked UNHEALTHY');
            }
            loadBalancerService.updateTargetState(route.id, target.url, newState, failCount);
          }
        } catch (err) {
          clearTimeout(timeout);
          const failCount = target.failCount + 1;
          const newState = failCount >= maxFails ? 'UNHEALTHY' : target.state;
          if (newState === 'UNHEALTHY' && target.state !== 'UNHEALTHY') {
            logger.warn({ routeId: route.id, targetUrl: target.url, errMessage: err.message }, 'Upstream target marked UNHEALTHY due to network failure');
          }
          loadBalancerService.updateTargetState(route.id, target.url, newState, failCount);
        }
      }
    }
  }
}

export const activeHealthChecker = new ActiveHealthChecker();
