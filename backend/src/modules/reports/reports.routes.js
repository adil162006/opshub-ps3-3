import express, { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { exportReport, importInventoryWorkbook } from './reports.controller.js';

const router = Router();
const workbookBody = express.raw({
  type: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream',
  ],
  limit: '5mb',
});

router.get('/:siteId/export/:resource', requireAuth, exportReport);
router.post('/:siteId/import/inventory', requireAuth, workbookBody, importInventoryWorkbook);

export default router;
