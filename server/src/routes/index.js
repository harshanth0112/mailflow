import express from 'express';
import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';
import workspaceRoutes from './workspaceRoutes.js';
import contactRoutes from './contactRoutes.js';
import emailAccountRoutes from './emailAccountRoutes.js';
import campaignRoutes from './campaignRoutes.js';
import automationRoutes from './automationRoutes.js';
import autoReplyRoutes from './autoReplyRoutes.js';
import analyticsRoutes from './analyticsRoutes.js';
import emailTemplateRoutes from './emailTemplateRoutes.js';
import trackingRoutes from './trackingRoutes.js';
import attachmentRoutes from './attachmentRoutes.js';
import webhookRoutes from './webhookRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import adminRoutes from './adminRoutes.js';
import chatRoutes from './chatRoutes.js';
import { apiLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// General rate limiter for all non-auth API routes
router.use(apiLimiter);

// Mount sub-routers
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/workspaces', workspaceRoutes);
router.use('/contacts', contactRoutes);
router.use('/email-accounts', emailAccountRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/templates', emailTemplateRoutes);
router.use('/automations', automationRoutes);
router.use('/auto-reply', autoReplyRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/track', trackingRoutes);
router.use('/attachments', attachmentRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);
router.use('/chat', chatRoutes);

export default router;
