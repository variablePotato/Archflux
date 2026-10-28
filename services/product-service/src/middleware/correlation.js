export const correlationMiddleware = (req, res, next) => {
  req.id = req.headers['x-request-id'] || `prod-req-${Date.now()}`;
  req.correlationId = req.headers['x-correlation-id'] || req.id;

  res.setHeader('X-Request-ID', req.id);
  res.setHeader('X-Correlation-ID', req.correlationId);

  next();
};
