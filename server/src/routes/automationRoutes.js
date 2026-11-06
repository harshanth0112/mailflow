import express from 'express';
import { automationController } from '../controllers/automationController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireWorkspace, requireWorkspacePermission } from '../middleware/workspaceMiddleware.js';
import { PERMISSIONS } from '../config/roles.js';

const router = express.Router();

router.use(requireAuth);
router.use(requireWorkspace);

// List automations
router.get(
  '/',
  requireWorkspacePermission(PERMISSIONS.CAMPAIGNS_READ),
  automationController.listAutomations
);

// Create automation
router.post(
  '/',
  requireWorkspacePermission(PERMISSIONS.CAMPAIGNS_CREATE),
  automationController.createAutomation
);

// Get single automation
router.get(
  '/:id',
  requireWorkspacePermission(PERMISSIONS.CAMPAIGNS_READ),
  automationController.getAutomation
);

// Update automation
router.patch(
  '/:id',
  requireWorkspacePermission(PERMISSIONS.CAMPAIGNS_UPDATE),
  automationController.updateAutomation
);

// Delete automation
router.delete(
  '/:id',
  requireWorkspacePermission(PERMISSIONS.CAMPAIGNS_DELETE),
  automationController.deleteAutomation
);

// Toggle status (active/inactive)
router.post(
  '/:id/toggle',
  requireWorkspacePermission(PERMISSIONS.CAMPAIGNS_UPDATE),
  automationController.toggleStatus
);

// Execution history
router.get(
  '/:id/history',
  requireWorkspacePermission(PERMISSIONS.CAMPAIGNS_READ),
  automationController.getExecutionHistory
);

export default router;

