import { BaseEmailProvider } from './BaseEmailProvider.js';
import { env } from '../../config/env.js';
import nodemailer from 'nodemailer';

/**
 * Gmail Email Provider
 * Handles OAuth 2.0 flow for Gmail Mailbox operations and sending
 */
export class GmailProvider extends BaseEmailProvider {
  constructor() {
    super('gmail');
    this.clientId = env.GOOGLE_CLIENT_ID;
    this.clientSecret = env.GOOGLE_CLIENT_SECRET;
    // Least privilege scopes for sending campaigns, reading mailbox messages for auto-reply, & profile identification
    this.defaultScopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];
  }

  isConfigured() {
    return Boolean(this.clientId && this.clientSecret);
  }

  /**
   * Generates Google OAuth authorization URL
   */
  getAuthorizationUrl({ state, redirectUri, scopes }) {
    if (!this.isConfigured()) {
      throw new Error('Google OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) are not configured.');
    }

    const requestedScopes = scopes || this.defaultScopes;
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri || env.GOOGLE_CALLBACK_URL,
      response_type: 'code',
      scope: requestedScopes.join(' '),
      access_type: 'offline', // Required to receive refresh_token
      prompt: 'consent', // Force consent prompt to guarantee refresh token issuance
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchanges code for Google access and refresh tokens
   */
  async exchangeCodeForTokens(code, redirectUri) {
    if (!this.isConfigured()) {
      throw new Error('Google OAuth credentials are not configured');
    }

    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const params = new URLSearchParams({
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: redirectUri || env.GOOGLE_CALLBACK_URL,
      grant_type: 'authorization_code',
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error_description || data.error || 'Failed to exchange authorization code');
    }

    // Fetch user profile info
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
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
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
        id: profile.id,
      },
    };
  }

  /**
   * Refresh expired access token
   */
  async refreshAccessToken(refreshToken) {
    if (!this.isConfigured()) {
      throw new Error('Google OAuth credentials are not configured');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await res.json();
    if (!res.ok) {
      if (data.error === 'invalid_grant') {
        const err = new Error('Refresh token revoked or expired');
        err.isRevoked = true;
        throw err;
      }
      throw new Error(data.error_description || data.error || 'Failed to refresh token');
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || null,
      expiresIn: data.expires_in,
      tokenExpiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
    };
  }

  /**
   * Fetch incoming messages from Gmail
   * Supports polling with query and maxResults
   */
  async listMessages({ accessToken, query = 'is:unread', maxResults = 10, pageToken = null }) {
    const params = new URLSearchParams({
      q: query,
      maxResults: String(maxResults),
    });
    if (pageToken) params.append('pageToken', pageToken);

    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || 'Failed to list Gmail messages');
    }

    return {
      messages: data.messages || [],
      nextPageToken: data.nextPageToken || null,
      resultSizeEstimate: data.resultSizeEstimate || 0,
    };
  }

  /**
   * Get single message details from Gmail
   */
  async getMessage({ accessToken, messageId }) {
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || `Failed to get Gmail message ${messageId}`);
    }

    // Parse headers
    const headers = data.payload?.headers || [];
    const getHeader = (name) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    let body = '';
    if (data.snippet) {
      body = data.snippet;
    }

    return {
      id: data.id,
      threadId: data.threadId,
      snippet: data.snippet || '',
      historyId: data.historyId,
      internalDate: data.internalDate,
      from: getHeader('From'),
      to: getHeader('To'),
      subject: getHeader('Subject'),
      date: getHeader('Date'),
      messageIdHeader: getHeader('Message-ID'),
      body,
    };
  }

  /**
   * Send email using Gmail OAuth2 Transport (Nodemailer OAuth2)
   */
  async sendEmail({ from, to, subject, html, text, attachments = [], accessToken, refreshToken }) {
    // Construct Nodemailer OAuth2 transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: from,
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        refreshToken,
        accessToken,
      },
    });

    try {
      const mailOptions = {
        from,
        to,
        subject,
        html,
        text,
      };

      if (attachments && attachments.length > 0) {
        mailOptions.attachments = attachments.map((att) => ({
          filename: att.originalName || att.filename,
          path: att.path,
          contentType: att.contentType,
        }));
      }

      const info = await transporter.sendMail(mailOptions);

      return {
        success: true,
        messageId: info.messageId,
        providerResponse: info.response,
      };
    } catch (err) {
      const normalized = this.normalizeError(err);
      throw normalized;
    }
  }

  /**
   * Normalize Gmail / Google API errors
   */
  normalizeError(error) {
    const msg = error.message || '';
    const errCode = error.code || '';

    // Classify rate limits / quotas (429 or quotaExceeded)
    if (msg.includes('rate limit') || msg.includes('Quota exceeded') || errCode === 'EAUTH') {
      return {
        isRetryable: true,
        code: 'RATE_LIMIT_OR_AUTH',
        message: 'Gmail rate limit exceeded or auth refresh required',
        original: error,
      };
    }

    // Network timeouts or temporary connection resets
    if (['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'ESOCKET'].includes(errCode)) {
      return {
        isRetryable: true,
        code: 'NETWORK_TIMEOUT',
        message: 'Transient network failure contacting Gmail',
        original: error,
      };
    }

    // Revocation or invalid grant
    if (msg.includes('invalid_grant') || error.isRevoked) {
      return {
        isRetryable: false,
        code: 'TOKEN_REVOKED',
        message: 'Mailbox authorization was revoked or expired. Please reauthorize account.',
        original: error,
      };
    }

    return {
      isRetryable: false,
      code: 'PERMANENT_FAILURE',
      message: msg || 'Failed to send via Gmail',
      original: error,
    };
  }
}

