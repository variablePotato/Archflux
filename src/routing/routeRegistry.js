import { routeSchema } from './routeSchema.js';
import { BadRequestError, NotFoundError, ConflictError } from '../core/errors.js';
import { logger } from '../core/logger.js';

export class RouteRegistry {
  constructor() {
    /** @type {Map<string, Object>} */
    this.routes = new Map();
  }

  /**
   * Register a new route definition.
   */
  registerRoute(routeData) {
    const parseResult = routeSchema.safeParse(routeData);
    if (!parseResult.success) {
      throw new BadRequestError('Invalid route schema', parseResult.error.format());
    }

    const route = parseResult.data;

    if (this.routes.has(route.id)) {
      throw new ConflictError(`Route with ID '${route.id}' already exists`);
    }

    this.routes.set(route.id, route);
    logger.info({ routeId: route.id, prefix: route.pathPrefix, target: route.targetUrl }, 'Registered new route');
    return route;
  }

  /**
   * Update an existing route definition.
   */
  updateRoute(id, updateData) {
    const existing = this.routes.get(id);
    if (!existing) {
      throw new NotFoundError(`Route with ID '${id}' not found`);
    }

    const updatedMerged = { ...existing, ...updateData, id };
    const parseResult = routeSchema.safeParse(updatedMerged);
    if (!parseResult.success) {
      throw new BadRequestError('Invalid route update data', parseResult.error.format());
    }

    const updated = parseResult.data;
    this.routes.set(id, updated);
    logger.info({ routeId: id, prefix: updated.pathPrefix }, 'Updated route configuration');
    return updated;
  }

  /**
   * Delete a route by ID.
   */
  deleteRoute(id) {
    if (!this.routes.has(id)) {
      throw new NotFoundError(`Route with ID '${id}' not found`);
    }
    this.routes.delete(id);
    logger.info({ routeId: id }, 'Deleted route configuration');
    return true;
  }

  /**
   * Get a single route by ID.
   */
  getRoute(id) {
    const route = this.routes.get(id);
    if (!route) {
      throw new NotFoundError(`Route with ID '${id}' not found`);
    }
    return route;
  }

  /**
   * Get all registered routes.
   */
  getAllRoutes() {
    return Array.from(this.routes.values());
  }

  /**
   * Perform longest-prefix matching against an incoming request path & method.
   * @param {string} path - Request URL path (e.g. /api/v1/users/42)
   * @param {string} method - Request HTTP Method (e.g. GET)
   * @returns {{ route: Object, isMethodAllowed: boolean } | null}
   */
  matchRoute(path, method) {
    const normalizedMethod = method.toUpperCase();
    
    // Sort active routes by prefix length descending (longest prefix match first)
    const activeRoutes = Array.from(this.routes.values())
      .filter((r) => r.enabled)
      .sort((a, b) => b.pathPrefix.length - a.pathPrefix.length);

    for (const route of activeRoutes) {
      // Check prefix match
      if (path === route.pathPrefix || path.startsWith(route.pathPrefix.endsWith('/') ? route.pathPrefix : `${route.pathPrefix}/`)) {
        const isMethodAllowed = route.methods.includes('*') || route.methods.includes(normalizedMethod);
        return { route, isMethodAllowed };
      }
    }

    return null;
  }

  /**
   * Clear all registered routes.
   */
  clear() {
    this.routes.clear();
  }
}

export const routeRegistry = new RouteRegistry();
