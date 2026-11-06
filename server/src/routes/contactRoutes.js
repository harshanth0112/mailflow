import express from 'express';
import { contactController } from '../controllers/contactController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireWorkspace, requireWorkspacePermission } from '../middleware/workspaceMiddleware.js';
import { uploadContactFile } from '../middleware/uploadMiddleware.js';
import { PERMISSIONS } from '../config/roles.js';

const router = express.Router();

// Enforce authentication and workspace isolation across all contact endpoints
router.use(requireAuth);
router.use(requireWorkspace);

// Stats
router.get(
  '/stats',
  requireWorkspacePermission(PERMISSIONS.CONTACTS_READ),
  contactController.getStats
);

// Contact groups
router.get(
  '/groups',
  requireWorkspacePermission(PERMISSIONS.CONTACTS_READ),
  contactController.listGroups
);
router.post(
  '/groups',
  requireWorkspacePermission(PERMISSIONS.CONTACTS_MANAGE),
  contactController.createGroup
);
router.patch(
  '/groups/:groupId',
  requireWorkspacePermission(PERMISSIONS.CONTACTS_MANAGE),
  contactController.updateGroup
);
router.delete(
  '/groups/:groupId',
  requireWorkspacePermission(PERMISSIONS.CONTACTS_MANAGE),
  contactController.deleteGroup
);

// Bulk group & tag assignment
router.post(
  '/groups/assign',
  requireWorkspacePermission(PERMISSIONS.CONTACTS_MANAGE),
  contactController.assignGroups
);
router.post(
  '/tags/manage',
  requireWorkspacePermission(PERMISSIONS.CONTACTS_MANAGE),
  contactController.manageTags
);

// Import & Export
router.post(
  '/import/preview',
  requireWorkspacePermission(PERMISSIONS.CONTACTS_MANAGE),
  uploadContactFile.single('file'),
  contactController.previewImport
);
router.post(
  '/import/execute',
  requireWorkspacePermission(PERMISSIONS.CONTACTS_MANAGE),
  uploadContactFile.single('file'),
  contactController.executeImport
);
router.get(
  '/export',
  requireWorkspacePermission(PERMISSIONS.CONTACTS_READ),
  contactController.exportContacts
);

// Core Contact CRUD
router.get(
  '/',
  requireWorkspacePermission(PERMISSIONS.CONTACTS_READ),
  contactController.listContacts
);
router.post(
  '/',
  requireWorkspacePermission(PERMISSIONS.CONTACTS_MANAGE),
  contactController.createContact
);
router.get(
  '/:id',
  requireWorkspacePermission(PERMISSIONS.CONTACTS_READ),
  contactController.getContact
);
router.patch(
  '/:id',
  requireWorkspacePermission(PERMISSIONS.CONTACTS_MANAGE),
  contactController.updateContact
);
router.delete(
  '/:id',
  requireWorkspacePermission(PERMISSIONS.CONTACTS_MANAGE),
  contactController.deleteContact
);
router.post(
  '/:id/unsubscribe',
  requireWorkspacePermission(PERMISSIONS.CONTACTS_MANAGE),
  contactController.unsubscribeContact
);

export default router;

