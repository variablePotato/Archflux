document.addEventListener('DOMContentLoaded', () => {
  // Tab Navigation Setup
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');
  const tabTitle = document.getElementById('tab-title');
  const tabSubtitle = document.getElementById('tab-subtitle');

  const tabMeta = {
    overview: { title: 'System Overview', sub: 'Real-time telemetry and microservices execution matrix' },
    services: { title: 'Microservices Mesh', sub: 'Health status and telemetry for active downstream services' },
    explorer: { title: 'Interactive API Explorer', sub: 'Test live request routing through the API Gateway' },
    routes: { title: 'Route Manager', sub: 'Dynamic Gateway route registry and path mapping table' },
    metrics: { title: 'Prometheus Metrics', sub: 'Scrapable metric registry and histogram data' },
  };

  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      const targetTab = item.dataset.tab;
      navItems.forEach((n) => n.classList.remove('active'));
      tabContents.forEach((tc) => tc.classList.remove('active'));

      item.classList.add('active');
      document.getElementById(`tab-${targetTab}`).classList.add('active');

      if (tabMeta[targetTab]) {
        tabTitle.textContent = tabMeta[targetTab].title;
        tabSubtitle.textContent = tabMeta[targetTab].sub;
      }

      if (targetTab === 'routes') loadRoutesTable();
      if (targetTab === 'services') fetchMicroserviceHealth();
      if (targetTab === 'metrics') fetchMetricsData();
    });
  });

  // Services Health Check Data
  const microservices = [
    { name: 'User Microservice', url: '/api/users/users', healthUrl: 'http://localhost:3001/health', port: 3001 },
    { name: 'Product Microservice', url: '/api/products/products', healthUrl: 'http://localhost:3002/health', port: 3002 },
    { name: 'Order Microservice', url: '/api/orders/orders', healthUrl: 'http://localhost:3003/health', port: 3003 },
  ];

  async function fetchMicroserviceHealth() {
    const quickGrid = document.getElementById('quick-services-grid');
    const fullGrid = document.getElementById('full-services-grid');

    let healthyCount = 0;
    let cardsHtml = '';

    for (const s of microservices) {
      const startTime = performance.now();
      let status = 'HEALTHY';
      let latency = 0;

      try {
        const res = await fetch(s.url, { method: 'GET' });
        latency = Math.round(performance.now() - startTime);
        if (res.ok) {
          healthyCount++;
        } else {
          status = 'DOWN';
        }
      } catch (err) {
        status = 'DOWN';
      }

      cardsHtml += `
        <div class="service-card">
          <div class="service-card-header">
            <span class="service-name">${s.name}</span>
            <span class="${status === 'HEALTHY' ? 'badge-healthy' : 'badge-down'}">${status}</span>
          </div>
          <div class="service-meta-row">
            <span>Target Port:</span>
            <strong>:${s.port}</strong>
          </div>
          <div class="service-meta-row">
            <span>Response Latency:</span>
            <strong>${latency}ms</strong>
          </div>
          <div class="service-meta-row">
            <span>Route Prefix:</span>
            <code>${s.url.split('/')[2] ? '/api/' + s.url.split('/')[2] : ''}</code>
          </div>
        </div>
      `;
    }

    if (quickGrid) quickGrid.innerHTML = cardsHtml;
    if (fullGrid) fullGrid.innerHTML = cardsHtml;

    const activeElem = document.getElementById('stat-active-services');
    if (activeElem) activeElem.textContent = `${healthyCount} / ${microservices.length}`;

    document.getElementById('last-updated').textContent = `Updated: ${new Date().toLocaleTimeString()}`;
  }

  // API Explorer Functionality
  const btnSendReq = document.getElementById('btn-send-req');
  const reqUrl = document.getElementById('req-url');
  const reqMethod = document.getElementById('req-method');
  const resStatusBadge = document.getElementById('res-status-badge');
  const resTimeBadge = document.getElementById('res-time-badge');
  const resHeadersBox = document.getElementById('res-headers-box');
  const resJsonDisplay = document.getElementById('res-json-display');

  btnSendReq.addEventListener('click', sendTestRequest);

  async function sendTestRequest() {
    const method = reqMethod.value;
    const url = reqUrl.value.trim();

    resStatusBadge.textContent = 'Status: Requesting...';
    resStatusBadge.className = 'res-status';

    const startTime = performance.now();

    try {
      const options = { method, headers: { 'Content-Type': 'application/json' } };
      if (method === 'POST') {
        options.body = JSON.stringify({ name: 'Explorer Product', price: 149.99, stock: 10 });
      }

      const res = await fetch(url, options);
      const elapsed = Math.round(performance.now() - startTime);

      resStatusBadge.textContent = `Status: ${res.status} ${res.statusText}`;
      resStatusBadge.style.color = res.ok ? 'var(--success)' : 'var(--danger)';
      resTimeBadge.textContent = `Time: ${elapsed}ms`;

      // Extract tracing headers
      const reqId = res.headers.get('x-request-id') || 'N/A';
      const corrId = res.headers.get('x-correlation-id') || 'N/A';

      resHeadersBox.innerHTML = `
        <div><strong>X-Request-ID:</strong> ${reqId}</div>
        <div><strong>X-Correlation-ID:</strong> ${corrId}</div>
      `;

      const json = await res.json();
      resJsonDisplay.textContent = JSON.stringify(json, null, 2);
    } catch (err) {
      resStatusBadge.textContent = 'Status: Network Error / CORS';
      resStatusBadge.style.color = 'var(--danger)';
      resJsonDisplay.textContent = JSON.stringify({ error: err.message }, null, 2);
    }
  }

  // Quick Preset Buttons
  document.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      reqUrl.value = btn.dataset.url;
      reqMethod.value = btn.dataset.method;
      sendTestRequest();
    });
  });

  // Load Routes Table
  async function loadRoutesTable() {
    const tbody = document.getElementById('routes-table-body');
    tbody.innerHTML = '<tr><td colspan="7">Loading gateway routes...</td></tr>';

    try {
      const res = await fetch('/admin/routes');
      const data = await res.json();

      if (data.success && Array.isArray(data.data)) {
        let html = '';
        data.data.forEach((r) => {
          html += `
            <tr>
              <td><strong>${r.id}</strong></td>
              <td><code>${r.pathPrefix}</code></td>
              <td><code>${r.targetUrl}</code></td>
              <td>${r.stripPrefix ? '✅ True' : '❌ False'}</td>
              <td><span class="badge-healthy">${r.authStrategy}</span></td>
              <td>${r.rateLimit?.enabled ? `${r.rateLimit.maxRequests} req / ${r.rateLimit.windowSeconds}s` : 'Disabled'}</td>
              <td><span class="badge-healthy">ACTIVE</span></td>
            </tr>
          `;
        });
        tbody.innerHTML = html;
      }
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" style="color:var(--danger)">Failed to load routes: ${err.message}</td></tr>`;
    }
  }

  // Prometheus Metrics Fetcher
  async function fetchMetricsData() {
    const display = document.getElementById('raw-metrics-display');
    display.textContent = 'Fetching /metrics...';

    try {
      const res = await fetch('/metrics');
      const text = await res.text();
      display.textContent = text;
    } catch (err) {
      display.textContent = `Error fetching metrics: ${err.message}`;
    }
  }

  document.getElementById('btn-refresh').addEventListener('click', fetchMicroserviceHealth);
  document.getElementById('btn-reload-routes').addEventListener('click', loadRoutesTable);
  document.getElementById('btn-fetch-metrics').addEventListener('click', fetchMetricsData);

  // Initial Auto Health Poll
  fetchMicroserviceHealth();
  setInterval(fetchMicroserviceHealth, 15000);
});
