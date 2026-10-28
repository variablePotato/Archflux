import pinoHttp from 'pino-http';
import { logger } from '../core/logger.js';
import { env } from '../config/env.js';

export const requestLogger = pinoHttp({
  logger,
  customLogLevel(req, res, err) {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage(req, res) {
    return `${req.method} ${req.url} completed with status ${res.statusCode}`;
  },
  customErrorMessage(req, res, err) {
    return `${req.method} ${req.url} failed with status ${res.statusCode}: ${err.message}`;
  },
  serializers: {
    req(req) {
      return {
        id: req.id,
        method: req.method,
        url: req.url,
        query: req.query,
        headers: {
          host: req.headers.host,
          'user-agent': req.headers['user-agent'],
          'x-forwarded-for': req.headers['x-forwarded-for'],
        },
      };
    },
    res(res) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
});
