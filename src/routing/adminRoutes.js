import { Router } from 'express';
import { routeRegistry } from './routeRegistry.js';
import { sendSuccess } from '../shared/response.js';
import { asyncHandler } from '../shared/asyncHandler.js';

export const createAdminRouter = () => {
  const router = Router();

  // List all registered routes
  router.get(
    '/routes',
    asyncHandler(async (req, res) => {
      const routes = routeRegistry.getAllRoutes();
      return sendSuccess(res, routes, 'Registered routes fetched successfully');
    })
  );

  // Get a single route by ID
  router.get(
    '/routes/:id',
    asyncHandler(async (req, res) => {
      const route = routeRegistry.getRoute(req.params.id);
      return sendSuccess(res, route, 'Route details retrieved successfully');
    })
  );

  // Register a new route
  router.post(
    '/routes',
    asyncHandler(async (req, res) => {
      const route = routeRegistry.registerRoute(req.body);
      return sendSuccess(res, route, 'Route registered successfully', 201);
    })
  );

  // Update an existing route
  router.put(
    '/routes/:id',
    asyncHandler(async (req, res) => {
      const route = routeRegistry.updateRoute(req.params.id, req.body);
      return sendSuccess(res, route, 'Route updated successfully');
    })
  );

  // Delete a route
  router.delete(
    '/routes/:id',
    asyncHandler(async (req, res) => {
      routeRegistry.deleteRoute(req.params.id);
      return sendSuccess(res, null, `Route '${req.params.id}' deleted successfully`);
    })
  );

  return router;
};
