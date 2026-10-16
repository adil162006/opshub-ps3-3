import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  listAssignmentsHandler,
  getAssignmentHandler,
  createAssignmentHandler,
  updateAssignmentHandler,
} from './assignments.controller.js';

const router = Router();

router.get('/sites/:siteId/assignments', requireAuth, listAssignmentsHandler);
router.get('/sites/:siteId/assignments/:id', requireAuth, getAssignmentHandler);
router.post('/sites/:siteId/assignments', requireAuth, createAssignmentHandler);
router.put('/sites/:siteId/assignments/:id', requireAuth, updateAssignmentHandler);

export default router;
