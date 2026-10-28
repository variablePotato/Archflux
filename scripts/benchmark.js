import autocannon from 'autocannon';
import http from 'http';
import { createApp as createGatewayApp } from '../src/gateway/app.js';
import { createApp as createUserApp } from '../services/user-service/src/app.js';
import { routeRegistry } from '../src/routing/routeRegistry.js';

async function runBenchmark() {
  console.log('🚀 Setting up benchmark microservices & API Gateway environment...');

  // Start mock target service
  const userApp = createUserApp();
  const userServer = http.createServer(userApp);

  await new Promise((resolve) => userServer.listen(0, resolve));
  const userPort = userServer.address().port;

  // Register route
  routeRegistry.clear();
  routeRegistry.registerRoute({
    id: 'bench-user-route',
    name: 'Benchmark User Route',
    pathPrefix: '/api/users',
    targetUrl: `http://localhost:${userPort}`,
    stripPrefix: true,
    rateLimit: { enabled: false }, // bypass rate limit for pure proxy latency test
  });

  // Start Gateway
  const gatewayApp = createGatewayApp();
  const gatewayServer = http.createServer(gatewayApp);
  await new Promise((resolve) => gatewayServer.listen(0, resolve));
  const gatewayPort = gatewayServer.address().port;

  const url = `http://localhost:${gatewayPort}/api/users/users`;
  console.log(`🔥 Starting Autocannon Load Benchmark on ${url}`);
  console.log('⚡ Parameters: 100 concurrent connections, duration 10 seconds...\n');

  const instance = autocannon(
    {
      url,
      connections: 100,
      duration: 10,
      pipelining: 1,
    },
    (err, result) => {
      if (err) {
        console.error('Benchmark Error:', err);
      } else {
        console.log('====================================================');
        console.log('               BENCHMARK RESULTS                    ');
        console.log('====================================================');
        console.log(`  Requests / Sec   : ${result.requests.average.toLocaleString()} req/s`);
        console.log(`  Total Requests   : ${result.requests.total.toLocaleString()}`);
        console.log(`  Throughput       : ${(result.throughput.average / (1024 * 1024)).toFixed(2)} MB/s`);
        console.log(`  Latency (Mean)   : ${result.latency.average} ms`);
        console.log(`  Latency (p50)    : ${result.latency.p50} ms`);
        console.log(`  Latency (p99)    : ${result.latency.p99} ms`);
        console.log(`  Non-2xx Responses: ${result.non2xx || 0}`);
        console.log(`  Errors / Timeouts: ${result.errors || 0}`);
        console.log('====================================================\n');
      }

      gatewayServer.close(() => {
        userServer.close(() => {
          process.exit(0);
        });
      });
    }
  );

  autocannon.track(instance, { renderProgressBar: true });
}

runBenchmark();
