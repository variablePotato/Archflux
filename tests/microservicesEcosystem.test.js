import { jest, describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createApp as createUserApp } from '../services/user-service/src/app.js';
import { createApp as createProductApp } from '../services/product-service/src/app.js';
import { createApp as createOrderApp } from '../services/order-service/src/app.js';
import { createApp as createGatewayApp } from '../src/gateway/app.js';
import { routeRegistry } from '../src/routing/routeRegistry.js';
import http from 'http';

describe('Phase 2 Microservices Ecosystem Integration Tests', () => {
  let gatewayApp;
  let userServer, userPort;
  let productServer, productPort;
  let orderServer, orderPort;

  beforeAll((done) => {
    const uApp = createUserApp();
    userServer = http.createServer(uApp);
    userServer.listen(0, () => {
      userPort = userServer.address().port;

      const pApp = createProductApp();
      productServer = http.createServer(pApp);
      productServer.listen(0, () => {
        productPort = productServer.address().port;

        const oApp = createOrderApp();
        orderServer = http.createServer(oApp);
        orderServer.listen(0, () => {
          orderPort = orderServer.address().port;
          gatewayApp = createGatewayApp();
          done();
        });
      });
    });
  });

  beforeEach(() => {
    routeRegistry.clear();

    // Register microservice routes
    routeRegistry.registerRoute({
      id: 'user-route',
      name: 'User Service',
      pathPrefix: '/api/users',
      targetUrl: `http://localhost:${userPort}`,
      stripPrefix: true,
    });

    routeRegistry.registerRoute({
      id: 'product-route',
      name: 'Product Service',
      pathPrefix: '/api/products',
      targetUrl: `http://localhost:${productPort}`,
      stripPrefix: true,
    });

    routeRegistry.registerRoute({
      id: 'order-route',
      name: 'Order Service',
      pathPrefix: '/api/orders',
      targetUrl: `http://localhost:${orderPort}`,
      stripPrefix: true,
    });
  });

  afterAll((done) => {
    userServer.close(() => {
      productServer.close(() => {
        orderServer.close(done);
      });
    });
  });

  test('Route /api/users to User Microservice', async () => {
    const res = await request(gatewayApp).get('/api/users/users');
    expect(res.statusCode).toEqual(200);
    expect(res.body.service).toEqual('user-service');
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  test('Route /api/products to Product Microservice', async () => {
    const res = await request(gatewayApp).get('/api/products/products');
    expect(res.statusCode).toEqual(200);
    expect(res.body.service).toEqual('product-service');
    expect(res.body.data[0].name).toContain('MacBook');
  });

  test('Route /api/orders to Order Microservice', async () => {
    const res = await request(gatewayApp).get('/api/orders/orders');
    expect(res.statusCode).toEqual(200);
    expect(res.body.service).toEqual('order-service');
    expect(res.body.data[0].status).toEqual('DELIVERED');
  });

  test('Forward POST payload to Product Microservice', async () => {
    const payload = { name: 'Keychron Keyboard', price: 99.99, stock: 25 };
    const res = await request(gatewayApp)
      .post('/api/products/products')
      .send(payload);

    expect(res.statusCode).toEqual(201);
    expect(res.body.service).toEqual('product-service');
    expect(res.body.data.name).toEqual('Keychron Keyboard');
  });
});
