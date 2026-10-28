import { Router } from 'express';
import { logger } from '../core/logger.js';

const router = Router();

const orders = [
  { id: '5001', userId: '1', items: [{ productId: '101', quantity: 1 }], total: 2499.99, status: 'DELIVERED' },
  { id: '5002', userId: '2', items: [{ productId: '103', quantity: 2 }], total: 499.98, status: 'PROCESSING' },
];

router.get('/', (req, res) => {
  logger.info({ correlationId: req.correlationId }, 'Fetching user orders');
  res.json({
    success: true,
    service: 'order-service',
    data: orders,
  });
});

router.get('/:id', (req, res) => {
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, error: { message: 'Order not found' } });
  }
  res.json({
    success: true,
    service: 'order-service',
    data: order,
  });
});

router.post('/', (req, res) => {
  const { userId, items, total } = req.body;
  const newOrder = {
    id: String(orders.length + 5001),
    userId: userId || req.headers['x-user-id'] || '1',
    items: items || [{ productId: '102', quantity: 1 }],
    total: total || 999.99,
    status: 'PLACED',
  };
  orders.push(newOrder);

  logger.info({ correlationId: req.correlationId, orderId: newOrder.id }, 'Created order');
  res.status(201).json({
    success: true,
    service: 'order-service',
    data: newOrder,
  });
});

export default router;
