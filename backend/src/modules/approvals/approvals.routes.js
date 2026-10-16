import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  createApprovalHandler,
  getApprovalHandler,
  listApprovalsHandler,
} from './approvals.controller.js';

const router = Router();

// Routes matching /api/sites/:siteId/approvals (standard backend convention)
router.get('/sites/:siteId/approvals', requireAuth, listApprovalsHandler);
router.get('/sites/:siteId/approvals/:id', requireAuth, getApprovalHandler);
router.post('/sites/:siteId/approvals', requireAuth, createApprovalHandler);

// Routes matching /api/:siteId/approvals (AGENTS.md / frontend compatibility)
router.get('/:siteId/approvals', requireAuth, listApprovalsHandler);
router.get('/:siteId/approvals/:id', requireAuth, getApprovalHandler);
router.post('/:siteId/approvals', requireAuth, createApprovalHandler);

export default router;
