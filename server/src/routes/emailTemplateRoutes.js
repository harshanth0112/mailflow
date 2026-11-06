import express from 'express';
import { emailTemplateController } from '../controllers/emailTemplateController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  requireWorkspace,
  requireWorkspacePermission,
} from '../middleware/workspaceMiddleware.js';
import { PERMISSIONS } from '../config/roles.js';

const router = express.Router();

router.use(requireAuth, requireWorkspace);
router.get('/', requireWorkspacePermission(PERMISSIONS.CAMPAIGNS_READ), emailTemplateController.list);
router.post('/', requireWorkspacePermission(PERMISSIONS.CAMPAIGNS_CREATE), emailTemplateController.create);
router.patch('/:id', requireWorkspacePermission(PERMISSIONS.CAMPAIGNS_UPDATE), emailTemplateController.update);
router.delete('/:id', requireWorkspacePermission(PERMISSIONS.CAMPAIGNS_DELETE), emailTemplateController.delete);

export default router;
