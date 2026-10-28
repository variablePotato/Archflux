import { jest, describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import http from 'http';
import { createApp } from '../src/gateway/app.js';
import { routeRegistry } from '../src/routing/routeRegistry.js';
import { circuitBreaker, CircuitState } from '../src/circuit-breaker/circuitBreaker.js';

describe('Phase 6: Circuit Breaker & Retry Mechanism Integration Tests', () => {
  let app;
  let mockFlakyServer;
  let mockFlakyPort;
  let failCount = 0;

  beforeAll((done) => {
    const flakyApp = express();
    flakyApp.use(express.json());

    flakyApp.get('/flaky', (req, res) => {
      failCount += 1;
      if (failCount <= 2) {
        res.status(502).json({ error: 'Flaky error' });
      } else {
        res.json({ success: true, attempt: failCount });
      }
    });

    flakyApp.get('/always-fail', (req, res) => {
      res.status(503).json({ error: 'Downstream dead' });
    });

    flakyApp.post('/flaky-post', (req, res) => {
      res.status(502).json({ error: 'Post failed' });
    });

    mockFlakyServer = http.createServer(flakyApp);
    mockFlakyServer.listen(0, () => {
      mockFlakyPort = mockFlakyServer.address().port;
      app = createApp();
      done();
    });
  });

  beforeEach(() => {
    routeRegistry.clear();
    circuitBreaker.clear();
    failCount = 0;
  });

  afterAll((done) => {
    mockFlakyServer.close(done);
  });

  test('Automatic Retries with Exponential Backoff succeeds on attempt 3 for GET request', async () => {
    routeRegistry.registerRoute({
      id: 'retry-route',
      name: 'Retry Flaky Route',
      pathPrefix: '/retry-test',
      targetUrl: `http://localhost:${mockFlakyPort}`,
      stripPrefix: true,
      circuitBreaker: { enabled: false },
      retry: {
        enabled: true,
        maxRetries: 3,
        initialDelayMs: 20,
        maxDelayMs: 100,
      },
    });

    const res = await request(app).get('/retry-test/flaky');
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.attempt).toEqual(3);
  });

  test('Do not retry non-idempotent POST requests', async () => {
    routeRegistry.registerRoute({
      id: 'no-retry-post-route',
      name: 'No Retry POST Route',
      pathPrefix: '/no-retry-post',
      targetUrl: `http://localhost:${mockFlakyPort}`,
      stripPrefix: true,
      retry: {
        enabled: true,
        maxRetries: 3,
      },
    });

    const res = await request(app).post('/no-retry-post/flaky-post').send({ data: 1 });
    expect(res.statusCode).toEqual(502);
  });

  test('Trip Circuit Breaker to OPEN state and fail fast with 503 Service Unavailable', async () => {
    routeRegistry.registerRoute({
      id: 'cb-trip-route',
      name: 'Circuit Breaker Trip Test',
      pathPrefix: '/cb-test',
      targetUrl: `http://localhost:${mockFlakyPort}`,
      stripPrefix: true,
      retry: { enabled: false },
      circuitBreaker: {
        enabled: true,
        failureThreshold: 2,
        resetTimeoutMs: 500,
      },
    });

    // Request 1 & 2 fail upstream
    await request(app).get('/cb-test/always-fail');
    await request(app).get('/cb-test/always-fail');

    expect(circuitBreaker.getState('cb-trip-route')).toEqual(CircuitState.OPEN);

    // Request 3 fails fast immediately with 503
    const fastFailRes = await request(app).get('/cb-test/always-fail');
    expect(fastFailRes.statusCode).toEqual(503);
    expect(fastFailRes.body.error.code).toEqual('SERVICE_UNAVAILABLE');
  });

  test('Transition from OPEN to HALF_OPEN after resetTimeoutMs and recover to CLOSED', async () => {
    routeRegistry.registerRoute({
      id: 'cb-recover-route',
      name: 'Circuit Breaker Recover Test',
      pathPrefix: '/cb-recover',
      targetUrl: `http://localhost:${mockFlakyPort}`,
      stripPrefix: true,
      retry: { enabled: false },
      circuitBreaker: {
        enabled: true,
        failureThreshold: 1,
        successThreshold: 1,
        resetTimeoutMs: 100,
      },
    });

    // 1. Fail to trip breaker to OPEN
    await request(app).get('/cb-recover/always-fail');
    expect(circuitBreaker.getState('cb-recover-route')).toEqual(CircuitState.OPEN);

    // 2. Wait for reset timeout to elapse
    await new Promise((resolve) => setTimeout(resolve, 150));

    // 3. Next request triggers HALF_OPEN trial. Upstream responds 200 (flaky attempt = 3)
    failCount = 2; // Next request returns status 200
    const trialRes = await request(app).get('/cb-recover/flaky');
    expect(trialRes.statusCode).toEqual(200);

    // Breaker recovers to CLOSED
    expect(circuitBreaker.getState('cb-recover-route')).toEqual(CircuitState.CLOSED);
  });
});
