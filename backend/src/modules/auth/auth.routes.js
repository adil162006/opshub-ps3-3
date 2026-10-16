import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getMeController, loginGlobalAdminController, loginUserController } from './auth.controller.js';

const router = Router();

// Regular site users authenticate here. Their response includes their site roles.
router.post('/auth/login', loginUserController);
// Postman: POST /api/auth/global-admin/login with { "email": "...", "password": "..." }
router.post('/auth/global-admin/login', loginGlobalAdminController);
router.get('/auth/me', requireAuth, getMeController);

export default router;
