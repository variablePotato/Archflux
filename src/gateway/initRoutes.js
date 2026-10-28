import { routeRegistry } from '../routing/routeRegistry.js';
import { env } from '../config/env.js';
import { logger } from '../core/logger.js';

export const initializeDefaultMicroserviceRoutes = () => {
  const isDocker = env.NODE_ENV === 'production';

  const userServiceUrl = process.env.USER_SERVICE_URL || (isDocker ? 'http://user-service:3001' : 'http://localhost:3001');
  const productServiceUrl = process.env.PRODUCT_SERVICE_URL || (isDocker ? 'http://product-service:3002' : 'http://localhost:3002');
  const orderServiceUrl = process.env.ORDER_SERVICE_URL || (isDocker ? 'http://order-service:3003' : 'http://localhost:3003');

  try {
    routeRegistry.registerRoute({
      id: 'user-service-route',
      name: 'User Microservice',
      pathPrefix: '/api/users',
      targetUrl: userServiceUrl,
      stripPrefix: true,
      authStrategy: 'none',
      rateLimit: { enabled: true, maxRequests: 100, windowSeconds: 60 },
      healthCheck: { enabled: true, path: '/health', intervalMs: 10000 },
    });

    routeRegistry.registerRoute({
      id: 'product-service-route',
      name: 'Product Microservice',
      pathPrefix: '/api/products',
      targetUrl: productServiceUrl,
      stripPrefix: true,
      authStrategy: 'none',
      rateLimit: { enabled: true, maxRequests: 100, windowSeconds: 60 },
      healthCheck: { enabled: true, path: '/health', intervalMs: 10000 },
    });

    routeRegistry.registerRoute({
      id: 'order-service-route',
      name: 'Order Microservice',
      pathPrefix: '/api/orders',
      targetUrl: orderServiceUrl,
      stripPrefix: true,
      authStrategy: 'none',
      rateLimit: { enabled: true, maxRequests: 100, windowSeconds: 60 },
      healthCheck: { enabled: true, path: '/health', intervalMs: 10000 },
    });

    logger.info('Default microservice routes initialized successfully (/api/users, /api/products, /api/orders)');
  } catch (err) {
    logger.warn({ errMessage: err.message }, 'Default microservice routes already initialized or failed');
  }
};
