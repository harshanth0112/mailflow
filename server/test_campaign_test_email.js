import assert from 'assert';
import mongoose from 'mongoose';
import { campaignService, devCampaigns } from './src/services/campaignService.js';
import { devEmailAccounts } from './src/services/emailAccountService.js';
import { emailProviderRegistry } from './src/services/email/EmailProviderRegistry.js';
import { encryptToken } from './src/utils/cryptoUtils.js';
import { CONNECTION_STATUS } from './src/models/EmailAccount.js';
import { CAMPAIGN_STATUS, RECIPIENT_SELECTION_TYPE } from './src/models/Campaign.js';

console.log('\n======================================================');
console.log('--- MAILFLOW: CAMPAIGN TEST EMAIL & MULTI-GMAIL SUITE ---');
console.log('======================================================\n');

async function runTestEmailSuite() {
  const workspaceA = new mongoose.Types.ObjectId().toString();
  const workspaceB = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();

  // 1. Setup Gmail 1 in Workspace A
  const gmailAccount1Id = new mongoose.Types.ObjectId().toString();
  devEmailAccounts.set(gmailAccount1Id, {
    _id: gmailAccount1Id,
    workspaceId: workspaceA,
    userId,
    provider: 'gmail',
    emailAddress: 'sales@company.com',
    displayName: 'Sales Mailbox',
    connectionStatus: CONNECTION_STATUS.CONNECTED,
    encryptedAccessToken: encryptToken('mock-access-token-1'),
    encryptedRefreshToken: encryptToken('mock-refresh-token-1'),
    tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
  });

  // 2. Setup Gmail 2 in Workspace A (Multiple Gmail accounts test)
  const gmailAccount2Id = new mongoose.Types.ObjectId().toString();
  devEmailAccounts.set(gmailAccount2Id, {
    _id: gmailAccount2Id,
    workspaceId: workspaceA,
    userId,
    provider: 'gmail',
    emailAddress: 'support@company.com',
    displayName: 'Support Mailbox',
    connectionStatus: CONNECTION_STATUS.CONNECTED,
    encryptedAccessToken: encryptToken('mock-access-token-2'),
    encryptedRefreshToken: encryptToken('mock-refresh-token-2'),
    tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
  });

  // 3. Setup disconnected / expired account in Workspace A
  const disconnectedAccountId = new mongoose.Types.ObjectId().toString();
  devEmailAccounts.set(disconnectedAccountId, {
    _id: disconnectedAccountId,
    workspaceId: workspaceA,
    userId,
    provider: 'gmail',
    emailAddress: 'inactive@company.com',
    displayName: 'Inactive Mailbox',
    connectionStatus: CONNECTION_STATUS.DISCONNECTED,
    encryptedAccessToken: encryptToken('mock-access-token-old'),
    encryptedRefreshToken: encryptToken('mock-refresh-token-old'),
  });

  // 4. Setup foreign account in Workspace B
  const foreignAccountId = new mongoose.Types.ObjectId().toString();
  devEmailAccounts.set(foreignAccountId, {
    _id: foreignAccountId,
    workspaceId: workspaceB,
    userId,
    provider: 'gmail',
    emailAddress: 'foreign@other.com',
    displayName: 'Foreign Mailbox',
    connectionStatus: CONNECTION_STATUS.CONNECTED,
    encryptedAccessToken: encryptToken('mock-access-token-b'),
    encryptedRefreshToken: encryptToken('mock-refresh-token-b'),
  });

  // Mock Gmail Provider sendEmail to inspect dispatched sender
  const dispatchedEmails = [];
  const gmailProvider = emailProviderRegistry.get('gmail');
  const originalSendEmail = gmailProvider.sendEmail;
  gmailProvider.sendEmail = async (options) => {
    dispatchedEmails.push(options);
    return { success: true, messageId: `msg-${Date.now()}` };
  };

  try {
    // [Test 1] Create draft campaign without senderEmailAccountId initially
    console.log('[Test 1] Draft campaign with no initial sender account');
    const campNoSender = await campaignService.createCampaign({
      workspaceId: workspaceA,
      userId,
      data: {
        name: 'Draft Without Sender',
        subject: 'Hello World',
        textContent: 'Hi {{firstName}}, check out this update for {{company}}!',
        recipientConfiguration: { type: RECIPIENT_SELECTION_TYPE.ALL_ELIGIBLE },
      },
    });
    assert.strictEqual(campNoSender.status, CAMPAIGN_STATUS.DRAFT);
    console.log('✓ Campaign draft successfully created without sender account');

    // [Test 2] Test email rejected when no sender account provided or selected
    console.log('\n[Test 2] Validation: Reject test email when no sender account is selected');
    await assert.rejects(
      async () => {
        await campaignService.sendTestEmail({
          workspaceId: workspaceA,
          campaignId: campNoSender._id,
          recipientEmail: 'preview@recipient.com',
        });
      },
      /Please select a sender email account before dispatching a test email/,
      'Must reject test dispatch when no sender account is selected'
    );
    console.log('✓ Descriptive error thrown when attempting to send test email with no sender account');

    // [Test 3] Test email succeeds with explicit senderEmailAccountId in request (e.g. Gmail 1)
    console.log('\n[Test 3] Dispatch test email with selected sender account (Gmail 1: sales@company.com)');
    const testResult1 = await campaignService.sendTestEmail({
      workspaceId: workspaceA,
      campaignId: campNoSender._id,
      recipientEmail: 'client@domain.com',
      senderEmailAccountId: gmailAccount1Id,
    });
    assert.strictEqual(testResult1.success, true);
    assert.strictEqual(dispatchedEmails.length, 1);
    assert.strictEqual(dispatchedEmails[0].from, 'sales@company.com');
    assert.strictEqual(dispatchedEmails[0].to, 'client@domain.com');
    assert.ok(dispatchedEmails[0].subject.includes('[TEST]'));
    console.log('✓ Test email dispatched cleanly from selected Gmail 1 sender');

    // [Test 4] Dispatch test email with different selected sender account (Gmail 2: support@company.com)
    console.log('\n[Test 4] Dispatch test email with different selected account (Gmail 2: support@company.com)');
    const testResult2 = await campaignService.sendTestEmail({
      workspaceId: workspaceA,
      campaignId: campNoSender._id,
      recipientEmail: 'client@domain.com',
      senderEmailAccountId: gmailAccount2Id,
    });
    assert.strictEqual(testResult2.success, true);
    assert.strictEqual(dispatchedEmails.length, 2);
    assert.strictEqual(dispatchedEmails[1].from, 'support@company.com');
    console.log('✓ Test email dispatched cleanly from selected Gmail 2 sender (multiple Gmail accounts verified)');

    // [Test 5] Reject test email when sender account is disconnected or revoked
    console.log('\n[Test 5] Validation: Reject test email when sender account is disconnected');
    await assert.rejects(
      async () => {
        await campaignService.sendTestEmail({
          workspaceId: workspaceA,
          campaignId: campNoSender._id,
          recipientEmail: 'client@domain.com',
          senderEmailAccountId: disconnectedAccountId,
        });
      },
      /Sender email account is currently disconnected/,
      'Must reject disconnected account'
    );
    console.log('✓ Disconnected sender account cleanly rejected with status feedback');

    // [Test 6] Multi-tenant IDOR protection: Foreign workspace account cannot be used
    console.log('\n[Test 6] Security: Foreign workspace sender account blocked (IDOR Protection)');
    await assert.rejects(
      async () => {
        await campaignService.sendTestEmail({
          workspaceId: workspaceA,
          campaignId: campNoSender._id,
          recipientEmail: 'client@domain.com',
          senderEmailAccountId: foreignAccountId,
        });
      },
      /Configured sender mailbox account was not found or access denied/,
      'Cross-workspace sender account access must be blocked'
    );
    console.log('✓ Cross-workspace account hijacking strictly prevented');

    // [Test 7] Dynamic placeholder personalization in test email
    console.log('\n[Test 7] Template personalization in test email preview');
    assert.ok(
      dispatchedEmails[0].text.includes('Preview') && dispatchedEmails[0].text.includes('MailFlow Preview Corp'),
      'Personalized placeholders must be populated with preview sample data'
    );
    console.log('✓ Personalization tags (firstName, company, email) properly substituted in test emails');

    console.log('\n======================================================');
    console.log('✓ ALL TEST EMAIL & MULTI-GMAIL TESTS PASSED CLEANLY');
    console.log('======================================================\n');
  } finally {
    gmailProvider.sendEmail = originalSendEmail;
  }
}

runTestEmailSuite().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
