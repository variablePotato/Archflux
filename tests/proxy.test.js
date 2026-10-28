import { jest, describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import http from 'http';
import { createApp } from '../src/gateway/app.js';
import { createProxyHandler } from '../src/proxy/proxyController.js';
import { sanitizeHeaders, prepareProxyHeaders } from '../src/proxy/headerUtils.js';

describe('Phase 1: Reverse Proxy Integration Tests', () => {
  let app;
  let mockUpstreamServer;
  let mockUpstreamPort;
  let mockUpstreamUrl;

  beforeAll((done) => {
    // Spin up a mock upstream service
    const upstreamApp = express();
    upstreamApp.use(express.json());

    upstreamApp.get('/api/v1/users', (req, res) => {
      res.setHeader('X-Upstream-Header', 'Upstream-Value');
      res.setHeader('Connection', 'close'); // Hop-by-hop header
      res.status(200).json({
        users: [{ id: 1, name: 'Alice' }],
        receivedHeaders: req.headers,
      });
    });

    upstreamApp.post('/api/v1/users', (req, res) => {
      res.status(201).json({
        created: true,
        body: req.body,
        receivedHeaders: req.headers,
      });
    });

    upstreamApp.get('/api/v1/slow', (req, res) => {
      // Delay response by 300ms
      setTimeout(() => {
        res.status(200).json({ slow: true });
      }, 300);
    });

    mockUpstreamServer = http.createServer(upstreamApp);
    mockUpstreamServer.listen(0, () => {
      mockUpstreamPort = mockUpstreamServer.address().port;
      mockUpstreamUrl = `http://localhost:${mockUpstreamPort}`;

      const router = express.Router();
      router.use('/proxy-test', createProxyHandler(mockUpstreamUrl, { timeoutMs: 200 }));

      // Mount proxy router inside createApp
      app = createApp(router);
      done();
    });
  });

  afterAll((done) => {
    if (mockUpstreamServer) {
      mockUpstreamServer.close(done);
    } else {
      done();
    }
  });

  test('Sanitize Hop-by-Hop headers correctly', () => {
    const rawHeaders = {
      'Host': 'api.gateway.internal',
      'Connection': 'keep-alive',
      'Keep-Alive': 'timeout=5',
      'Transfer-Encoding': 'chunked',
      'X-App-Id': '12345',
    };
    const cleaned = sanitizeHeaders(rawHeaders);
    expect(cleaned).toEqual({
      'x-app-id': '12345',
    });
  });

  test('Forward GET request and headers to upstream service', async () => {
    const res = await request(app)
      .get('/proxy-test/api/v1/users')
      .set('X-Custom-Client-Header', 'ClientValue');

    expect(res.statusCode).toEqual(200);
    expect(res.body.users).toHaveLength(1);
    expect(res.headers['x-upstream-header']).toEqual('Upstream-Value');

    const upstreamReceivedHeaders = res.body.receivedHeaders;
    expect(upstreamReceivedHeaders['x-custom-client-header']).toEqual('ClientValue');
    expect(upstreamReceivedHeaders['x-forwarded-proto']).toBeDefined();
    expect(upstreamReceivedHeaders['x-request-id']).toBeDefined();
  });

  test('Forward POST request JSON body to upstream service', async () => {
    const payload = { name: 'Bob', email: 'bob@example.com' };
    const res = await request(app)
      .post('/proxy-test/api/v1/users')
      .send(payload);

    expect(res.statusCode).toEqual(201);
    expect(res.body.created).toBe(true);
    expect(res.body.body).toEqual(payload);
  });

  test('Return 504 Gateway Timeout when upstream exceeds configured timeout', async () => {
    const res = await request(app).get('/proxy-test/api/v1/slow');
    expect(res.statusCode).toEqual(504);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toEqual('GATEWAY_TIMEOUT');
  });

  test('Return 502 Bad Gateway when upstream server is unreachable', async () => {
    const badRouter = express.Router();
    badRouter.use('/proxy-bad', createProxyHandler('http://localhost:59999', { timeoutMs: 1000 }));
    const badApp = createApp(badRouter);

    const res = await request(badApp).get('/proxy-bad/test');
    expect(res.statusCode).toEqual(502);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toEqual('BAD_GATEWAY');
  });
});
