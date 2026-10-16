import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireGlobalAdmin } from '../../middleware/rbac.js';
import {
  getUsers,
  postUser,
  patchUserRole,
  patchUserStatus,
} from './users.controller.js';

const router = Router();

// All user management routes require Global Admin authentication
router.use(requireAuth, requireGlobalAdmin);

router.get('/users', getUsers);
router.post('/users', postUser);
router.patch('/users/:id', patchUserRole);
router.patch('/users/:id/role', patchUserRole);
router.patch('/users/:id/status', patchUserStatus);

export default router;
