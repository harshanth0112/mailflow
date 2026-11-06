import express from 'express';
import { analyticsController } from '../controllers/analyticsController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireWorkspace, requireWorkspacePermission } from '../middleware/workspaceMiddleware.js';
import { PERMISSIONS } from '../config/roles.js';

const router = express.Router();

router.use(requireAuth);
router.use(requireWorkspace);

// Overview metrics
router.get(
  '/overview',
  requireWorkspacePermission(PERMISSIONS.ANALYTICS_READ),
  analyticsController.getOverview
);

// Campaign performance
router.get(
  '/campaigns/:id',
  requireWorkspacePermission(PERMISSIONS.ANALYTICS_READ),
  analyticsController.getCampaignAnalytics
);

// Auto-reply analytics
router.get(
  '/auto-reply',
  requireWorkspacePermission(PERMISSIONS.ANALYTICS_READ),
  analyticsController.getAutoReplyAnalytics
);

// Admin health & queue monitor
router.get(
  '/admin/health',
  requireWorkspacePermission(PERMISSIONS.SETTINGS_MANAGE),
  analyticsController.getAdminHealth
);

// Export CSV
router.get(
  '/export/campaigns',
  requireWorkspacePermission(PERMISSIONS.ANALYTICS_READ),
  analyticsController.exportCampaignsCsv
);

// Workspace audit logs
router.get(
  '/audit-logs',
  requireWorkspacePermission(PERMISSIONS.SETTINGS_MANAGE),
  analyticsController.listAuditLogs
);

export default router;

