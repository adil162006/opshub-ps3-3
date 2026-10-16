import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { listConsumptionHandler, recordConsumptionHandler } from './consumption.controller.js';

const router = Router();

router.get('/sites/:siteId/consumption', requireAuth, listConsumptionHandler);
router.post('/sites/:siteId/consumption', requireAuth, recordConsumptionHandler);

export default router;
