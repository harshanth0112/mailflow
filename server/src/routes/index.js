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

const router = express.Router();

// Mount sub-routers
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/workspaces', workspaceRoutes);
router.use('/contacts', contactRoutes);
router.use('/email-accounts', emailAccountRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/automations', automationRoutes);
router.use('/auto-reply', autoReplyRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
