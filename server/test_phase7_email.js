import mongoose from 'mongoose';
import { encryptToken, decryptToken } from './src/utils/cryptoUtils.js';
import { emailProviderRegistry } from './src/services/email/EmailProviderRegistry.js';
import { emailAccountService, oauthStateStore } from './src/services/emailAccountService.js';
import { CONNECTION_STATUS } from './src/models/EmailAccount.js';

async function runEmailIntegrationSmokeTest() {
  console.log('--- Starting Phase 7 Email Account Integration Smoke Test ---');

  // 1. AES-256-GCM Encryption / Decryption at rest check
  console.log('1. Testing AES-256-GCM token encryption and decryption...');
  const sampleAccessToken = 'ya29.a0AfH6SMD-sample-oauth-token-with-secret-payload-123456789';
  const encrypted = encryptToken(sampleAccessToken);
  console.log('Encrypted composite format:', encrypted);
  if (!encrypted || encrypted === sampleAccessToken) {
    console.error('FAIL: Token was not encrypted or returned plaintext');
    process.exit(1);
  }

  const decrypted = decryptToken(encrypted);
  if (decrypted !== sampleAccessToken) {
    console.error('FAIL: Decrypted token does not match original token');
    process.exit(1);
  }
  console.log('SUCCESS: Token encryption/decryption roundtrip verified.');

  // 2. Provider registry inspection
  console.log('2. Inspecting Email Provider Registry...');
  const supportedProviders = emailProviderRegistry.listSupported();
  console.log('Supported providers:', supportedProviders);
  if (!supportedProviders.includes('gmail') || !supportedProviders.includes('outlook')) {
    console.error('FAIL: Gmail or Outlook provider missing from registry');
    process.exit(1);
  }
  const gmailProvider = emailProviderRegistry.get('gmail');
  console.log('Gmail provider name:', gmailProvider.name);

  // 3. OAuth State generation and CSRF protection
  console.log('3. Testing OAuth initiation and CSRF state handling...');
  const workspaceId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();

  // Test with mock credentials if not in environment
  gmailProvider.clientId = gmailProvider.clientId || 'test-client-id.apps.googleusercontent.com';
  gmailProvider.clientSecret = gmailProvider.clientSecret || 'test-client-secret';

  const { url, state } = emailAccountService.initiateOAuth({
    workspaceId,
    userId,
    providerName: 'gmail',
  });
  console.log('Generated OAuth State:', state);
  console.log('Generated Auth URL contains client_id & state:', url.includes(state));
  if (!oauthStateStore.has(state)) {
    console.error('FAIL: OAuth state was not stored in memory store');
    process.exit(1);
  }

  // 4. Test error normalization
  console.log('4. Testing provider error classification (retryable vs permanent)...');
  const timeoutErr = new Error('Connection timed out');
  timeoutErr.code = 'ETIMEDOUT';
  const normalizedTimeout = gmailProvider.normalizeError(timeoutErr);
  console.log('Normalized timeout error:', normalizedTimeout);
  if (!normalizedTimeout.isRetryable) {
    console.error('FAIL: Network timeout should be marked retryable');
    process.exit(1);
  }

  const revokedErr = new Error('invalid_grant: Token has been expired or revoked.');
  const normalizedRevoked = gmailProvider.normalizeError(revokedErr);
  console.log('Normalized revoked error:', normalizedRevoked);
  if (normalizedRevoked.isRetryable) {
    console.error('FAIL: Revoked token should be permanent failure requiring reauth');
    process.exit(1);
  }

  // 5. Account storage & encryption mock verification
  console.log('5. Testing EmailAccount model & workspace isolation...');
  const mockAccountId = new mongoose.Types.ObjectId().toString();
  const mockAccount = {
    _id: mockAccountId,
    workspaceId,
    userId,
    provider: 'gmail',
    emailAddress: 'campaigns@company.org',
    displayName: 'Company Campaigns',
    encryptedAccessToken: encryptToken('test-access-token'),
    encryptedRefreshToken: encryptToken('test-refresh-token'),
    connectionStatus: CONNECTION_STATUS.CONNECTED,
    tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
    lastSyncedAt: new Date(),
    metadata: { dailyQuota: 500, sentToday: 0 },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const { devEmailAccounts } = await import('./src/services/emailAccountService.js');
  devEmailAccounts.set(mockAccountId, mockAccount);

  const retrieved = await emailAccountService.getAccountById(workspaceId, mockAccountId);
  if (!retrieved || retrieved.emailAddress !== 'campaigns@company.org') {
    console.error('FAIL: Failed to retrieve stored account by workspace ID');
    process.exit(1);
  }

  const foreignWorkspaceId = new mongoose.Types.ObjectId().toString();
  const foreignAttempt = await emailAccountService.getAccountById(foreignWorkspaceId, mockAccountId);
  if (foreignAttempt !== null) {
    console.error('FAIL: Cross-workspace account access was not prevented (IDOR breach)');
    process.exit(1);
  }
  console.log('SUCCESS: Cross-workspace isolation verified (foreign workspace returned null).');

  // 6. Test Disconnect
  console.log('6. Testing account disconnection...');
  await emailAccountService.disconnectAccount(workspaceId, mockAccountId);
  const afterDisconnect = await emailAccountService.getAccountById(workspaceId, mockAccountId);
  if (afterDisconnect !== null) {
    console.error('FAIL: Account still present after disconnect');
    process.exit(1);
  }
  console.log('SUCCESS: Account disconnected cleanly.');

  console.log('--- ALL PHASE 7 EMAIL INTEGRATION TESTS PASSED CLEANLY ---');
  process.exit(0);
}

runEmailIntegrationSmokeTest().catch((err) => {
  console.error('Error during test execution:', err);
  process.exit(1);
});

