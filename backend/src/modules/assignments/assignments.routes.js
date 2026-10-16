import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  listAssignmentsHandler,
  getAssignmentHandler,
  createAssignmentHandler,
  updateAssignmentHandler,
} from './assignments.controller.js';

const router = Router();

for (const prefix of ['/:siteId', '/sites/:siteId']) {
  router.get(`${prefix}/assignments`, requireAuth, listAssignmentsHandler);
  router.get(`${prefix}/assignments/:id`, requireAuth, getAssignmentHandler);
  router.post(`${prefix}/assignments`, requireAuth, createAssignmentHandler);
  router.put(`${prefix}/assignments/:id`, requireAuth, updateAssignmentHandler);
}

export default router;
