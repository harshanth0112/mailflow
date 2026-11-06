import express from 'express';
import * as authController from '../controllers/authController.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  authLimiter,
  loginLimiter,
  passwordResetLimiter,
} from '../middleware/rateLimiter.js';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
} from '../validators/authValidators.js';

const router = express.Router();

// Public Authentication Endpoints
router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  authController.register
);

router.post(
  '/login',
  loginLimiter,
  validate(loginSchema),
  authController.login
);

router.post(
  '/verify-email',
  authLimiter,
  validate(verifyEmailSchema),
  authController.verifyEmail
);

router.post(
  '/resend-verification',
  authLimiter,
  validate(resendVerificationSchema),
  authController.resendVerification
);

router.post(
  '/forgot-password',
  passwordResetLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword
);

router.post(
  '/reset-password',
  passwordResetLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword
);

router.post(
  '/refresh',
  authController.refreshToken
);

router.post(
  '/logout',
  authController.logout
);

// OAuth status & integration check
router.get(
  '/oauth/status',
  authController.getOAuthStatus
);

// Protected Authentication Endpoints (Requires valid JWT Access Token)
router.get(
  '/me',
  requireAuth,
  authController.getProfile
);

router.patch(
  '/me',
  requireAuth,
  validate(updateProfileSchema),
  authController.updateProfile
);

router.post(
  '/change-password',
  requireAuth,
  validate(changePasswordSchema),
  authController.changePassword
);

export default router;

