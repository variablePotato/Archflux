import { jest, describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import http from 'http';
import { createApp } from '../src/gateway/app.js';
import { routeRegistry } from '../src/routing/routeRegistry.js';
import { rateLimiter } from '../src/rate-limit/rateLimiter.js';
import { apiKeyRepository } from '../src/auth/apiKeyRepository.js';

describe('Phase 4: Redis/Memory Rate Limiting Integration Tests', () => {
  let app;
  let mockUpstreamServer;
  let mockUpstreamPort;

  beforeAll((done) => {
    const upstreamApp = express();
    upstreamApp.get('/data', (req, res) => res.json({ success: true }));

    mockUpstreamServer = http.createServer(upstreamApp);
    mockUpstreamServer.listen(0, () => {
      mockUpstreamPort = mockUpstreamServer.address().port;
      app = createApp();
      done();
    });
  });

  beforeEach(() => {
    routeRegistry.clear();
    rateLimiter.clearMemory();
  });

  afterAll((done) => {
    mockUpstreamServer.close(done);
  });

  test('Set RateLimit headers on successful requests', async () => {
    routeRegistry.registerRoute({
      id: 'header-test-route',
      name: 'Rate Limit Header Test',
      pathPrefix: '/header-test',
      targetUrl: `http://localhost:${mockUpstreamPort}`,
      stripPrefix: true,
      rateLimit: {
        enabled: true,
        maxRequests: 5,
        windowSeconds: 60,
        algorithm: 'fixed',
      },
    });

    const res = await request(app).get('/header-test/data');
    expect(res.statusCode).toEqual(200);
    expect(res.headers['ratelimit-limit']).toEqual('5');
    expect(res.headers['ratelimit-remaining']).toEqual('4');
    expect(res.headers['ratelimit-reset']).toBeDefined();
  });

  test('Block requests exceeding max limit with 429 Too Many Requests (Fixed Window)', async () => {
    routeRegistry.registerRoute({
      id: 'fixed-limit-route',
      name: 'Fixed Rate Limit',
      pathPrefix: '/fixed-limit',
      targetUrl: `http://localhost:${mockUpstreamPort}`,
      stripPrefix: true,
      rateLimit: {
        enabled: true,
        maxRequests: 3,
        windowSeconds: 10,
        algorithm: 'fixed',
        keyBy: 'ip',
      },
    });

    // Make 3 allowed requests
    for (let i = 0; i < 3; i++) {
      const res = await request(app).get('/fixed-limit/data');
      expect(res.statusCode).toEqual(200);
    }

    // 4th request should be blocked with 429
    const blockedRes = await request(app).get('/fixed-limit/data');
    expect(blockedRes.statusCode).toEqual(429);
    expect(blockedRes.body.error.code).toEqual('TOO_MANY_REQUESTS');
    expect(blockedRes.headers['retry-after']).toBeDefined();
    expect(blockedRes.headers['ratelimit-remaining']).toEqual('0');
  });

  test('Enforce Sliding Window Rate Limiting', async () => {
    routeRegistry.registerRoute({
      id: 'sliding-limit-route',
      name: 'Sliding Rate Limit',
      pathPrefix: '/sliding-limit',
      targetUrl: `http://localhost:${mockUpstreamPort}`,
      stripPrefix: true,
      rateLimit: {
        enabled: true,
        maxRequests: 2,
        windowSeconds: 5,
        algorithm: 'sliding',
      },
    });

    // Request 1: OK
    const r1 = await request(app).get('/sliding-limit/data');
    expect(r1.statusCode).toEqual(200);

    // Request 2: OK
    const r2 = await request(app).get('/sliding-limit/data');
    expect(r2.statusCode).toEqual(200);

    // Request 3: Blocked (429)
    const r3 = await request(app).get('/sliding-limit/data');
    expect(r3.statusCode).toEqual(429);
  });

  test('Isolated Per-Consumer Rate Limiting via API Keys', async () => {
    routeRegistry.registerRoute({
      id: 'consumer-limit-route',
      name: 'Consumer Isolated Limit',
      pathPrefix: '/consumer-limit',
      targetUrl: `http://localhost:${mockUpstreamPort}`,
      stripPrefix: true,
      authStrategy: 'apiKey',
      rateLimit: {
        enabled: true,
        maxRequests: 1,
        windowSeconds: 10,
        keyBy: 'consumer',
      },
    });

    const key1 = await apiKeyRepository.createApiKey('Key1', 'client-alpha');
    const key2 = await apiKeyRepository.createApiKey('Key2', 'client-beta');

    // Client Alpha Request 1: OK
    const a1 = await request(app).get('/consumer-limit/data').set('x-api-key', key1.rawKey);
    expect(a1.statusCode).toEqual(200);

    // Client Alpha Request 2: Blocked
    const a2 = await request(app).get('/consumer-limit/data').set('x-api-key', key1.rawKey);
    expect(a2.statusCode).toEqual(429);

    // Client Beta Request 1: OK (Isolated limit)
    const b1 = await request(app).get('/consumer-limit/data').set('x-api-key', key2.rawKey);
    expect(b1.statusCode).toEqual(200);
  });
});
