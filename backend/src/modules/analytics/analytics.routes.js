import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getAnalytics } from './analytics.controller.js';

const router = Router();
router.get('/sites/:siteId/analytics', requireAuth, getAnalytics);

export default router;
