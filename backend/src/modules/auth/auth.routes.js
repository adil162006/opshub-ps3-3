import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  getMeController,
  loginController,
  logoutController,
  signupGlobalAdminController,
  verifyPhoneOtpController,
} from './auth.controller.js';

const router = Router();

// All account types authenticate through this endpoint.
router.post('/auth/login', loginController);
router.post('/auth/otp/verify', verifyPhoneOtpController);
router.post('/auth/global-admin/signup', signupGlobalAdminController);
router.post('/auth/logout', logoutController);
router.get('/auth/me', requireAuth, getMeController);

export default router;
