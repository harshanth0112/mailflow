import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireWorkspace } from '../middleware/workspaceMiddleware.js';
import { notificationController } from '../controllers/notificationController.js';

const router = express.Router();

router.use(requireAuth);
router.use(requireWorkspace);

router.get('/', notificationController.list);
router.get('/unread-count', notificationController.getUnreadCount);
router.patch('/read-all', notificationController.markAllAsRead);
router.patch('/:id/read', notificationController.markAsRead);

export default router;

