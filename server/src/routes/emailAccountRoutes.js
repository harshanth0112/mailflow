import express from 'express';
import { emailAccountController } from '../controllers/emailAccountController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireWorkspace, requireWorkspacePermission } from '../middleware/workspaceMiddleware.js';
import { PERMISSIONS } from '../config/roles.js';

const router = express.Router();

router.use(requireAuth);
router.use(requireWorkspace);

// List supported providers and status
router.get(
  '/providers',
  requireWorkspacePermission(PERMISSIONS.SETTINGS_MANAGE),
  emailAccountController.getProviders
);

// List connected accounts
router.get(
  '/',
  requireWorkspacePermission(PERMISSIONS.SETTINGS_MANAGE),
  emailAccountController.listAccounts
);

// OAuth initiate & callback
router.post(
  '/oauth/initiate',
  requireWorkspacePermission(PERMISSIONS.SETTINGS_MANAGE),
  emailAccountController.initiateOAuth
);
router.post(
  '/oauth/callback',
  requireWorkspacePermission(PERMISSIONS.SETTINGS_MANAGE),
  emailAccountController.handleOAuthCallback
);

// Disconnect
router.delete(
  '/:id',
  requireWorkspacePermission(PERMISSIONS.SETTINGS_MANAGE),
  emailAccountController.disconnectAccount
);

// Send test email
router.post(
  '/:id/test',
  requireWorkspacePermission(PERMISSIONS.SETTINGS_MANAGE),
  emailAccountController.sendTestEmail
);

export default router;

