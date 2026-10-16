import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  getSetupStatus,
  setupFirstAdmin,
  login,
  me,
} from './auth.controller.js';

const router = Router();

// Public setup endpoints
router.get('/auth/setup-status', getSetupStatus);
router.post('/auth/setup-admin', setupFirstAdmin);

// Standard auth endpoints
router.post('/auth/login', login);
router.get('/auth/me', requireAuth, me);

export default router;
