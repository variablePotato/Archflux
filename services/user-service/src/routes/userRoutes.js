import { Router } from 'express';
import { logger } from '../core/logger.js';

const router = Router();

// In-memory lightweight user storage
const users = [
  { id: '1', name: 'Alice Smith', email: 'alice@example.com', role: 'admin' },
  { id: '2', name: 'Bob Jones', email: 'bob@example.com', role: 'user' },
];

router.get('/', (req, res) => {
  logger.info({ correlationId: req.correlationId }, 'Fetching all users');
  res.json({
    success: true,
    service: 'user-service',
    data: users,
  });
});

router.get('/:id', (req, res) => {
  const user = users.find((u) => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, error: { message: 'User not found' } });
  }
  res.json({
    success: true,
    service: 'user-service',
    data: user,
  });
});

router.post('/', (req, res) => {
  const { name, email, role } = req.body;
  const newUser = {
    id: String(users.length + 1),
    name: name || 'New User',
    email: email || 'user@example.com',
    role: role || 'user',
  };
  users.push(newUser);

  logger.info({ correlationId: req.correlationId, userId: newUser.id }, 'Created new user');
  res.status(201).json({
    success: true,
    service: 'user-service',
    data: newUser,
  });
});

export default router;
