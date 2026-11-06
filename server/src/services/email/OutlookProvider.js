import { BaseEmailProvider } from './BaseEmailProvider.js';
import { env } from '../../config/env.js';

/**
 * Microsoft Outlook / Graph Provider Stub (Future-compatible architecture)
 */
export class OutlookProvider extends BaseEmailProvider {
  constructor() {
    super('outlook');
    this.clientId = env.MICROSOFT_CLIENT_ID;
    this.clientSecret = env.MICROSOFT_CLIENT_SECRET;
    this.defaultScopes = ['Mail.Send', 'User.Read', 'offline_access'];
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
    throw new Error('Outlook provider exchange will be finalized in upcoming multi-provider release.');
  }

  async sendEmail() {
    throw new Error('Outlook provider send will be finalized in upcoming multi-provider release.');
  }
}

