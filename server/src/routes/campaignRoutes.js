import express from 'express';
import { campaignController } from '../controllers/campaignController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireWorkspace, requireWorkspacePermission } from '../middleware/workspaceMiddleware.js';
import { PERMISSIONS } from '../config/roles.js';

const router = express.Router();

router.use(requireAuth);
router.use(requireWorkspace);

// Preview audience count
router.post(
  '/preview-audience',
  requireWorkspacePermission(PERMISSIONS.CAMPAIGNS_READ),
  campaignController.previewAudience
);

// Campaign CRUD
router.get(
  '/',
  requireWorkspacePermission(PERMISSIONS.CAMPAIGNS_READ),
  campaignController.listCampaigns
);
router.post(
  '/',
  requireWorkspacePermission(PERMISSIONS.CAMPAIGNS_CREATE),
  campaignController.createCampaign
);
router.get(
  '/:id',
  requireWorkspacePermission(PERMISSIONS.CAMPAIGNS_READ),
  campaignController.getCampaign
);
router.patch(
  '/:id',
  requireWorkspacePermission(PERMISSIONS.CAMPAIGNS_UPDATE),
  campaignController.updateCampaign
);
router.delete(
  '/:id',
  requireWorkspacePermission(PERMISSIONS.CAMPAIGNS_DELETE),
  campaignController.deleteCampaign
);
router.post(
  '/:id/duplicate',
  requireWorkspacePermission(PERMISSIONS.CAMPAIGNS_CREATE),
  campaignController.duplicateCampaign
);

// Test email & Trigger send
router.post(
  '/:id/test-email',
  requireWorkspacePermission(PERMISSIONS.CAMPAIGNS_UPDATE),
  campaignController.sendTestEmail
);
router.post(
  '/:id/send',
  requireWorkspacePermission(PERMISSIONS.CAMPAIGNS_SEND),
  campaignController.sendCampaign
);
router.post(
  '/:id/schedule',
  requireWorkspacePermission(PERMISSIONS.CAMPAIGNS_SEND),
  campaignController.scheduleCampaign
);
router.post(
  '/:id/reschedule',
  requireWorkspacePermission(PERMISSIONS.CAMPAIGNS_SEND),
  campaignController.rescheduleCampaign
);
router.post(
  '/:id/cancel',
  requireWorkspacePermission(PERMISSIONS.CAMPAIGNS_SEND),
  campaignController.cancelCampaign
);

// Recipient delivery audit
router.get(
  '/:id/recipients',
  requireWorkspacePermission(PERMISSIONS.CAMPAIGNS_READ),
  campaignController.getRecipients
);

export default router;
