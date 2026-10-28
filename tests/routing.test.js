import { jest, describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import http from 'http';
import { createApp } from '../src/gateway/app.js';
import { routeRegistry } from '../src/routing/routeRegistry.js';

describe('Phase 2: Request Routing & Admin Control Plane Tests', () => {
  let app;
  let mockUserService;
  let mockUserPort;
  let mockOrderService;
  let mockOrderPort;

  beforeAll((done) => {
    // Upstream User Service
    const userApp = express();
    userApp.use(express.json());
    userApp.get('/users/10', (req, res) => res.json({ id: 10, service: 'User' }));
    userApp.post('/users', (req, res) => res.status(201).json({ created: true }));

    mockUserService = http.createServer(userApp);
    mockUserService.listen(0, () => {
      mockUserPort = mockUserService.address().port;

      // Upstream Order Service
      const orderApp = express();
      orderApp.get('/api/v1/orders', (req, res) => res.json({ orders: [], service: 'Order' }));

      mockOrderService = http.createServer(orderApp);
      mockOrderService.listen(0, () => {
        mockOrderPort = mockOrderService.address().port;
        app = createApp();
        done();
      });
    });
  });

  beforeEach(() => {
    routeRegistry.clear();
  });

  afterAll((done) => {
    mockUserService.close(() => {
      mockOrderService.close(done);
    });
  });

  test('Dynamic Route CRUD via Admin API', async () => {
    // 1. Register Route via POST /admin/routes
    const createRes = await request(app)
      .post('/admin/routes')
      .send({
        id: 'users-service',
        name: 'User Microservice',
        pathPrefix: '/api/v1/users',
        targetUrl: `http://localhost:${mockUserPort}`,
        stripPrefix: true,
        methods: ['GET', 'POST'],
      });

    expect(createRes.statusCode).toEqual(201);
    expect(createRes.body.data.id).toEqual('users-service');

    // 2. Fetch Route Details via GET /admin/routes/users-service
    const getRes = await request(app).get('/admin/routes/users-service');
    expect(getRes.statusCode).toEqual(200);
    expect(getRes.body.data.name).toEqual('User Microservice');

    // 3. Update Route via PUT /admin/routes/users-service
    const updateRes = await request(app)
      .put('/admin/routes/users-service')
      .send({ name: 'Updated User Microservice' });

    expect(updateRes.statusCode).toEqual(200);
    expect(updateRes.body.data.name).toEqual('Updated User Microservice');

    // 4. Delete Route via DELETE /admin/routes/users-service
    const deleteRes = await request(app).delete('/admin/routes/users-service');
    expect(deleteRes.statusCode).toEqual(200);

    // 5. Verify deleted
    const verifyRes = await request(app).get('/admin/routes/users-service');
    expect(verifyRes.statusCode).toEqual(404);
  });

  test('Route request to upstream with stripPrefix enabled', async () => {
    routeRegistry.registerRoute({
      id: 'users-route',
      name: 'Users Route',
      pathPrefix: '/api/v1/users',
      targetUrl: `http://localhost:${mockUserPort}`,
      stripPrefix: true,
      methods: ['GET'],
    });

    const res = await request(app).get('/api/v1/users/users/10');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual({ id: 10, service: 'User' });
  });

  test('Enforce Longest-Prefix Matching order', async () => {
    // Short prefix route
    routeRegistry.registerRoute({
      id: 'short-prefix',
      name: 'General API',
      pathPrefix: '/api/v1',
      targetUrl: `http://localhost:${mockOrderPort}`,
      stripPrefix: false,
      methods: ['GET'],
    });

    // Longer prefix route
    routeRegistry.registerRoute({
      id: 'long-prefix',
      name: 'Specific User API',
      pathPrefix: '/api/v1/users',
      targetUrl: `http://localhost:${mockUserPort}`,
      stripPrefix: true,
      methods: ['GET'],
    });

    // Requesting /api/v1/users/users/10 should match 'long-prefix' (mockUserPort) rather than 'short-prefix'
    const res = await request(app).get('/api/v1/users/users/10');
    expect(res.statusCode).toEqual(200);
    expect(res.body.service).toEqual('User');
  });

  test('Reject disallowed HTTP methods with 405 Method Not Allowed', async () => {
    routeRegistry.registerRoute({
      id: 'readonly-route',
      name: 'Read Only Users',
      pathPrefix: '/api/v1/read-users',
      targetUrl: `http://localhost:${mockUserPort}`,
      stripPrefix: true,
      methods: ['GET'], // Only GET allowed
    });

    const res = await request(app).delete('/api/v1/read-users/users/10');
    expect(res.statusCode).toEqual(405);
    expect(res.body.error.code).toEqual('METHOD_NOT_ALLOWED');
  });
});
