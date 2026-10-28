import { metricsService } from './metricsService.js';

export const metricsMiddleware = (req, res, next) => {
  const startTime = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(startTime);
    const durationSeconds = diff[0] + diff[1] / 1e9;

    const routeId = req.routeConfig?.id || 'unmapped';
    metricsService.recordRequest(req.method, routeId, res.statusCode, durationSeconds);
  });

  next();
};
