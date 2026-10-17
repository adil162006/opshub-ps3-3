import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireGlobalAdmin } from '../../middleware/rbac.js';
import {
  deleteSiteUser,
  deleteUser,
  getSiteUsers,
  getUsers,
  postSiteUser,
  postUser,
  putSiteUser,
  putUser,
} from './users.controller.js';

const router = Router();

router.route('/users').get(requireAuth, requireGlobalAdmin, getUsers).post(requireAuth, requireGlobalAdmin, postUser);
router.route('/users/:userId').put(requireAuth, requireGlobalAdmin, putUser).patch(requireAuth, requireGlobalAdmin, putUser).delete(requireAuth, requireGlobalAdmin, deleteUser);
router.route('/:siteId/members').get(requireAuth, getSiteUsers).post(requireAuth, requireGlobalAdmin, postSiteUser);
router.route('/:siteId/members/:userId').put(requireAuth, putSiteUser).patch(requireAuth, putSiteUser).delete(requireAuth, deleteSiteUser);

export default router;
