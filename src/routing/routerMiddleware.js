import { routeRegistry } from './routeRegistry.js';
import { proxyService } from '../proxy/proxyService.js';
import { authenticateRequest } from '../auth/authMiddleware.js';
import { enforceRateLimit } from '../rate-limit/rateLimitMiddleware.js';
import { loadBalancerService } from '../load-balancer/loadBalancerService.js';
import { circuitBreaker } from '../circuit-breaker/circuitBreaker.js';
import { retryService } from '../circuit-breaker/retryService.js';
import { MethodNotAllowedError } from '../core/errors.js';
import { asyncHandler } from '../shared/asyncHandler.js';
import { logger } from '../core/logger.js';

export const gatewayRouter = asyncHandler(async (req, res, next) => {
  const requestPath = req.path;
  const method = req.method;

  const match = routeRegistry.matchRoute(requestPath, method);
  if (!match) {
    return next(); // Fallthrough to 404 handler
  }

  const { route, isMethodAllowed } = match;
  if (!isMethodAllowed) {
    throw new MethodNotAllowedError(`HTTP method '${method}' is not allowed for route '${route.pathPrefix}'`);
  }

  // 1. Execute Route Authentication Check
  await authenticateRequest(req, route);

  // 2. Execute Route Rate Limiting Check
  await enforceRateLimit(req, res, route);

  req.routeConfig = route;

  // 3. Execute Proxy Forwarding under Circuit Breaker and Retry Protection
  const cbConfig = route.circuitBreaker;
  const cbEnabled = !cbConfig || cbConfig.enabled !== false;

  const executeForwarding = async () => {
    const selectedTargetBase = loadBalancerService.selectTarget(route);

    let targetPath = req.url;
    if (route.stripPrefix) {
      if (targetPath.startsWith(route.pathPrefix)) {
        targetPath = targetPath.slice(route.pathPrefix.length);
        if (!targetPath.startsWith('/')) {
          targetPath = `/${targetPath}`;
        }
      }
    }

    const fullTargetUrl = new URL(targetPath, selectedTargetBase).toString();
    logger.debug({ routeId: route.id, originalUrl: req.originalUrl, fullTargetUrl }, 'Route matched & protected');

    loadBalancerService.incrementConnections(route.id, selectedTargetBase);
    try {
      if (cbEnabled) {
        return await circuitBreaker.execute(
          route.id,
          () => proxyService.forward(req, res, fullTargetUrl, { timeoutMs: route.timeoutMs }),
          cbConfig
        );
      } else {
        return await proxyService.forward(req, res, fullTargetUrl, { timeoutMs: route.timeoutMs });
      }
    } finally {
      loadBalancerService.decrementConnections(route.id, selectedTargetBase);
    }
  };

  await retryService.executeWithRetry(executeForwarding, route.retry, req.method);
});
