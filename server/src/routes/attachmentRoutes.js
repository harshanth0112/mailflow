import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireWorkspace } from '../middleware/workspaceMiddleware.js';
import { uploadAttachment } from '../middleware/attachmentUpload.js';
import { attachmentController } from '../controllers/attachmentController.js';

const router = express.Router();

router.use(requireAuth);
router.use(requireWorkspace);

router.post(
  '/upload',
  uploadAttachment.array('files', 5),
  attachmentController.upload
);

router.get(
  '/download/:filename',
  attachmentController.download
);

router.delete(
  '/:filename',
  attachmentController.delete
);

export default router;

