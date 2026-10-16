import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getApprovals, postApproval } from './approvals.controller.js';

const router = Router();
router.route('/:siteId/approvals').get(requireAuth, getApprovals).post(requireAuth, postApproval);

export default router;
