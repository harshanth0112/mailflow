import { autoReplyService } from '../services/autoReplyService.js';
import { emailProviderRegistry } from '../services/email/EmailProviderRegistry.js';
import { EmailAccount, CONNECTION_STATUS } from '../models/EmailAccount.js';
import { decryptToken } from '../utils/cryptoUtils.js';
import { logger } from '../utils/logger.js';
import mongoose from 'mongoose';

export const graphWebhookController = {
  /**
   * POST /api/v1/webhooks/graph
   * Handles Microsoft Graph Webhook lifecycle notifications & validation handshake
   */
  async handleNotification(req, res) {
    // 1. Validation Handshake: Microsoft Graph sends ?validationToken=...
    if (req.query && req.query.validationToken) {
      res.setHeader('Content-Type', 'text/plain');
      return res.status(200).send(req.query.validationToken);
    }

    // 2. Notification payload
    const { value: notifications } = req.body || {};
    if (!notifications || !Array.isArray(notifications)) {
      return res.status(202).json({ success: true, message: 'No notification records' });
    }

    // Acknowledge receipt immediately (202 Accepted) as required by Microsoft Graph (within 3 seconds)
    res.status(202).json({ success: true, message: 'Notifications accepted for processing' });

    // Process notifications asynchronously
    for (const notif of notifications) {
      try {
        const { resource, changeType, resourceData, clientState } = notif;
        if (changeType !== 'created') continue;

        // Verify resourceData and ID
        const messageId = resourceData?.id || (resource ? resource.split('/').pop() : null);
        if (!messageId) continue;

        // Find connected Outlook account matching subscription or clientState
        let account = null;
        if (mongoose.connection.readyState === 1) {
          account = await EmailAccount.findOne({
            provider: 'outlook',
            connectionStatus: CONNECTION_STATUS.CONNECTED,
            ...(clientState ? { 'metadata.webhookClientState': clientState } : {}),
          }).select('+encryptedAccessToken +encryptedRefreshToken');
        }

        if (!account) {
          logger.warn('Graph notification received for unmapped or disconnected mailbox', { messageId });
          continue;
        }

        const provider = emailProviderRegistry.get('outlook');
        const accessToken = decryptToken(account.encryptedAccessToken);
        const fullMessage = await provider.getMessage({ accessToken, messageId });

        if (fullMessage) {
          await autoReplyService.processIncomingMessage({
            workspaceId: account.workspaceId,
            emailAccountId: account._id,
            message: fullMessage,
          });
        }
      } catch (err) {
        logger.error('Error processing Microsoft Graph notification', {
          errorName: err.name,
          message: err.message,
        });
      }
    }
  },
};

