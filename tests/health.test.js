import { jest, describe, test, expect, beforeAll, afterEach } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/gateway/app.js';
import { healthService } from '../src/gateway/health.js';

describe('Gateway Phase 0 Health Endpoints', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('GET /health/liveness should return 200 UP', async () => {
    const res = await request(app).get('/health/liveness');
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toEqual('UP');
  });

  test('GET /health/readiness should return 200 UP when services are healthy', async () => {
    jest.spyOn(healthService, 'checkDb').mockResolvedValue(true);
    jest.spyOn(healthService, 'checkRedis').mockResolvedValue(true);

    const res = await request(app).get('/health/readiness');
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toEqual('UP');
    expect(res.body.services).toEqual({
      database: 'HEALTHY',
      cache: 'HEALTHY',
    });
  });

  test('GET /health/readiness should return 503 DOWN when Redis is unhealthy', async () => {
    jest.spyOn(healthService, 'checkDb').mockResolvedValue(true);
    jest.spyOn(healthService, 'checkRedis').mockResolvedValue(false);

    const res = await request(app).get('/health/readiness');
    expect(res.statusCode).toEqual(503);
    expect(res.body.success).toBe(false);
    expect(res.body.status).toEqual('DOWN');
  });

  test('GET /non-existent-route should return 404', async () => {
    const res = await request(app).get('/api/v1/invalid-route');
    expect(res.statusCode).toEqual(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toEqual('NOT_FOUND');
  });
});
