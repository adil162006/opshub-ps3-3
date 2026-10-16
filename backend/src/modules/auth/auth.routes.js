import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getMeController, loginGlobalAdminController } from './auth.controller.js';

const router = Router();

// Postman: POST /api/auth/global-admin/login with { "email": "...", "password": "..." }
router.post('/auth/global-admin/login', loginGlobalAdminController);
router.get('/auth/me', requireAuth, getMeController);

export default router;
