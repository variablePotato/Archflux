import { Router } from 'express';
import { logger } from '../core/logger.js';

const router = Router();

const products = [
  { id: '101', name: 'MacBook Pro 16"', price: 2499.99, stock: 15 },
  { id: '102', name: 'iPhone 15 Pro', price: 999.99, stock: 42 },
  { id: '103', name: 'AirPods Pro', price: 249.99, stock: 100 },
];

router.get('/', (req, res) => {
  logger.info({ correlationId: req.correlationId }, 'Fetching catalog products');
  res.json({
    success: true,
    service: 'product-service',
    data: products,
  });
});

router.get('/:id', (req, res) => {
  const product = products.find((p) => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, error: { message: 'Product not found' } });
  }
  res.json({
    success: true,
    service: 'product-service',
    data: product,
  });
});

router.post('/', (req, res) => {
  const { name, price, stock } = req.body;
  const newProduct = {
    id: String(products.length + 101),
    name: name || 'Wireless Mouse',
    price: price || 49.99,
    stock: stock || 50,
  };
  products.push(newProduct);

  logger.info({ correlationId: req.correlationId, productId: newProduct.id }, 'Created product');
  res.status(201).json({
    success: true,
    service: 'product-service',
    data: newProduct,
  });
});

export default router;
