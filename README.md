# ⚡ Archflux API Gateway & Resilient Microservices Engine

[![Node.js](https://img.shields.io/badge/Node.js-v20%2B-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-v4.19-blue.svg)](https://expressjs.com/)
[![Redis](https://img.shields.io/badge/Redis-v7.0-red.svg)](https://redis.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v16-blue.svg)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-cyan.svg)](https://www.docker.com/)
[![Tests](https://img.shields.io/badge/Tests-36%2F36%20Passed-brightgreen.svg)]()

Archflux is a production-grade, high-throughput **Layer 7 API Gateway** and **Microservices Management Engine** built from scratch in Node.js (ESM).

Designed to showcase real-world system design, distributed resilience, rate limiting, and edge observability, Archflux provides a unified entry point for microservice ecosystems with under 5ms latency overhead.

---

## 📐 System Architecture

```text
                                Client / Browser
                                       │
                                       ▼
                            +--------------------+
                            |  Archflux Gateway  |
                            |    (Port 8000)     |
                            +--------------------+
                                       │
                ┌──────────────────────┼──────────────────────┐
   Path: /api/users/* │     Path: /api/products/* │    Path: /api/orders/*│
                ▼                      ▼                      ▼
       +------------------+   +------------------+   +------------------+
       |   User Service   |   | Product Service  |   |  Order Service   |
       |   (Port 3001)    |   |   (Port 3002)    |   |   (Port 3003)    |
       +------------------+   +------------------+   +------------------+
                │                      │                      │
                └──────────────────────┼──────────────────────┘
                                       │
                                       ▼
                              +-----------------+
                              | PostgreSQL/Redis|
                              +-----------------+
```

---

## 🔥 Key Engineering Features

### 🚀 1. High-Performance Reverse Proxy Engine
- Built on `Undici` HTTP/1.1 agent with socket connection pooling.
- Supports full-duplex request streaming with `AbortController` timeout handling (`504 Gateway Timeout`).
- RFC 2616 Hop-by-Hop header sanitization and automatic `X-Forwarded-For`, `X-Forwarded-Host`, and `X-Forwarded-Proto` header injection.

### 🛤️ 2. Dynamic Route Registry & Admin Control Plane
- In-memory longest-prefix matching algorithm (`RouteRegistry`).
- Dynamic runtime CRUD REST API (`/admin/routes`) to create, read, update, and delete routes without restarting the gateway server.
- Automatic path prefix stripping and HTTP method enforcement (`405 Method Not Allowed`).

### 🔑 3. Multi-Strategy Edge Authentication
- Per-route authentication strategies (`none`, `jwt`, `apiKey`, `any`).
- JWT verification (`jsonwebtoken`) and SHA-256 hashed API key management stored in PostgreSQL with in-memory caching.
- Context propagation injecting trusted identity headers (`X-User-Id`, `X-Consumer-Id`) downstream.

### ⚡ 4. Redis Distributed Rate Limiting
- Atomic Redis Lua scripts implementing Sorted Set (`ZSET`) sliding window and fixed window algorithms.
- Configurable rate-limit keys (per-IP, per-user, or per-consumer).
- Standard RFC headers (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, `Retry-After`) with zero-downtime in-memory fallback.

### ⚖️ 5. Layer 7 Load Balancing & Active Health Checks
- Round Robin and Least Connections selection algorithms across upstream target pools.
- Active background HTTP health check polling (`ActiveHealthChecker`) that automatically isolates degraded target nodes.

### 🛡️ 6. Circuit Breaker & Exponential Backoff Retries
- Three-state machine (`CLOSED`, `OPEN`, `HALF_OPEN`) with fast-fail `503` protection during target service outages.
- Exponential backoff retries with **Full Jitter** for idempotent HTTP methods (`GET`, `PUT`, `DELETE`), preventing thundering herd spikes.

### 📊 7. Distributed Observability & Prometheus Metrics
- End-to-end distributed correlation tracing via `X-Request-ID` and `X-Correlation-ID`.
- Pino JSON structured logging enriched with request metadata.
- Scrapable Prometheus metrics endpoint (`GET /metrics`) tracking HTTP request counters, latency histograms, and circuit breaker state gauges.

### 🎛️ 8. Interactive Real-Time Dashboard UI
- Integrated web dashboard hosted at `http://localhost:8000/`.
- Features real-time microservices health status matrix, interactive REST API explorer, dynamic route table viewer, and Prometheus metrics visualizer.

---

## 🛠️ Tech Stack

- **Runtime & Language**: Node.js (ESM)
- **Framework**: Express.js
- **Database**: PostgreSQL (`pg`)
- **Cache**: Redis (`ioredis`)
- **HTTP Engine**: Undici (`undici`)
- **Validation & Security**: Zod, Helmet, CORS, jsonwebtoken
- **Logging & Metrics**: Pino, Pino-HTTP, prom-client
- **Containerization**: Docker, Docker Compose
- **Testing**: Jest, Supertest, Autocannon

---

## 🚀 Quick Start Guide

### Option 1: Full Docker Compose Setup (Recommended)

Run the API Gateway, Redis, PostgreSQL, and all 3 microservices with a single command:

```bash
docker-compose up --build
```

Access Points:
- **API Gateway & Dashboard**: `http://localhost:8000`
- **User Microservice**: `http://localhost:3001`
- **Product Microservice**: `http://localhost:3002`
- **Order Microservice**: `http://localhost:3003`

### Option 2: Local Development Setup

1. **Install Dependencies**:
   ```bash
   npm install
   cd services/user-service && npm install && cd ../..
   cd services/product-service && npm install && cd ../..
   cd services/order-service && npm install && cd ../..
   ```

2. **Run Microservices (In Separate Terminals)**:
   ```bash
   node services/user-service/src/server.js
   node services/product-service/src/server.js
   node services/order-service/src/server.js
   ```

3. **Start API Gateway**:
   ```bash
   npm run dev
   ```

---

## 🧪 Testing & Verification

### Run Automated Unit & Integration Tests (36 Tests / 9 Suites)
```bash
npm test
```

### Run Performance Load Benchmark (Autocannon)
```bash
npm run benchmark
```

---

## 📌 API Reference

| Method | Endpoint | Description | Auth Required |
| --- | --- | --- | --- |
| `GET` | `/` | Web Control Plane Dashboard UI | No |
| `GET` | `/health/liveness` | Gateway process liveness probe | No |
| `GET` | `/health/readiness` | Database & Redis readiness probe | No |
| `GET` | `/metrics` | Scrapable Prometheus metrics | No |
| `GET` | `/admin/routes` | Get all registered routes | Admin |
| `POST` | `/admin/routes` | Create new runtime route | Admin |
| `GET` | `/api/users/*` | Proxied to User Microservice | Dynamic |
| `GET` | `/api/products/*` | Proxied to Product Microservice | Dynamic |
| `GET` | `/api/orders/*` | Proxied to Order Microservice | Dynamic |

---

 
