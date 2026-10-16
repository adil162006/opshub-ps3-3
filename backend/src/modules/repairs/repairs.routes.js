import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { createRepairHandler, deleteRepairHandler, listRepairsHandler, updateRepairHandler } from './repairs.controller.js';

const router = Router();
for (const prefix of ['/:siteId', '/sites/:siteId']) {
  router.get(`${prefix}/repairs`, requireAuth, listRepairsHandler);
  router.post(`${prefix}/repairs`, requireAuth, createRepairHandler);
  router.put(`${prefix}/repairs/:id`, requireAuth, updateRepairHandler);
  router.delete(`${prefix}/repairs/:id`, requireAuth, deleteRepairHandler);
}
export default router;
