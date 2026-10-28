import { jest, describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import http from 'http';
import { createApp } from '../src/gateway/app.js';
import { routeRegistry } from '../src/routing/routeRegistry.js';

describe('Phase 7: Observability & Prometheus Metrics Tests', () => {
  let app;
  let mockServer;
  let mockPort;

  beforeAll((done) => {
    const mockApp = express();
    mockApp.get('/test-endpoint', (req, res) => {
      res.json({
        receivedRequestId: req.headers['x-request-id'],
        receivedCorrelationId: req.headers['x-correlation-id'],
      });
    });

    mockServer = http.createServer(mockApp);
    mockServer.listen(0, () => {
      mockPort = mockServer.address().port;
      app = createApp();
      done();
    });
  });

  afterAll((done) => {
    mockServer.close(done);
  });

  test('Generate and propagate X-Request-ID and X-Correlation-ID headers', async () => {
    routeRegistry.registerRoute({
      id: 'obs-route',
      name: 'Observability Test Route',
      pathPrefix: '/obs',
      targetUrl: `http://localhost:${mockPort}`,
      stripPrefix: true,
    });

    const res = await request(app).get('/obs/test-endpoint');

    expect(res.statusCode).toEqual(200);
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-correlation-id']).toBeDefined();

    // Upstream received correlation headers
    expect(res.body.receivedRequestId).toEqual(res.headers['x-request-id']);
    expect(res.body.receivedCorrelationId).toEqual(res.headers['x-correlation-id']);
  });

  test('Preserve custom client X-Correlation-ID header', async () => {
    routeRegistry.registerRoute({
      id: 'obs-route-2',
      name: 'Observability Test Route 2',
      pathPrefix: '/obs-2',
      targetUrl: `http://localhost:${mockPort}`,
      stripPrefix: true,
    });

    const customCorrelationId = 'trace-client-uuid-9999';
    const res = await request(app)
      .get('/obs-2/test-endpoint')
      .set('X-Correlation-ID', customCorrelationId);

    expect(res.statusCode).toEqual(200);
    expect(res.headers['x-correlation-id']).toEqual(customCorrelationId);
    expect(res.body.receivedCorrelationId).toEqual(customCorrelationId);
  });

  test('Expose scrapable Prometheus metrics at GET /metrics', async () => {
    const res = await request(app).get('/metrics');

    expect(res.statusCode).toEqual(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('gateway_requests_total');
    expect(res.text).toContain('gateway_request_duration_seconds');
    expect(res.text).toContain('gateway_circuit_breaker_state');
    expect(res.text).toContain('gateway_active_connections');
  });
});
