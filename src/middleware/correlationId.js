import crypto from 'crypto';

export const correlationIdMiddleware = (req, res, next) => {
  const requestId = req.headers['x-request-id'] || `req-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const correlationId = req.headers['x-correlation-id'] || requestId;

  req.id = requestId;
  req.correlationId = correlationId;

  // Set response headers for client tracing
  res.setHeader('X-Request-ID', requestId);
  res.setHeader('X-Correlation-ID', correlationId);

  // Set request headers for upstream tracing
  req.headers['x-request-id'] = requestId;
  req.headers['x-correlation-id'] = correlationId;

  next();
};
