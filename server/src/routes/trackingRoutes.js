import express from 'express';
import { trackingController } from '../controllers/trackingController.js';

const router = express.Router();

// Public tracking endpoints — no auth required (opened from email clients)
router.get('/open/:token', trackingController.trackOpen);
router.get('/click/:token', trackingController.trackClick);

export default router;

