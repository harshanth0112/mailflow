import { emailAccountService } from '../services/emailAccountService.js';
import {
  initiateOAuthSchema,
  oauthCallbackSchema,
  testEmailSchema,
} from '../validators/emailAccountValidators.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { env } from '../config/env.js';

export const emailAccountController = {
  /**
   * GET /api/v1/email-accounts
   * List connected accounts for current workspace
   */
  async listAccounts(req, res) {
    try {
      const accounts = await emailAccountService.listAccounts(req.workspace._id);
      return sendSuccess(res, 200, 'Connected email accounts retrieved', accounts);
    } catch (error) {
      return sendError(res, 500, error.message || 'Failed to list email accounts');
    }
  },

  /**
   * GET /api/v1/email-accounts/providers
   * Get supported providers and configuration status
   */
  async getProviders(req, res) {
    try {
      const providers = [
        {
          id: 'gmail',
          name: 'Google Gmail',
          description: 'Connect personal or Google Workspace accounts using OAuth 2.0',
          isConfigured: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
          requiresEnv: !env.GOOGLE_CLIENT_ID ? ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] : [],
        },
        {
          id: 'outlook',
          name: 'Microsoft Outlook / Office 365',
          description: 'Connect Microsoft 365 accounts via Microsoft Graph API',
          isConfigured: Boolean(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET),
          requiresEnv: !env.MICROSOFT_CLIENT_ID ? ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'] : [],
        },
      ];
      return sendSuccess(res, 200, 'Supported email providers', providers);
    } catch (error) {
      return sendError(res, 500, error.message || 'Failed to list providers');
    }
  },

  /**
   * POST /api/v1/email-accounts/oauth/initiate
   * Starts OAuth flow, generates state & auth URL
   */
  async initiateOAuth(req, res) {
    try {
      const validation = initiateOAuthSchema.safeParse(req.body);
      if (!validation.success) {
        return sendError(res, 400, 'Invalid parameters', validation.error.flatten().fieldErrors);
      }

      const { url, state } = emailAccountService.initiateOAuth({
        workspaceId: req.workspace._id,
        userId: req.user._id,
        providerName: validation.data.provider,
        redirectUri: validation.data.redirectUri,
      });

      return sendSuccess(res, 200, 'OAuth authorization URL generated', { url, state });
    } catch (error) {
      return sendError(res, 400, error.message || 'Failed to initiate OAuth flow');
    }
  },

  /**
   * POST /api/v1/email-accounts/oauth/callback
   * Completes OAuth exchange and registers account in workspace
   */
  async handleOAuthCallback(req, res) {
    try {
      const validation = oauthCallbackSchema.safeParse(req.body);
      if (!validation.success) {
        return sendError(res, 400, 'Invalid callback parameters', validation.error.flatten().fieldErrors);
      }

      const account = await emailAccountService.handleOAuthCallback({
        code: validation.data.code,
        state: validation.data.state,
        redirectUri: validation.data.redirectUri,
      });

      return sendSuccess(res, 200, 'Email account connected successfully', account);
    } catch (error) {
      return sendError(res, 400, error.message || 'OAuth callback exchange failed');
    }
  },

  /**
   * DELETE /api/v1/email-accounts/:id
   * Disconnect an email account from workspace
   */
  async disconnectAccount(req, res) {
    try {
      await emailAccountService.disconnectAccount(req.workspace._id, req.params.id);
      return sendSuccess(res, 200, 'Email account disconnected successfully', null);
    } catch (error) {
      return sendError(res, 404, error.message || 'Failed to disconnect account');
    }
  },

  /**
   * POST /api/v1/email-accounts/:id/test
   * Send a test email from the connected mailbox
   */
  async sendTestEmail(req, res) {
    try {
      const validation = testEmailSchema.safeParse(req.body);
      if (!validation.success) {
        return sendError(res, 400, 'Validation failed', validation.error.flatten().fieldErrors);
      }

      const result = await emailAccountService.sendTestEmail({
        workspaceId: req.workspace._id,
        accountId: req.params.id,
        recipientEmail: validation.data.recipientEmail,
      });

      return sendSuccess(res, 200, 'Test email sent successfully', result);
    } catch (error) {
      return sendError(res, 500, error.message || 'Failed to send test email');
    }
  },
};

