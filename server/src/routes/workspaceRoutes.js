import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  requireWorkspace,
  requireWorkspacePermission,
} from '../middleware/workspaceMiddleware.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { PERMISSIONS } from '../config/roles.js';
import {
  updateWorkspaceSchema,
  inviteMemberSchema,
  acceptInvitationParamsSchema,
} from '../validators/workspaceValidators.js';
import {
  getCurrentWorkspace,
  updateCurrentWorkspace,
  getWorkspaceMembers,
  createWorkspaceInvitation,
  getWorkspaceInvitations,
  acceptWorkspaceInvitation,
} from '../controllers/workspaceController.js';

const router = express.Router();

// Require authentication for all workspace operations
router.use(requireAuth);

// 1. Current workspace metadata
router.get('/current', requireWorkspace, getCurrentWorkspace);

// 2. Update workspace settings / details
router.patch(
  '/current',
  requireWorkspace,
  requireWorkspacePermission(PERMISSIONS.WORKSPACE_UPDATE),
  validateBody(updateWorkspaceSchema),
  updateCurrentWorkspace
);

// 3. Workspace members list
router.get(
  '/current/members',
  requireWorkspace,
  requireWorkspacePermission(PERMISSIONS.MEMBERS_READ),
  getWorkspaceMembers
);

// 4. Create an invitation to join workspace
router.post(
  '/current/invitations',
  requireWorkspace,
  requireWorkspacePermission(PERMISSIONS.MEMBERS_INVITE),
  validateBody(inviteMemberSchema),
  createWorkspaceInvitation
);

// 5. Get pending invitations for current workspace
router.get(
  '/current/invitations',
  requireWorkspace,
  requireWorkspacePermission(PERMISSIONS.MEMBERS_INVITE),
  getWorkspaceInvitations
);

// 6. Accept an invitation (operates on the invitation token)
router.post(
  '/invitations/:token/accept',
  validateParams(acceptInvitationParamsSchema),
  acceptWorkspaceInvitation
);

export default router;

