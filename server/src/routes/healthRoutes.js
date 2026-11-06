import { Router } from 'express';
import { getHealth } from '../controllers/healthController.js';

const router = Router();

// Support both /health and /
router.get('/', getHealth);
router.get('/health', getHealth);

export default router;

