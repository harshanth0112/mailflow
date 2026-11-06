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

export default router;
