export const correlationMiddleware = (req, res, next) => {
  req.id = req.headers['x-request-id'] || `user-req-${Date.now()}`;
  req.correlationId = req.headers['x-correlation-id'] || req.id;
  req.userIdContext = req.headers['x-user-id'] || null;

  res.setHeader('X-Request-ID', req.id);
  res.setHeader('X-Correlation-ID', req.correlationId);

  next();
};
