import mongoose from 'mongoose';
import { EmailAccount, CONNECTION_STATUS, EMAIL_PROVIDERS } from '../models/EmailAccount.js';
import { emailProviderRegistry } from './email/EmailProviderRegistry.js';
import { encryptToken, decryptToken } from '../utils/cryptoUtils.js';
import { generateRandomToken } from '../utils/tokenUtils.js';
import { env } from '../config/env.js';

// In-memory fallback map for dev mode
export const devEmailAccounts = new Map();

// In-memory store for pending OAuth states to prevent CSRF
export const oauthStateStore = new Map(); // state -> { workspaceId, userId, provider, expiresAt }

/**
 * Strips sensitive token fields from email account objects before returning to API or clients
 */
export const sanitizeAccount = (account) => {
  if (!account) return null;
  const obj = typeof account.toObject === 'function' ? account.toObject() : { ...account };
  delete obj.encryptedAccessToken;
  delete obj.encryptedRefreshToken;
  delete obj.accessToken;
  delete obj.refreshToken;
  return obj;
};

export const emailAccountService = {
  /**
   * List connected email accounts for a workspace
   */
  async listAccounts(workspaceId) {
    if (mongoose.connection.readyState === 1) {
      return await EmailAccount.find({ workspaceId }).sort({ createdAt: -1 });
    }
    return Array.from(devEmailAccounts.values())
      .filter((acc) => acc.workspaceId.toString() === workspaceId.toString())
      .map(sanitizeAccount);
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
      return sanitizeAccount(acc);
    }
    return null;
  },

  /**
   * Initiate OAuth flow: Generate state & authorization URL
   */
  initiateOAuth({ workspaceId, userId, providerName = 'gmail', redirectUri }) {
    const provider = emailProviderRegistry.get(providerName);
    
    // Use the dedicated sender OAuth callback URL unless caller provides an explicit one
    const effectiveRedirectUri =
      redirectUri ||
      (providerName === 'gmail'
        ? env.GMAIL_SENDER_CALLBACK_URL
        : env.MICROSOFT_CALLBACK_URL);

    // Generate cryptographically secure state
    const state = generateRandomToken(24);
    // State expires in 15 minutes
    oauthStateStore.set(state, {
      workspaceId: workspaceId.toString(),
      userId: userId.toString(),
      provider: providerName,
      redirectUri: effectiveRedirectUri,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    const url = provider.getAuthorizationUrl({ state, redirectUri: effectiveRedirectUri });
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
    const tokenData = await provider.exchangeCodeForTokens(code, redirectUri || storedState.redirectUri);
    if (!tokenData || !tokenData.accessToken) {
      throw new Error('OAuth token exchange returned an invalid or missing access token.');
    }
    if (!tokenData.profile || !tokenData.profile.email) {
      throw new Error('OAuth token exchange failed to retrieve a verified email address.');
    }

    const emailAddress = tokenData.profile.email.toLowerCase().trim();

    // Encrypt sensitive tokens at rest using AES-256-GCM
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
        // Never overwrite an existing refresh token with null or an empty value
        if (encryptedRefreshToken && encryptedRefreshToken.trim() !== '') {
          account.encryptedRefreshToken = encryptedRefreshToken;
        }
        account.tokenExpiresAt = tokenData.tokenExpiresAt;
        account.connectionStatus = CONNECTION_STATUS.CONNECTED;
        account.displayName = tokenData.profile.name || account.displayName;
        account.lastSyncedAt = new Date();
        account.scopes = tokenData.scopes;
        if (tokenData.profile.id) {
          account.metadata = account.metadata || {};
          account.metadata.providerUserId = tokenData.profile.id;
        }
        await account.save();
      } else {
        account = new EmailAccount({
          workspaceId,
          userId,
          provider: providerName,
          emailAddress,
          displayName: tokenData.profile.name || '',
          encryptedAccessToken,
          encryptedRefreshToken: encryptedRefreshToken || '',
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

      return sanitizeAccount(account);
    } else {
      // In-memory mock for dev mode
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
        displayName: tokenData.profile.name || existing?.displayName || '',
        encryptedAccessToken,
        encryptedRefreshToken: (encryptedRefreshToken && encryptedRefreshToken.trim() !== '')
          ? encryptedRefreshToken
          : (existing?.encryptedRefreshToken || ''),
        tokenExpiresAt: tokenData.tokenExpiresAt,
        scopes: tokenData.scopes,
        connectionStatus: CONNECTION_STATUS.CONNECTED,
        lastSyncedAt: new Date(),
        metadata: {
          dailyQuota: 500,
          sentToday: 0,
          providerUserId: tokenData.profile.id || '',
        },
        createdAt: existing?.createdAt || new Date(),
        updatedAt: new Date(),
      };
      devEmailAccounts.set(id, account);
      return sanitizeAccount(account);
    }
  },

  /**
   * Restore connected status for stored email accounts that possess a valid refresh token upon backend restart
   */
  async restoreConnectedAccounts() {
    if (mongoose.connection.readyState === 1) {
      const accounts = await EmailAccount.find({
        connectionStatus: { $in: [CONNECTION_STATUS.EXPIRED, CONNECTION_STATUS.ERROR, CONNECTION_STATUS.CONNECTED] },
      }).select('+encryptedAccessToken +encryptedRefreshToken');

      let restoredCount = 0;
      for (const account of accounts) {
        if (account.encryptedRefreshToken && account.encryptedRefreshToken.trim() !== '') {
          account.connectionStatus = CONNECTION_STATUS.CONNECTED;
          await account.save();
          restoredCount++;
        }
      }
      return restoredCount;
    }
    return 0;
  },

  /**
   * Proactively verifies and refreshes an account's OAuth access token before email dispatch.
   * Automatically encrypts and stores refreshed access token and rotated refresh token (if any).
   * Never overwrites existing refresh token with empty/null value.
   *
   * @param {Object} account - Mongoose document or in-memory account
   * @returns {Promise<string>} Decrypted valid access token
   */
  async ensureValidToken(account) {
    if (!account) {
      throw new Error('Email account not provided.');
    }

    if (account.connectionStatus && account.connectionStatus !== CONNECTION_STATUS.CONNECTED) {
      throw new Error(`Email account is currently ${account.connectionStatus}. Please reauthorize.`);
    }

    const provider = emailProviderRegistry.get(account.provider);
    if (!provider) {
      throw new Error(`Email provider '${account.provider}' is not supported.`);
    }

    let accessToken = account.encryptedAccessToken ? decryptToken(account.encryptedAccessToken) : '';
    const refreshToken = account.encryptedRefreshToken ? decryptToken(account.encryptedRefreshToken) : '';

    const isExpired =
      !accessToken ||
      !account.tokenExpiresAt ||
      new Date() >= new Date(new Date(account.tokenExpiresAt).getTime() - 60000);

    if (isExpired) {
      if (!refreshToken) {
        account.connectionStatus = CONNECTION_STATUS.EXPIRED;
        if (account.save) await account.save();
        throw new Error('Access token is expired and no refresh token is available. Please reauthorize.');
      }

      try {
        const refreshed = await provider.refreshAccessToken(refreshToken);
        accessToken = refreshed.accessToken;
        account.encryptedAccessToken = encryptToken(refreshed.accessToken);
        account.tokenExpiresAt = refreshed.tokenExpiresAt;

        // Requirement 4 & 6: Save rotated refresh token automatically, never overwrite with null or empty value
        if (refreshed.refreshToken && refreshed.refreshToken.trim() !== '') {
          account.encryptedRefreshToken = encryptToken(refreshed.refreshToken);
        }

        account.connectionStatus = CONNECTION_STATUS.CONNECTED;
        if (account.save) await account.save();

        if (devEmailAccounts.has(account._id?.toString())) {
          devEmailAccounts.set(account._id.toString(), {
            ...devEmailAccounts.get(account._id.toString()),
            ...account,
            encryptedAccessToken: account.encryptedAccessToken,
            encryptedRefreshToken: account.encryptedRefreshToken,
            tokenExpiresAt: account.tokenExpiresAt,
            connectionStatus: account.connectionStatus,
          });
        }
      } catch (refreshErr) {
        account.connectionStatus = refreshErr.isRevoked ? CONNECTION_STATUS.REVOKED : CONNECTION_STATUS.ERROR;
        if (account.save) await account.save();
        throw new Error(`Failed to refresh mailbox credentials: ${refreshErr.message}`);
      }
    }

    return accessToken;
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

    // Automatically refresh expired access tokens before sending
    const accessToken = await this.ensureValidToken(account);
    const refreshToken = account.encryptedRefreshToken ? decryptToken(account.encryptedRefreshToken) : undefined;

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

