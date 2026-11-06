import { BaseEmailProvider } from './BaseEmailProvider.js';
import { env } from '../../config/env.js';

const SENDLIBERTY_SEND_URL = 'https://sendliberty.com/api/send';
const MAX_RATE_LIMIT_RETRIES = 2;
const REQUEST_TIMEOUT_MS = 10000;

const getAddress = (value = '') => {
  const match = value.match(/<([^>]+)>/);
  return (match ? match[1] : value).trim().toLowerCase();
};

const retryAfterMilliseconds = (value) => {
  if (!value) return 1000;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const retryAt = Date.parse(value);
  return Number.isNaN(retryAt) ? 1000 : Math.max(0, retryAt - Date.now());
};

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export class SendlibertyDeliveryError extends Error {
  constructor(message, { code, statusCode = 502, retryable = false, retryAfterMs = 0 } = {}) {
    super(message);
    this.name = 'SendlibertyDeliveryError';
    this.code = code || 'SENDLIBERTY_DELIVERY_FAILED';
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
  }
}

export class SendlibertyProvider extends BaseEmailProvider {
  constructor({ fetchImpl = (...args) => fetch(...args), wait = delay } = {}) {
    super('sendliberty');
    this.fetch = fetchImpl;
    this.wait = wait;
    this.nextRequestAt = 0;
  }

  isConfigured() {
    return Boolean(env.SENDLIBERTY_API_KEY && env.SENDLIBERTY_FROM_EMAIL);
  }

  validateCampaignSender(senderAccount) {
    if (senderAccount.provider !== 'gmail') {
      throw new Error('Sendliberty campaigns require a connected Gmail sender account.');
    }
    if (
      !env.SENDLIBERTY_FROM_EMAIL ||
      getAddress(senderAccount.emailAddress) !== getAddress(env.SENDLIBERTY_FROM_EMAIL)
    ) {
      throw new Error('The campaign Gmail sender must match SENDLIBERTY_FROM_EMAIL.');
    }
  }

  async waitForSendSlot() {
    const now = Date.now();
    const sendAt = Math.max(now, this.nextRequestAt);
    this.nextRequestAt = sendAt + 1000;
    await this.wait(sendAt - now);
  }

  async sendEmail({ from, to, subject, html, text }) {
    if (!this.isConfigured()) {
      throw new SendlibertyDeliveryError('Sendliberty is not configured.', {
        code: 'SENDLIBERTY_NOT_CONFIGURED',
        statusCode: 503,
      });
    }
    if (from && getAddress(from) !== getAddress(env.SENDLIBERTY_FROM_EMAIL)) {
      throw new SendlibertyDeliveryError('The requested sender does not match the configured Sendliberty sender.', {
        code: 'SENDLIBERTY_SENDER_MISMATCH',
        statusCode: 400,
      });
    }

    let response;
    for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
      await this.waitForSendSlot();
      try {
        response = await this.fetch(SENDLIBERTY_SEND_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.SENDLIBERTY_API_KEY,
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          body: JSON.stringify({
            from: env.SENDLIBERTY_FROM_EMAIL,
            to,
            subject,
            html,
            text: text || html.replace(/<[^>]*>?/gm, ''),
          }),
        });
      } catch (error) {
        throw new SendlibertyDeliveryError('Sendliberty request failed before a response was received.', {
          code: error.name === 'TimeoutError' || error.name === 'AbortError'
            ? 'SENDLIBERTY_TIMEOUT'
            : 'SENDLIBERTY_NETWORK_ERROR',
        });
      }

      if (response.status !== 429 || attempt === MAX_RATE_LIMIT_RETRIES) break;
      await this.wait(retryAfterMilliseconds(response.headers.get('retry-after')));
    }

    if (response.status === 429) {
      throw new SendlibertyDeliveryError('Sendliberty rate limit reached.', {
        code: 'SENDLIBERTY_RATE_LIMIT',
        statusCode: 429,
        retryable: true,
        retryAfterMs: retryAfterMilliseconds(response.headers.get('retry-after')),
      });
    }
    if (!response.ok) {
      const code = response.status === 401
        ? 'SENDLIBERTY_UNAUTHORIZED'
        : response.status === 403
          ? 'SENDLIBERTY_FORBIDDEN'
          : response.status >= 500
            ? 'SENDLIBERTY_SERVER_ERROR'
            : 'SENDLIBERTY_REQUEST_REJECTED';
      throw new SendlibertyDeliveryError('Sendliberty rejected the email request.', {
        code,
        statusCode: 502,
        retryable: response.status >= 500,
      });
    }

    let result;
    try {
      result = await response.json();
    } catch {
      throw new SendlibertyDeliveryError('Sendliberty returned an invalid success response.', {
        code: 'SENDLIBERTY_INVALID_RESPONSE',
      });
    }
    if (!result || typeof result !== 'object') {
      throw new SendlibertyDeliveryError('Sendliberty returned an invalid success response.', {
        code: 'SENDLIBERTY_INVALID_RESPONSE',
      });
    }
    const messageId = result.messageId || result.id || result.data?.id;
    return { success: true, ...(messageId ? { messageId } : {}) };
  }
}

export const sendlibertyProvider = new SendlibertyProvider();
