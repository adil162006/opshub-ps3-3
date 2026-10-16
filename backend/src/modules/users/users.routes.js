import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getSiteUsers, getUsers, postSiteUser, postUser } from './users.controller.js';

const router = Router();
router.route('/users').get(requireAuth, getUsers).post(requireAuth, postUser);
router.route('/:siteId/members').get(requireAuth, getSiteUsers).post(requireAuth, postSiteUser);

export default router;
