import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getRequests, postRequest, putRequest, removeRequest } from './requests.controller.js';

const router = Router();
router.route('/:siteId/requests').get(requireAuth, getRequests).post(requireAuth, postRequest);
router.route('/:siteId/requests/:id').put(requireAuth, putRequest).delete(requireAuth, removeRequest);

export default router;
