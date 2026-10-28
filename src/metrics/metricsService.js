import client from 'prom-client';

export class MetricsService {
  constructor() {
    this.register = new client.Registry();

    // Enable default process metrics (CPU, Memory, Event Loop)
    client.collectDefaultMetrics({
      register: this.register,
      prefix: 'gateway_',
    });

    // Custom Prometheus Metrics
    this.requestsTotal = new client.Counter({
      name: 'gateway_requests_total',
      help: 'Total number of HTTP requests processed by API Gateway',
      labelNames: ['method', 'route_id', 'status_code'],
      registers: [this.register],
    });

    this.requestDurationSeconds = new client.Histogram({
      name: 'gateway_request_duration_seconds',
      help: 'HTTP request latency in seconds',
      labelNames: ['method', 'route_id', 'status_code'],
      buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.register],
    });

    this.circuitBreakerState = new client.Gauge({
      name: 'gateway_circuit_breaker_state',
      help: 'Circuit Breaker State (0=CLOSED, 1=HALF_OPEN, 2=OPEN)',
      labelNames: ['route_id'],
      registers: [this.register],
    });

    this.activeConnections = new client.Gauge({
      name: 'gateway_active_connections',
      help: 'Number of active HTTP proxy connections to upstream targets',
      labelNames: ['route_id', 'target_url'],
      registers: [this.register],
    });
  }

  recordRequest(method, routeId, statusCode, durationSeconds) {
    const labels = {
      method: method.toUpperCase(),
      route_id: routeId || 'unmapped',
      status_code: String(statusCode),
    };

    this.requestsTotal.inc(labels);
    this.requestDurationSeconds.observe(labels, durationSeconds);
  }

  setCircuitState(routeId, state) {
    let stateVal = 0; // CLOSED
    if (state === 'HALF_OPEN') stateVal = 1;
    if (state === 'OPEN') stateVal = 2;

    this.circuitBreakerState.set({ route_id: routeId }, stateVal);
  }

  setActiveConnections(routeId, targetUrl, count) {
    this.activeConnections.set({ route_id: routeId, target_url: targetUrl }, count);
  }

  async getMetricsContentType() {
    return this.register.contentType;
  }

  async getMetrics() {
    return await this.register.metrics();
  }
}

export const metricsService = new MetricsService();
