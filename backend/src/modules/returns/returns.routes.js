import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { createReturnHandler, listReturnsHandler } from './returns.controller.js';

const router = Router();
router.get('/:siteId/returns', requireAuth, listReturnsHandler);
router.post('/:siteId/returns', requireAuth, createReturnHandler);
router.get('/sites/:siteId/returns', requireAuth, listReturnsHandler);
router.post('/sites/:siteId/returns', requireAuth, createReturnHandler);
export default router;
