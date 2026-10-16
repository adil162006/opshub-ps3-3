import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { createRequestHandler, deleteRequestHandler, listRequestsHandler, updateRequestHandler } from './requests.controller.js';

const router = Router();
for (const prefix of ['/:siteId', '/sites/:siteId']) {
  router.get(`${prefix}/requests`, requireAuth, listRequestsHandler);
  router.post(`${prefix}/requests`, requireAuth, createRequestHandler);
  router.put(`${prefix}/requests/:id`, requireAuth, updateRequestHandler);
  router.delete(`${prefix}/requests/:id`, requireAuth, deleteRequestHandler);
}
export default router;
