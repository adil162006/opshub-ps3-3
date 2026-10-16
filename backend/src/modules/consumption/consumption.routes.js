import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { listConsumptionHandler, recordConsumptionHandler } from './consumption.controller.js';

const router = Router();

for (const prefix of ['/:siteId', '/sites/:siteId']) {
  router.get(`${prefix}/consumption`, requireAuth, listConsumptionHandler);
  router.post(`${prefix}/consumption`, requireAuth, recordConsumptionHandler);
}

export default router;
