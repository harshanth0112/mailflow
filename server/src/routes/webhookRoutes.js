import express from 'express';
import { graphWebhookController } from '../controllers/graphWebhookController.js';

const router = express.Router();

// Public webhook endpoint for Microsoft Graph notifications
router.post('/graph', graphWebhookController.handleNotification);
router.get('/graph', graphWebhookController.handleNotification);

export default router;

