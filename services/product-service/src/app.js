import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { correlationMiddleware } from './middleware/correlation.js';
import productRoutes from './routes/productRoutes.js';

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(correlationMiddleware);

  app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'product-service', timestamp: new Date().toISOString() });
  });

  app.use('/products', productRoutes);

  app.use('*', (req, res) => {
    res.status(404).json({ success: false, error: { message: `Route ${req.originalUrl} not found on product-service` } });
  });

  return app;
};
