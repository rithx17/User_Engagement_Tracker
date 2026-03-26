import { Router } from 'express';
import { listUsers } from '../controllers/adminController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/users', requireAuth, requireRole('admin'), listUsers);

export default router;
