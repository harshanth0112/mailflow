import express from 'express';
import { emailAccountController } from '../controllers/emailAccountController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  requireWorkspace,
  requireWorkspacePermission,
  requireAnyWorkspacePermission,
} from '../middleware/workspaceMiddleware.js';
import { PERMISSIONS } from '../config/roles.js';

const router = express.Router();

router.use(requireAuth);
router.use(requireWorkspace);

// List supported providers and status
router.get(
  '/providers',
  requireAnyWorkspacePermission(PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.CAMPAIGNS_READ),
  emailAccountController.getProviders
);

// List connected accounts (accessible to admins or campaign managers to select senders)
router.get(
  '/',
  requireAnyWorkspacePermission(PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.CAMPAIGNS_READ),
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

