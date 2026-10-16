import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
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

router.route('/users').get(requireAuth, getUsers).post(requireAuth, postUser);
router.route('/users/:userId').put(requireAuth, putUser).patch(requireAuth, putUser).delete(requireAuth, deleteUser);
router.route('/:siteId/members').get(requireAuth, getSiteUsers).post(requireAuth, postSiteUser);
router.route('/:siteId/members/:userId').put(requireAuth, putSiteUser).delete(requireAuth, deleteSiteUser);

export default router;
