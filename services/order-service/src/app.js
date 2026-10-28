import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { correlationMiddleware } from './middleware/correlation.js';
import orderRoutes from './routes/orderRoutes.js';

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(correlationMiddleware);

  app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'order-service', timestamp: new Date().toISOString() });
  });

  app.use('/orders', orderRoutes);

  app.use('*', (req, res) => {
    res.status(404).json({ success: false, error: { message: `Route ${req.originalUrl} not found on order-service` } });
  });

  return app;
};
