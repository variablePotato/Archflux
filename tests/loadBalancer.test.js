import { jest, describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import http from 'http';
import { createApp } from '../src/gateway/app.js';
import { routeRegistry } from '../src/routing/routeRegistry.js';
import { loadBalancerService } from '../src/load-balancer/loadBalancerService.js';
import { activeHealthChecker } from '../src/load-balancer/healthChecker.js';

describe('Phase 5: Load Balancing & Health Check Tests', () => {
  let app;
  let srv1, port1;
  let srv2, port2;

  beforeAll((done) => {
    // Server 1
    const app1 = express();
    app1.get('/data', (req, res) => res.json({ server: 'srv1' }));
    app1.get('/health', (req, res) => res.json({ status: 'ok' }));

    srv1 = http.createServer(app1);
    srv1.listen(0, () => {
      port1 = srv1.address().port;

      // Server 2
      const app2 = express();
      app2.get('/data', (req, res) => res.json({ server: 'srv2' }));
      app2.get('/health', (req, res) => res.json({ status: 'ok' }));

      srv2 = http.createServer(app2);
      srv2.listen(0, () => {
        port2 = srv2.address().port;
        app = createApp();
        done();
      });
    });
  });

  beforeEach(() => {
    routeRegistry.clear();
    loadBalancerService.clear();
  });

  afterAll((done) => {
    srv1.close(() => {
      srv2.close(done);
    });
  });

  test('Round Robin distributes requests evenly across target pool', async () => {
    const target1 = `http://localhost:${port1}`;
    const target2 = `http://localhost:${port2}`;

    routeRegistry.registerRoute({
      id: 'lb-rr-route',
      name: 'Round Robin Route',
      pathPrefix: '/rr-test',
      targetUrl: target1,
      targets: [target1, target2],
      loadBalancerStrategy: 'round-robin',
      stripPrefix: true,
    });

    const res1 = await request(app).get('/rr-test/data');
    expect(res1.body.server).toEqual('srv1');

    const res2 = await request(app).get('/rr-test/data');
    expect(res2.body.server).toEqual('srv2');

    const res3 = await request(app).get('/rr-test/data');
    expect(res3.body.server).toEqual('srv1');
  });

  test('Least Connections routes request to server with fewer active connections', async () => {
    const target1 = `http://localhost:${port1}`;
    const target2 = `http://localhost:${port2}`;

    routeRegistry.registerRoute({
      id: 'lb-lc-route',
      name: 'Least Connections Route',
      pathPrefix: '/lc-test',
      targetUrl: target1,
      targets: [target1, target2],
      loadBalancerStrategy: 'least-connections',
      stripPrefix: true,
    });

    // Register targets in pool
    loadBalancerService.registerTargets('lb-lc-route', [target1, target2]);

    // Simulate active connections on target1
    loadBalancerService.incrementConnections('lb-lc-route', target1);
    loadBalancerService.incrementConnections('lb-lc-route', target1);

    // Request should pick target2 because it has 0 active connections
    const res = await request(app).get('/lc-test/data');
    expect(res.body.server).toEqual('srv2');
  });

  test('Active Health Checker isolates unhealthy target and returns 503 when pool is depleted', async () => {
    const target1 = `http://localhost:${port1}`;
    const targetBad = `http://localhost:59998`;

    routeRegistry.registerRoute({
      id: 'health-test-route',
      name: 'Health Check Test Route',
      pathPrefix: '/health-test',
      targetUrl: targetBad,
      targets: [targetBad],
      loadBalancerStrategy: 'round-robin',
      stripPrefix: true,
      healthCheck: {
        enabled: true,
        path: '/health',
        maxFails: 1,
      },
    });

    // Execute active health check run
    await activeHealthChecker.performHealthChecks();

    // Requests should fail with 503 Service Unavailable because all targets are UNHEALTHY
    const res = await request(app).get('/health-test/data');
    expect(res.statusCode).toEqual(503);
    expect(res.body.error.code).toEqual('SERVICE_UNAVAILABLE');
  });
});
