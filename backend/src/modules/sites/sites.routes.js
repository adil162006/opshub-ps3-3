import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireGlobalAdmin } from '../../middleware/rbac.js';
import { createSiteHandler, deleteSiteHandler, getSiteHandler, listSitesHandler, publishHandler, rollbackHandler, saveDraftHandler } from './sites.controller.js';

const router = Router();
router.get('/sites', requireAuth, listSitesHandler);
router.post('/sites', requireAuth, createSiteHandler);
router.delete('/sites/:siteId', requireAuth, requireGlobalAdmin, deleteSiteHandler);
router.get('/sites/:siteId', requireAuth, getSiteHandler);
router.put('/sites/:siteId/draft', requireAuth, saveDraftHandler);
router.post('/sites/:siteId/publish', requireAuth, publishHandler);
router.post('/sites/:siteId/rollback', requireAuth, rollbackHandler);

export default router;
