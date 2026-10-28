import { jest, describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import http from 'http';
import { createApp } from '../src/gateway/app.js';
import { routeRegistry } from '../src/routing/routeRegistry.js';
import { jwtService } from '../src/auth/jwtService.js';
import { apiKeyRepository } from '../src/auth/apiKeyRepository.js';

describe('Phase 3: JWT & API Key Authentication Integration Tests', () => {
  let app;
  let mockUpstreamServer;
  let mockUpstreamPort;

  beforeAll((done) => {
    const upstreamApp = express();
    upstreamApp.use(express.json());

    upstreamApp.get('/secure-data', (req, res) => {
      res.json({
        success: true,
        userId: req.headers['x-user-id'] || null,
        consumerId: req.headers['x-consumer-id'] || null,
      });
    });

    mockUpstreamServer = http.createServer(upstreamApp);
    mockUpstreamServer.listen(0, () => {
      mockUpstreamPort = mockUpstreamServer.address().port;
      app = createApp();
      done();
    });
  });

  beforeEach(() => {
    routeRegistry.clear();
    apiKeyRepository.clear();
  });

  afterAll((done) => {
    mockUpstreamServer.close(done);
  });

  test('Public route (authStrategy: none) allows access without credentials', async () => {
    routeRegistry.registerRoute({
      id: 'public-route',
      name: 'Public Route',
      pathPrefix: '/public',
      targetUrl: `http://localhost:${mockUpstreamPort}`,
      stripPrefix: true,
      authStrategy: 'none',
    });

    const res = await request(app).get('/public/secure-data');
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
  });

  test('JWT protected route rejects missing or invalid token', async () => {
    routeRegistry.registerRoute({
      id: 'jwt-route',
      name: 'JWT Protected Route',
      pathPrefix: '/jwt-protected',
      targetUrl: `http://localhost:${mockUpstreamPort}`,
      stripPrefix: true,
      authStrategy: 'jwt',
    });

    // 1. Missing Authorization header
    const noTokenRes = await request(app).get('/jwt-protected/secure-data');
    expect(noTokenRes.statusCode).toEqual(401);
    expect(noTokenRes.body.error.code).toEqual('UNAUTHORIZED');

    // 2. Invalid Token
    const invalidTokenRes = await request(app)
      .get('/jwt-protected/secure-data')
      .set('Authorization', 'Bearer invalid-token-xyz');
    expect(invalidTokenRes.statusCode).toEqual(401);
  });

  test('JWT protected route succeeds with valid token and forwards X-User-Id header', async () => {
    routeRegistry.registerRoute({
      id: 'jwt-route',
      name: 'JWT Protected Route',
      pathPrefix: '/jwt-protected',
      targetUrl: `http://localhost:${mockUpstreamPort}`,
      stripPrefix: true,
      authStrategy: 'jwt',
    });

    const token = jwtService.sign({ sub: 'user-12345', email: 'alice@example.com' }, '1h');

    const res = await request(app)
      .get('/jwt-protected/secure-data')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.userId).toEqual('user-12345');
  });

  test('API Key protected route succeeds with valid key and forwards X-Consumer-Id header', async () => {
    routeRegistry.registerRoute({
      id: 'apikey-route',
      name: 'API Key Route',
      pathPrefix: '/key-protected',
      targetUrl: `http://localhost:${mockUpstreamPort}`,
      stripPrefix: true,
      authStrategy: 'apiKey',
    });

    const { rawKey } = await apiKeyRepository.createApiKey('Partner Key', 'partner-corp-789');

    // 1. Rejects missing API key
    const missingRes = await request(app).get('/key-protected/secure-data');
    expect(missingRes.statusCode).toEqual(401);

    // 2. Rejects invalid key
    const invalidRes = await request(app)
      .get('/key-protected/secure-data')
      .set('x-api-key', 'gw_invalidkey123');
    expect(invalidRes.statusCode).toEqual(401);

    // 3. Succeeds with valid header
    const validRes = await request(app)
      .get('/key-protected/secure-data')
      .set('x-api-key', rawKey);
    expect(validRes.statusCode).toEqual(200);
    expect(validRes.body.consumerId).toEqual('partner-corp-789');
  });

  test('Combined authStrategy "any" permits either JWT or API Key', async () => {
    routeRegistry.registerRoute({
      id: 'any-route',
      name: 'Flexible Auth Route',
      pathPrefix: '/any-protected',
      targetUrl: `http://localhost:${mockUpstreamPort}`,
      stripPrefix: true,
      authStrategy: 'any',
    });

    const { rawKey } = await apiKeyRepository.createApiKey('Flex Key', 'flex-client-1');
    const token = jwtService.sign({ sub: 'flex-user-2' });

    // Valid via API Key
    const keyRes = await request(app)
      .get('/any-protected/secure-data')
      .set('x-api-key', rawKey);
    expect(keyRes.statusCode).toEqual(200);
    expect(keyRes.body.consumerId).toEqual('flex-client-1');

    // Valid via JWT
    const jwtRes = await request(app)
      .get('/any-protected/secure-data')
      .set('Authorization', `Bearer ${token}`);
    expect(jwtRes.statusCode).toEqual(200);
    expect(jwtRes.body.userId).toEqual('flex-user-2');
  });
});
