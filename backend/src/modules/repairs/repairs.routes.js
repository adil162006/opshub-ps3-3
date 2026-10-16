import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  addRepairPartHandler,
  createRepairHandler,
  deleteRepairHandler,
  getRepairHandler,
  listRepairsHandler,
  removeRepairPartHandler,
  updateRepairHandler,
} from './repairs.controller.js';

const router = Router();

// Routes matching /api/sites/:siteId/repairs (standard backend module convention)
router.get('/sites/:siteId/repairs', requireAuth, listRepairsHandler);
router.get('/sites/:siteId/repairs/:id', requireAuth, getRepairHandler);
router.post('/sites/:siteId/repairs', requireAuth, createRepairHandler);
router.put('/sites/:siteId/repairs/:id', requireAuth, updateRepairHandler);
router.delete('/sites/:siteId/repairs/:id', requireAuth, deleteRepairHandler);
router.post('/sites/:siteId/repairs/:id/parts', requireAuth, addRepairPartHandler);
router.delete('/sites/:siteId/repairs/:id/parts/:partId', requireAuth, removeRepairPartHandler);

// Routes matching /api/:siteId/repairs (AGENTS.md and catalogue specification)
router.get('/:siteId/repairs', requireAuth, listRepairsHandler);
router.get('/:siteId/repairs/:id', requireAuth, getRepairHandler);
router.post('/:siteId/repairs', requireAuth, createRepairHandler);
router.put('/:siteId/repairs/:id', requireAuth, updateRepairHandler);
router.delete('/:siteId/repairs/:id', requireAuth, deleteRepairHandler);
router.post('/:siteId/repairs/:id/parts', requireAuth, addRepairPartHandler);
router.delete('/:siteId/repairs/:id/parts/:partId', requireAuth, removeRepairPartHandler);

export default router;
