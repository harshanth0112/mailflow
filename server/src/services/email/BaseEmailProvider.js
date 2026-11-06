/**
 * Base Abstract Email Provider Interface
 */
export class BaseEmailProvider {
  constructor(name) {
    this.name = name;
  }

  /**
   * Generates the OAuth authorization URL with CSRF state
   * @param {Object} options { state, redirectUri, scopes }
   * @returns {string}
   */
  getAuthorizationUrl(options) {
    throw new Error('getAuthorizationUrl must be implemented by provider');
  }

  /**
   * Exchanges authorization code for tokens
   * @param {string} code 
   * @param {string} redirectUri 
   * @returns {Promise<Object>} { accessToken, refreshToken, expiresIn, profile }
   */
  async exchangeCodeForTokens(code, redirectUri) {
    throw new Error('exchangeCodeForTokens must be implemented by provider');
  }

  /**
   * Refreshes an expired access token using the refresh token
   * @param {string} refreshToken 
   * @returns {Promise<Object>} { accessToken, expiresIn }
   */
  async refreshAccessToken(refreshToken) {
    throw new Error('refreshAccessToken must be implemented by provider');
  }

  /**
   * Sends an email via provider API or authenticated transport
   * @param {Object} options { from, to, subject, html, text, accessToken, refreshToken }
   * @returns {Promise<Object>} { messageId, success, providerResponse }
   */
  async sendEmail(options) {
    throw new Error('sendEmail must be implemented by provider');
  }

  /**
   * Validates account connection status
   * @param {Object} account 
   * @returns {Promise<boolean>}
   */
  async validateConnection(account) {
    throw new Error('validateConnection must be implemented by provider');
  }

  /**
   * Normalizes errors into standard MailFlow categorization (retryable vs permanent)
   * @param {Error} error 
   * @returns {Object} { isRetryable: boolean, code: string, message: string }
   */
  normalizeError(error) {
    return {
      isRetryable: false,
      code: 'PROVIDER_ERROR',
      message: error.message || 'Unknown provider error',
    };
  }
}

