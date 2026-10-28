import { request, Agent } from 'undici';
import { prepareProxyHeaders, sanitizeHeaders } from './headerUtils.js';
import { BadGatewayError, GatewayTimeoutError, ServiceUnavailableError } from '../core/errors.js';
import { logger } from '../core/logger.js';

// Shared Undici agent with high-throughput connection pool settings
const proxyAgent = new Agent({
  keepAliveTimeout: 10000,
  keepAliveMaxTimeout: 60000,
  connections: 100,
  pipelining: 1,
});

export class ProxyService {
  /**
   * Forward incoming HTTP request to upstream service target URL.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {string} targetUrl - Full target URL including path & query
   * @param {Object} options - Optional proxy options (e.g. timeoutMs)
   */
  async forward(req, res, targetUrl, options = {}) {
    const timeoutMs = options.timeoutMs || 5000;
    const { headers: proxyHeaders, requestId } = prepareProxyHeaders(req, targetUrl);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let body = undefined;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
      if (req.body && Object.keys(req.body).length > 0) {
        body = JSON.stringify(req.body);
      } else {
        body = req;
      }
    }

    try {
      logger.debug({ requestId, targetUrl, method: req.method }, 'Proxying request upstream');

      const response = await request(targetUrl, {
        method: req.method,
        headers: proxyHeaders,
        body,
        dispatcher: proxyAgent,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.statusCode >= 500 && options.throwOn5xx !== false) {
        if (response.statusCode === 504) {
          throw new GatewayTimeoutError(`Upstream service returned status 504`);
        }
        if (response.statusCode === 503) {
          throw new ServiceUnavailableError(`Upstream service returned status 503`);
        }
        throw new BadGatewayError(`Upstream service returned status ${response.statusCode}`);
      }

      const responseHeaders = sanitizeHeaders(response.headers);
      res.status(response.statusCode);

      for (const [key, value] of Object.entries(responseHeaders)) {
        if (value !== undefined) {
          res.setHeader(key, value);
        }
      }

      // Stream upstream response body directly to client res
      response.body.pipe(res);
    } catch (err) {
      clearTimeout(timer);

      if (err.name === 'AbortError' || err.code === 'UND_ERR_CONNECT_TIMEOUT') {
        logger.error({ err, targetUrl, requestId }, 'Upstream request timed out');
        throw new GatewayTimeoutError(`Upstream target ${targetUrl} timed out after ${timeoutMs}ms`);
      }

      if (
        err.code === 'ECONNREFUSED' ||
        err.code === 'ENOTFOUND' ||
        err.code === 'UND_ERR_SOCKET' ||
        err.code === 'UND_ERR_HEADERS_TIMEOUT'
      ) {
        logger.error({ err, targetUrl, requestId }, 'Upstream connection failed');
        throw new BadGatewayError(`Failed to connect to upstream service at ${targetUrl}`);
      }

      logger.error({ err, targetUrl, requestId }, 'Unexpected error during proxy forwarding');
      throw new BadGatewayError(`Proxy error when reaching ${targetUrl}: ${err.message}`);
    }
  }
}

export const proxyService = new ProxyService();
