import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.EMAIL_PROVIDER = 'disabled';
process.env.CAMPAIGN_EMAIL_PROVIDER = 'mailbox';
process.env.SENDLIBERTY_API_KEY = '';
process.env.SENDLIBERTY_FROM_EMAIL = '';

const { env } = await import('./src/config/env.js');
const { authEmailService } = await import('./src/services/authEmailService.js');
const {
  SendlibertyProvider,
  sendlibertyProvider,
} = await import('./src/services/email/SendlibertyProvider.js');
const { getCampaignEmailProvider } = await import('./src/services/email/campaignEmailProvider.js');

const originalFetch = globalThis.fetch;
const sentRequests = [];
const user = {
  name: 'MailFlow Test',
  email: 'recipient@example.test',
};

const run = async () => {
  env.SENDLIBERTY_API_KEY = 'test-key-not-a-real-secret';
  env.SENDLIBERTY_FROM_EMAIL = 'MailFlow <sender@gmail.com>';
  env.EMAIL_PROVIDER = 'sendliberty';
  env.CAMPAIGN_EMAIL_PROVIDER = 'sendliberty';
  sendlibertyProvider.wait = async () => {};
  globalThis.fetch = async (url, options) => {
    sentRequests.push({ url, options, body: JSON.parse(options.body) });
    return new Response(JSON.stringify({ id: `message-${sentRequests.length}` }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const verification = await authEmailService.sendVerificationEmail(user, 'verify-token');
  await authEmailService.sendPasswordResetEmail(user, 'reset-token');
  await authEmailService.sendWelcomeEmail(user);
  await authEmailService.sendPasswordChangedConfirmation(user, '127.0.0.1');
  await authEmailService.sendLoginSecurityNotification(user, '127.0.0.1', 'test-agent');
  await authEmailService.sendEmailChangeVerification(user, 'change-token', 'new@example.test');
  assert.equal(verification.messageId, 'message-1');
  assert.equal(sentRequests.length, 6, 'all transactional mail types must use Sendliberty');
  for (const { url, options, body } of sentRequests) {
    assert.equal(url, 'https://sendliberty.com/api/send');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['x-api-key'], env.SENDLIBERTY_API_KEY);
    assert.equal(body.from, env.SENDLIBERTY_FROM_EMAIL);
    assert.ok(body.to);
    assert.ok(body.subject);
    assert.ok(body.html);
    assert.ok(body.text);
  }
  assert.equal(sentRequests[5].body.to, 'new@example.test');
  console.log('Transactional verification, reset, welcome, and security messages use Sendliberty.');

  const campaignProvider = getCampaignEmailProvider({
    provider: 'gmail',
    emailAddress: 'sender@gmail.com',
  });
  assert.equal(campaignProvider.name, 'sendliberty');
  await campaignProvider.sendEmail({
    from: 'sender@gmail.com',
    to: 'campaign-recipient@example.test',
    subject: 'Campaign test',
    html: '<p>Campaign body</p>',
    text: 'Campaign body',
  });
  assert.equal(sentRequests.at(-1).body.to, 'campaign-recipient@example.test');
  assert.throws(
    () => getCampaignEmailProvider({ provider: 'outlook', emailAddress: 'sender@gmail.com' }),
    /connected Gmail sender/
  );
  assert.throws(
    () => getCampaignEmailProvider({ provider: 'gmail', emailAddress: 'other@gmail.com' }),
    /must match SENDLIBERTY_FROM_EMAIL/
  );
  console.log('Campaign routing enforces the configured connected Gmail sender.');

  const retryWaits = [];
  let retryCalls = 0;
  const retryingProvider = new SendlibertyProvider({
    wait: async (milliseconds) => retryWaits.push(milliseconds),
    fetchImpl: async () => {
      retryCalls += 1;
      if (retryCalls === 1) {
        return new Response('{}', { status: 429, headers: { 'Retry-After': '2' } });
      }
      return new Response(JSON.stringify({ id: 'retried-message' }), { status: 200 });
    },
  });
  const retried = await retryingProvider.sendEmail({
    to: 'campaign-recipient@example.test',
    subject: 'Retry test',
    html: '<p>Retry</p>',
  });
  assert.equal(retried.messageId, 'retried-message');
  assert.equal(retryCalls, 2);
  assert.ok(retryWaits.includes(2000), '429 retry must honor Retry-After');
  console.log('Campaign sends retry rate-limited requests using Retry-After.');

  const unauthorizedProvider = new SendlibertyProvider({
    wait: async () => {},
    fetchImpl: async () => new Response('{}', { status: 401 }),
  });
  await assert.rejects(
    unauthorizedProvider.sendEmail({
      to: 'recipient@example.test',
      subject: 'Invalid key',
      html: '<p>Invalid key</p>',
    }),
    (error) => error.code === 'SENDLIBERTY_UNAUTHORIZED' && !error.retryable
  );

  const timeoutProvider = new SendlibertyProvider({
    wait: async () => {},
    fetchImpl: async () => {
      const error = new Error('request timeout');
      error.name = 'TimeoutError';
      throw error;
    },
  });
  await assert.rejects(
    timeoutProvider.sendEmail({
      to: 'recipient@example.test',
      subject: 'Timeout',
      html: '<p>Timeout</p>',
    }),
    (error) => error.code === 'SENDLIBERTY_TIMEOUT' && !error.retryable
  );

  const failedProvider = new SendlibertyProvider({
    wait: async () => {},
    fetchImpl: async () => new Response('{}', { status: 503 }),
  });
  await assert.rejects(
    failedProvider.sendEmail({
      to: 'recipient@example.test',
      subject: 'Provider failure',
      html: '<p>Provider failure</p>',
    }),
    (error) => error.code === 'SENDLIBERTY_SERVER_ERROR' && error.retryable
  );

  env.SENDLIBERTY_API_KEY = '';
  await assert.rejects(
    sendlibertyProvider.sendEmail({
      to: 'recipient@example.test',
      subject: 'Missing key',
      html: '<p>Missing key</p>',
    }),
    (error) => error.code === 'SENDLIBERTY_NOT_CONFIGURED'
  );
  console.log('Invalid key, missing configuration, timeout, and provider errors are surfaced.');
};

run()
  .catch((error) => {
    console.error('Sendliberty tests failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    globalThis.fetch = originalFetch;
  });
