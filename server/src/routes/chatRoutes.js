import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireWorkspace } from '../middleware/workspaceMiddleware.js';
import { chatController } from '../controllers/chatController.js';

const router = express.Router();

router.use(requireAuth);
router.use(requireWorkspace);

router.get('/conversations', chatController.listConversations);
router.post('/conversations', chatController.createConversation);
router.get('/conversations/:id', chatController.getMessages);
router.post('/conversations/:id/messages', chatController.sendMessage);
router.delete('/conversations/:id', chatController.deleteConversation);
router.post('/quick-action', chatController.quickAction);

export default router;

