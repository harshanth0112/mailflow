import express from 'express';
import { autoReplyController } from '../controllers/autoReplyController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireWorkspace, requireWorkspacePermission } from '../middleware/workspaceMiddleware.js';
import { PERMISSIONS } from '../config/roles.js';

const router = express.Router();

router.use(requireAuth);
router.use(requireWorkspace);

// Rule CRUD
router.get(
  '/rules',
  requireWorkspacePermission(PERMISSIONS.SETTINGS_MANAGE),
  autoReplyController.listRules
);
router.post(
  '/rules',
  requireWorkspacePermission(PERMISSIONS.SETTINGS_MANAGE),
  autoReplyController.createRule
);
router.get(
  '/rules/:id',
  requireWorkspacePermission(PERMISSIONS.SETTINGS_MANAGE),
  autoReplyController.getRule
);
router.patch(
  '/rules/:id',
  requireWorkspacePermission(PERMISSIONS.SETTINGS_MANAGE),
  autoReplyController.updateRule
);
router.delete(
  '/rules/:id',
  requireWorkspacePermission(PERMISSIONS.SETTINGS_MANAGE),
  autoReplyController.deleteRule
);

// Account Settings (enable/disable auto-reply, default reply, cooldown)
router.patch(
  '/settings/:accountId',
  requireWorkspacePermission(PERMISSIONS.SETTINGS_MANAGE),
  autoReplyController.updateSettings
);

// Activity Logs
router.get(
  '/logs',
  requireWorkspacePermission(PERMISSIONS.SETTINGS_MANAGE),
  autoReplyController.listActivityLogs
);

// Controlled Test Incoming Simulation
router.post(
  '/simulate',
  requireWorkspacePermission(PERMISSIONS.SETTINGS_MANAGE),
  autoReplyController.simulateIncoming
);

export default router;

