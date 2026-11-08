import { BaseEmailProvider } from './BaseEmailProvider.js';
import { env } from '../../config/env.js';
import fs from 'fs';

/**
 * Microsoft Outlook / Graph Provider
 * Supports OAuth 2.0 flow, message sending, and inbox polling via Microsoft Graph API
 */
export class OutlookProvider extends BaseEmailProvider {
  constructor() {
    super('outlook');
    this.clientId = env.MICROSOFT_CLIENT_ID;
    this.clientSecret = env.MICROSOFT_CLIENT_SECRET;
    this.defaultScopes = [
      'Mail.Read',
      'Mail.ReadWrite',
      'Mail.Send',
      'User.Read',
      'offline_access',
    ];
  }

  isConfigured() {
    return Boolean(this.clientId && this.clientSecret);
  }

  getAuthorizationUrl({ state, redirectUri }) {
    if (!this.isConfigured()) {
      throw new Error('Microsoft OAuth credentials (MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET) are not configured.');
    }
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: redirectUri || env.MICROSOFT_CALLBACK_URL,
      response_mode: 'query',
      scope: this.defaultScopes.join(' '),
      state,
    });
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code, redirectUri) {
    if (!this.isConfigured()) {
      throw new Error('Microsoft OAuth credentials are not configured');
    }

    const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: redirectUri || env.MICROSOFT_CALLBACK_URL,
      grant_type: 'authorization_code',
      scope: this.defaultScopes.join(' '),
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error_description || data.error || 'Failed to exchange Microsoft authorization code');
    }

    // Fetch user profile from Microsoft Graph
    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const profile = await profileRes.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenExpiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
      scopes: data.scope ? data.scope.split(' ') : this.defaultScopes,
      profile: {
        email: profile.mail || profile.userPrincipalName,
        name: profile.displayName || '',
        id: profile.id,
      },
    };
  }

  async refreshAccessToken(refreshToken) {
    if (!this.isConfigured()) {
      throw new Error('Microsoft OAuth credentials are not configured');
    }

    const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: this.defaultScopes.join(' '),
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await res.json();
    if (!res.ok) {
      if (data.error === 'invalid_grant') {
        const err = new Error('Microsoft refresh token revoked or expired');
        err.isRevoked = true;
        throw err;
      }
      throw new Error(data.error_description || data.error || 'Failed to refresh Microsoft token');
    }

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      tokenExpiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
    };
  }

  /**
   * Send email via Microsoft Graph API
   */
  async sendEmail({ from, to, subject, html, text, attachments = [], accessToken }) {
    const payload = {
      message: {
        subject,
        body: {
          contentType: html ? 'HTML' : 'Text',
          content: html || text || '',
        },
        toRecipients: [
          {
            emailAddress: {
              address: to,
            },
          },
        ],
      },
      saveToSentItems: 'true',
    };

    if (attachments && attachments.length > 0) {
      payload.message.attachments = attachments.map((att) => {
        let contentBytes = '';
        try {
          if (att.path && fs.existsSync(att.path)) {
            contentBytes = fs.readFileSync(att.path).toString('base64');
          }
        } catch {}
        return {
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: att.originalName || att.filename,
          contentType: att.contentType,
          contentBytes,
        };
      });
    }

    const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData.error?.message || 'Failed to send email via Microsoft Graph';
      throw new Error(msg);
    }

    return {
      success: true,
      messageId: `ms-graph-${Date.now()}`,
      providerResponse: '202 Accepted',
    };
  }

  /**
   * List unread / recent messages via Microsoft Graph API
   */
  async listMessages({ accessToken, maxResults = 10 }) {
    const url = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=${maxResults}&$filter=isRead eq false&$orderby=receivedDateTime desc`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || 'Failed to list Microsoft Graph messages');
    }

    return {
      messages: (data.value || []).map((m) => ({
        id: m.id,
        threadId: m.conversationId,
        from: m.from?.emailAddress?.address || '',
        to: (m.toRecipients || []).map((r) => r.emailAddress?.address).join(', '),
        subject: m.subject || '',
        snippet: m.bodyPreview || '',
        body: m.body?.content || m.bodyPreview || '',
        receivedDateTime: m.receivedDateTime,
      })),
    };
  }

  /**
   * Get single message details
   */
  async getMessage({ accessToken, messageId }) {
    const url = `https://graph.microsoft.com/v1.0/me/messages/${messageId}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || `Failed to get Microsoft Graph message ${messageId}`);
    }

    return {
      id: data.id,
      threadId: data.conversationId,
      from: data.from?.emailAddress?.address || '',
      to: (data.toRecipients || []).map((r) => r.emailAddress?.address).join(', '),
      subject: data.subject || '',
      snippet: data.bodyPreview || '',
      body: data.body?.content || data.bodyPreview || '',
      receivedDateTime: data.receivedDateTime,
    };
  }
}
