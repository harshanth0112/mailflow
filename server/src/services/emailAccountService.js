import mongoose from 'mongoose';
import { EmailAccount, CONNECTION_STATUS, EMAIL_PROVIDERS } from '../models/EmailAccount.js';
import { emailProviderRegistry } from './email/EmailProviderRegistry.js';
import { encryptToken, decryptToken } from '../utils/cryptoUtils.js';
import { generateRandomToken } from '../utils/tokenUtils.js';

// In-memory fallback map for dev mode
export const devEmailAccounts = new Map();

// In-memory store for pending OAuth states to prevent CSRF
export const oauthStateStore = new Map(); // state -> { workspaceId, userId, provider, expiresAt }

export const emailAccountService = {
  /**
   * List connected email accounts for a workspace
   */
  async listAccounts(workspaceId) {
    if (mongoose.connection.readyState === 1) {
      return await EmailAccount.find({ workspaceId }).sort({ createdAt: -1 });
    }
    return Array.from(devEmailAccounts.values()).filter(
      (acc) => acc.workspaceId.toString() === workspaceId.toString()
    );
  },

  /**
   * Get specific account by ID with ownership verification
   */
  async getAccountById(workspaceId, accountId) {
    if (mongoose.connection.readyState === 1) {
      return await EmailAccount.findOne({ _id: accountId, workspaceId });
    }
    const acc = devEmailAccounts.get(accountId);
    if (acc && acc.workspaceId.toString() === workspaceId.toString()) {
      return acc;
    }
    return null;
  },

  /**
   * Initiate OAuth flow: Generate state & authorization URL
   */
  initiateOAuth({ workspaceId, userId, providerName = 'gmail', redirectUri }) {
    const provider = emailProviderRegistry.get(providerName);
    
    // Generate cryptographically secure state
    const state = generateRandomToken(24);
    // State expires in 15 minutes
    oauthStateStore.set(state, {
      workspaceId: workspaceId.toString(),
      userId: userId.toString(),
      provider: providerName,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    const url = provider.getAuthorizationUrl({ state, redirectUri });
    return { url, state };
  },

  /**
   * Handle OAuth Callback: Validate state, exchange code, encrypt tokens, store account
   */
  async handleOAuthCallback({ code, state, redirectUri }) {
    const storedState = oauthStateStore.get(state);
    if (!storedState) {
      throw new Error('Invalid or expired OAuth state. Please initiate the connection again.');
    }

    if (Date.now() > storedState.expiresAt) {
      oauthStateStore.delete(state);
      throw new Error('OAuth authorization session expired. Please try again.');
    }

    oauthStateStore.delete(state);

    const { workspaceId, userId, provider: providerName } = storedState;
    const provider = emailProviderRegistry.get(providerName);

    // Exchange authorization code with provider
    const tokenData = await provider.exchangeCodeForTokens(code, redirectUri);
    const emailAddress = tokenData.profile.email.toLowerCase().trim();

    // Encrypt sensitive tokens at rest
    const encryptedAccessToken = encryptToken(tokenData.accessToken);
    const encryptedRefreshToken = tokenData.refreshToken ? encryptToken(tokenData.refreshToken) : '';

    if (mongoose.connection.readyState === 1) {
      // Find existing account for this workspace/email/provider or create new
      let account = await EmailAccount.findOne({
        workspaceId,
        emailAddress,
        provider: providerName,
      }).select('+encryptedAccessToken +encryptedRefreshToken');

      if (account) {
        account.encryptedAccessToken = encryptedAccessToken;
        if (encryptedRefreshToken) {
          account.encryptedRefreshToken = encryptedRefreshToken;
        }
        account.tokenExpiresAt = tokenData.tokenExpiresAt;
        account.connectionStatus = CONNECTION_STATUS.CONNECTED;
        account.displayName = tokenData.profile.name || account.displayName;
        account.lastSyncedAt = new Date();
        account.scopes = tokenData.scopes;
        await account.save();
      } else {
        account = new EmailAccount({
          workspaceId,
          userId,
          provider: providerName,
          emailAddress,
          displayName: tokenData.profile.name || '',
          encryptedAccessToken,
          encryptedRefreshToken,
          tokenExpiresAt: tokenData.tokenExpiresAt,
          scopes: tokenData.scopes,
          connectionStatus: CONNECTION_STATUS.CONNECTED,
          lastSyncedAt: new Date(),
          metadata: {
            providerUserId: tokenData.profile.id || '',
          },
        });
        await account.save();
      }

      return account;
    } else {
      // In-memory mock
      const existing = Array.from(devEmailAccounts.values()).find(
        (a) =>
          a.workspaceId.toString() === workspaceId.toString() &&
          a.emailAddress === emailAddress &&
          a.provider === providerName
      );

      const id = existing?._id || new mongoose.Types.ObjectId().toString();
      const account = {
        _id: id,
        workspaceId,
        userId,
        provider: providerName,
        emailAddress,
        displayName: tokenData.profile.name || '',
        encryptedAccessToken,
        encryptedRefreshToken: encryptedRefreshToken || existing?.encryptedRefreshToken || '',
        tokenExpiresAt: tokenData.tokenExpiresAt,
        scopes: tokenData.scopes,
        connectionStatus: CONNECTION_STATUS.CONNECTED,
        lastSyncedAt: new Date(),
        metadata: {
          dailyQuota: 500,
          sentToday: 0,
        },
        createdAt: existing?.createdAt || new Date(),
        updatedAt: new Date(),
      };
      devEmailAccounts.set(id, account);
      return account;
    }
  },

  /**
   * Disconnect email account
   */
  async disconnectAccount(workspaceId, accountId) {
    if (mongoose.connection.readyState === 1) {
      const account = await EmailAccount.findOneAndDelete({ _id: accountId, workspaceId });
      if (!account) throw new Error('Email account not found or access denied.');
      return account;
    }
    const acc = devEmailAccounts.get(accountId);
    if (!acc || acc.workspaceId.toString() !== workspaceId.toString()) {
      throw new Error('Email account not found or access denied.');
    }
    devEmailAccounts.delete(accountId);
    return acc;
  },

  /**
   * Send a test email from the connected mailbox
   */
  async sendTestEmail({ workspaceId, accountId, recipientEmail }) {
    let account = null;

    if (mongoose.connection.readyState === 1) {
      account = await EmailAccount.findOne({ _id: accountId, workspaceId }).select(
        '+encryptedAccessToken +encryptedRefreshToken'
      );
    } else {
      account = devEmailAccounts.get(accountId);
    }

    if (!account) {
      throw new Error('Connected email account not found.');
    }

    if (account.connectionStatus !== CONNECTION_STATUS.CONNECTED) {
      throw new Error(`Email account is currently ${account.connectionStatus}. Please reauthorize.`);
    }

    const provider = emailProviderRegistry.get(account.provider);

    // Decrypt tokens
    let accessToken = decryptToken(account.encryptedAccessToken);
    let refreshToken = decryptToken(account.encryptedRefreshToken);

    // Check token expiration and refresh if necessary
    if (account.tokenExpiresAt && new Date() >= new Date(account.tokenExpiresAt)) {
      if (!refreshToken) {
        account.connectionStatus = CONNECTION_STATUS.EXPIRED;
        if (account.save) await account.save();
        throw new Error('Access token expired and no refresh token is available. Please reauthorize.');
      }

      try {
        const refreshed = await provider.refreshAccessToken(refreshToken);
        accessToken = refreshed.accessToken;
        account.encryptedAccessToken = encryptToken(refreshed.accessToken);
        account.tokenExpiresAt = refreshed.tokenExpiresAt;
        if (account.save) await account.save();
      } catch (refreshErr) {
        account.connectionStatus = refreshErr.isRevoked ? CONNECTION_STATUS.REVOKED : CONNECTION_STATUS.ERROR;
        if (account.save) await account.save();
        throw new Error(`Failed to refresh mailbox credentials: ${refreshErr.message}`);
      }
    }

    // Dispatch test email via provider
    const subject = `[MailFlow] Test email from ${account.emailAddress}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 8px;">
        <h2 style="color: #4f46e5; margin-top: 0;">MailFlow Mailbox Test</h2>
        <p>This is a verification test email sent from your connected email account: <strong>${account.emailAddress}</strong>.</p>
        <p>If you received this message, your email provider connection is active and configured correctly for sending.</p>
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
        <p style="font-size: 12px; color: #94a3b8;">Sent via MailFlow Platform</p>
      </div>
    `;

    const sendRes = await provider.sendEmail({
      from: account.emailAddress,
      to: recipientEmail,
      subject,
      html,
      text: `MailFlow Mailbox Test: This is a verification test email sent from your connected account: ${account.emailAddress}.`,
      accessToken,
      refreshToken,
    });

    return sendRes;
  },
};

