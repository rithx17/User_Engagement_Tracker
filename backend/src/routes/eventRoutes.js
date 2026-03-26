import { Router } from 'express';
import { trackEvent } from '../controllers/eventsController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

router.post('/track', optionalAuth, trackEvent);

export default router;
