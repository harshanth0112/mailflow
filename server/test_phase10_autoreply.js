import assert from 'assert';
import mongoose from 'mongoose';
import { autoReplyService, devAutoReplyRules, devActivityLogs } from './src/services/autoReplyService.js';
import { devEmailAccounts } from './src/services/emailAccountService.js';
import { CONNECTION_STATUS } from './src/models/EmailAccount.js';
import { MATCH_TYPES } from './src/models/AutoReplyRule.js';
import { LOG_STATUS } from './src/models/ActivityLog.js';
import { emailProviderRegistry } from './src/services/email/EmailProviderRegistry.js';

async function runPhase10Tests() {
  console.log('--- MAILFLOW PHASE 10: AUTOMATIC REPLIES SMOKE TESTS ---');

  const workspaceId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();
  const emailAccountId = new mongoose.Types.ObjectId().toString();

  // Test 1: Setup connected EmailAccount with AutoReply enabled
  console.log('\n[Test 1] Setting up connected mailbox with auto-reply configuration');
  devEmailAccounts.set(emailAccountId, {
    _id: emailAccountId,
    workspaceId,
    userId,
    provider: 'gmail',
    emailAddress: 'support@mailflow.io',
    connectionStatus: CONNECTION_STATUS.CONNECTED,
    encryptedAccessToken: 'dummy_token',
    autoReplySettings: {
      enabled: true,
      cooldownMinutes: 30,
      defaultReplySubject: 'Re: {{subject}} [Auto-Ack]',
      defaultReplyBody: 'Default fallback response: We received your query.',
      ignoreNoReply: true,
      ignoreOwnMessages: true,
    },
  });
  console.log('✓ Mailbox registered and auto-reply enabled');

  // Test 2: Create keyword auto-reply rules with priorities
  console.log('\n[Test 2] Creating prioritized auto-reply rules');
  const rule1 = await autoReplyService.createRule({
    workspaceId,
    userId,
    data: {
      emailAccountId,
      name: 'Pricing Inquiry Response',
      priority: 10,
      conditions: {
        keywords: ['pricing', 'cost', 'quote'],
        matchType: MATCH_TYPES.CONTAINS,
        checkSubject: true,
        checkBody: true,
      },
      replyTemplate: {
        subject: 'Re: {{subject}} - Plans & Pricing',
        body: 'Here is our pricing: Starter is $29/mo, Pro is $99/mo.',
      },
    },
  });

  const rule2 = await autoReplyService.createRule({
    workspaceId,
    userId,
    data: {
      emailAccountId,
      name: 'Support & Help Desk',
      priority: 5,
      conditions: {
        keywords: ['help', 'issue', 'broken', 'error'],
        matchType: MATCH_TYPES.CONTAINS,
        checkSubject: true,
        checkBody: true,
      },
      replyTemplate: {
        subject: 'Re: {{subject}} - Support Ticket Created',
        body: 'Our support engineering team is investigating your inquiry.',
      },
    },
  });

  assert(rule1._id && rule2._id, 'Rules must have valid IDs');
  console.log('✓ Created 2 prioritized rules (Pricing priority 10, Support priority 5)');

  // Test 3: Process incoming message matching Rule 1
  console.log('\n[Test 3] Processing incoming message matching Pricing rule');
  const incoming1 = {
    id: 'msg-gmail-001',
    from: 'alice@client.com',
    subject: 'Request for pricing information',
    body: 'Could you please send over your subscription pricing?',
  };

  let mockSentList = [];
  const mockSend = async (opts) => {
    mockSentList.push(opts);
    return { messageId: `mock-reply-${Date.now()}` };
  };

  const res1 = await autoReplyService.processIncomingMessage({
    workspaceId,
    emailAccountId,
    message: incoming1,
    mockSend,
  });

  assert.strictEqual(res1.status, 'replied');
  assert.strictEqual(res1.ruleName, 'Pricing Inquiry Response');
  assert(res1.replySubject.includes('Plans & Pricing'));
  assert.strictEqual(mockSentList.length, 1);
  console.log('✓ High-priority Pricing rule matched and replied');

  // Test 4: Safeguard — Prevent duplicate replies to the same message
  console.log('\n[Test 4] Duplicate message prevention');
  const resDup = await autoReplyService.processIncomingMessage({
    workspaceId,
    emailAccountId,
    message: incoming1,
    mockSend,
  });
  assert.strictEqual(resDup.status, 'skipped');
  assert(resDup.reason.includes('Duplicate message'));
  assert.strictEqual(mockSentList.length, 1, 'Duplicate message must not trigger a second send');
  console.log('✓ Duplicate incoming message safely rejected');

  // Test 5: Safeguard — Sender cooldown prevents repeated spam
  console.log('\n[Test 5] Sender cooldown safeguard');
  const incomingRapid = {
    id: 'msg-gmail-002',
    from: 'alice@client.com', // same sender within 30 min cooldown
    subject: 'Another pricing question',
    body: 'What about enterprise pricing?',
  };
  const resCooldown = await autoReplyService.processIncomingMessage({
    workspaceId,
    emailAccountId,
    message: incomingRapid,
    mockSend,
  });
  assert.strictEqual(resCooldown.status, 'skipped');
  assert(resCooldown.reason.includes('Cooldown active'));
  console.log('✓ Sender cooldown active: Rapid repeat message skipped');

  // Test 6: Safeguard — Ignore own mailbox messages
  console.log('\n[Test 6] Ignore mailbox own message safeguard');
  const incomingSelf = {
    id: 'msg-gmail-003',
    from: 'support@mailflow.io', // Account's own address
    subject: 'Internal reminder',
    body: 'Check pricing document',
  };
  const resSelf = await autoReplyService.processIncomingMessage({
    workspaceId,
    emailAccountId,
    message: incomingSelf,
    mockSend,
  });
  assert.strictEqual(resSelf.status, 'skipped');
  assert.strictEqual(resSelf.reason, 'Self message ignored');
  console.log('✓ Self-sent message skipped to prevent loops');

  // Test 7: Safeguard — Ignore no-reply / automated senders
  console.log('\n[Test 7] Ignore automated / no-reply senders safeguard');
  const incomingNoReply = {
    id: 'msg-gmail-004',
    from: 'no-reply@service.com',
    subject: 'System alert: issue detected',
    body: 'Automated error notification',
  };
  const resNoReply = await autoReplyService.processIncomingMessage({
    workspaceId,
    emailAccountId,
    message: incomingNoReply,
    mockSend,
  });
  assert.strictEqual(resNoReply.status, 'skipped');
  assert(resNoReply.reason.includes('no-reply address ignored'));
  console.log('✓ No-reply address ignored cleanly');

  // Test 8: Default Fallback reply for unmatched messages
  console.log('\n[Test 8] Default fallback reply when no keyword rule matches');
  const incomingDefault = {
    id: 'msg-gmail-005',
    from: 'bob@partner.org',
    subject: 'General hello and partnership discussion',
    body: 'Would love to connect next week.',
  };
  const resDefault = await autoReplyService.processIncomingMessage({
    workspaceId,
    emailAccountId,
    message: incomingDefault,
    mockSend,
  });
  assert.strictEqual(resDefault.status, 'replied');
  assert.strictEqual(resDefault.ruleName, 'Default Reply');
  assert(resDefault.replySubject.includes('[Auto-Ack]'));
  console.log('✓ Default fallback reply sent for un-matched query');

  // Test 9: Disabled auto-reply behavior
  console.log('\n[Test 9] Disabled auto-reply on mailbox');
  await autoReplyService.updateAccountSettings({
    workspaceId,
    emailAccountId,
    settings: { enabled: false },
  });
  const incomingWhenDisabled = {
    id: 'msg-gmail-006',
    from: 'carol@company.com',
    subject: 'Pricing inquiry',
    body: 'Send pricing',
  };
  const resDisabled = await autoReplyService.processIncomingMessage({
    workspaceId,
    emailAccountId,
    message: incomingWhenDisabled,
    mockSend,
  });
  assert.strictEqual(resDisabled.status, 'skipped');
  assert(resDisabled.reason.includes('disabled'));
  console.log('✓ Incoming messages properly skipped when mailbox auto-reply is disabled');

  // Test 10: Multi-user tenant isolation
  console.log('\n[Test 10] Multi-workspace IDOR protection');
  const alienWorkspaceId = new mongoose.Types.ObjectId().toString();
  let threwIdor = false;
  try {
    await autoReplyService.deleteRule({
      workspaceId: alienWorkspaceId,
      ruleId: rule1._id,
    });
  } catch (err) {
    threwIdor = true;
  }
  assert(threwIdor, 'Cross-workspace rule deletion must be rejected');
  console.log('✓ Cross-workspace operations strictly isolated');

  console.log('\n======================================================');
  console.log('✓ ALL PHASE 10 AUTOMATIC REPLIES SMOKE TESTS PASSED!');
  console.log('======================================================\n');
}

runPhase10Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Phase 10 test failed:', err);
    process.exit(1);
  });

