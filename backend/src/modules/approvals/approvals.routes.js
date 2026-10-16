import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { decideApprovalHandler, listApprovalsHandler } from './approvals.controller.js';

const router = Router();
router.get('/:siteId/approvals', requireAuth, listApprovalsHandler);
router.post('/:siteId/approvals', requireAuth, decideApprovalHandler);
router.get('/sites/:siteId/approvals', requireAuth, listApprovalsHandler);
router.post('/sites/:siteId/approvals', requireAuth, decideApprovalHandler);
export default router;
