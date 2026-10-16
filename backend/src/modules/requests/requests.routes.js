import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  createRequestHandler,
  deleteRequestHandler,
  getRequestHandler,
  listRequestsHandler,
  updateRequestHandler,
} from './requests.controller.js';

const router = Router();

// Routes matching /api/sites/:siteId/requests (standard backend convention)
router.get('/sites/:siteId/requests', requireAuth, listRequestsHandler);
router.get('/sites/:siteId/requests/:id', requireAuth, getRequestHandler);
router.post('/sites/:siteId/requests', requireAuth, createRequestHandler);
router.put('/sites/:siteId/requests/:id', requireAuth, updateRequestHandler);
router.delete('/sites/:siteId/requests/:id', requireAuth, deleteRequestHandler);

// Routes matching /api/:siteId/requests (AGENTS.md / frontend compatibility)
router.get('/:siteId/requests', requireAuth, listRequestsHandler);
router.get('/:siteId/requests/:id', requireAuth, getRequestHandler);
router.post('/:siteId/requests', requireAuth, createRequestHandler);
router.put('/:siteId/requests/:id', requireAuth, updateRequestHandler);
router.delete('/:siteId/requests/:id', requireAuth, deleteRequestHandler);

export default router;
