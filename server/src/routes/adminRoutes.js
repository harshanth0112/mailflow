import express from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { adminController } from '../controllers/adminController.js';

const router = express.Router();

// Strict platform admin role protection across all administrative endpoints
router.use(requireAuth);
router.use(requireRole('admin'));

router.get('/overview', adminController.getOverview);
router.get('/users', adminController.listUsers);
router.get('/users/:id', adminController.getUserDetails);
router.patch('/users/:id/status', adminController.updateUserStatus);
router.patch('/users/:id/role', adminController.updateUserRole);
router.get('/queues', adminController.getQueues);
router.post('/queues/:queueName/retry-failed', adminController.retryFailedJobs);

export default router;

