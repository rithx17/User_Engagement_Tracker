import { Router } from 'express';
import {
  exportEventsCsv,
  generateDemoData,
  getEvents,
  getOverview,
  getUsers
} from '../controllers/analyticsController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Dashboard analytics for authenticated users.
router.get('/overview', requireAuth, getOverview);
router.get('/events', requireAuth, getEvents);

// Admin-only analytics management endpoints.
router.get('/users', requireAuth, requireRole('admin'), getUsers);
router.get('/export', requireAuth, requireRole('admin'), exportEventsCsv);
router.post('/generate-demo-data', requireAuth, requireRole('admin'), generateDemoData);

export default router;
