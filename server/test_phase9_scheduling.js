import assert from 'assert';
import mongoose from 'mongoose';
import { campaignService, devCampaigns } from './src/services/campaignService.js';
import { CAMPAIGN_STATUS, RECIPIENT_SELECTION_TYPE } from './src/models/Campaign.js';
import { automationService, devAutomations } from './src/services/automationService.js';
import { AUTOMATION_STATUS, AUTOMATION_TRIGGER_TYPES, AUTOMATION_ACTION_TYPES } from './src/models/AutomationRule.js';
import { QUEUE_NAMES, getQueueMetrics } from './src/queues/queueManager.js';
import { isRedisConnected, closeRedisConnection } from './src/config/redis.js';

async function runPhase9Tests() {
  console.log('--- MAILFLOW PHASE 9: SCHEDULING & AUTOMATION SMOKE TESTS ---');

  const workspaceId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();
  const emailAccountId = new mongoose.Types.ObjectId().toString();

  // Test 1: Queue Manager module loads cleanly and reports Redis status
  console.log('\n[Test 1] Queue Manager & Redis degraded mode test');
  const metrics = await getQueueMetrics();
  assert(metrics !== null, 'Queue metrics should return an object');
  console.log(`Redis connected: ${metrics.redisConnected}`);
  console.log('✓ Queue Manager initialized without fatal crash');

  // Test 2: Scheduling campaign validation (rejection of past timestamps)
  console.log('\n[Test 2] Campaign scheduling past timestamp validation');
  const campaign1Id = new mongoose.Types.ObjectId().toString();
  devCampaigns.set(campaign1Id, {
    _id: campaign1Id,
    workspaceId,
    createdBy: userId,
    name: 'Scheduled Test Campaign',
    subject: 'Subject Line',
    senderEmailAccountId: emailAccountId,
    recipientConfiguration: { type: RECIPIENT_SELECTION_TYPE.ALL_ELIGIBLE },
    status: CAMPAIGN_STATUS.DRAFT,
  });

  let threwPast = false;
  try {
    const pastTime = new Date(Date.now() - 3600000).toISOString();
    await campaignService.scheduleCampaign({
      workspaceId,
      campaignId: campaign1Id,
      scheduledAt: pastTime,
    });
  } catch (err) {
    threwPast = true;
    assert(err.message.includes('future'), `Error message should mention future: ${err.message}`);
  }
  assert(threwPast, 'Scheduling with past timestamp must be rejected');
  console.log('✓ Past timestamps properly rejected');

  // Test 3: Campaign scheduling with valid future timestamp
  console.log('\n[Test 3] Campaign scheduling transition to SCHEDULED');
  const futureTime = new Date(Date.now() + 86400000).toISOString(); // +1 day
  const scheduledCampaign = await campaignService.scheduleCampaign({
    workspaceId,
    campaignId: campaign1Id,
    scheduledAt: futureTime,
    timezone: 'America/New_York',
  });
  assert.strictEqual(scheduledCampaign.status, CAMPAIGN_STATUS.SCHEDULED);
  assert.strictEqual(scheduledCampaign.timezone, 'America/New_York');
  console.log('✓ Campaign successfully scheduled with future timestamp and timezone');

  // Test 4: Rescheduling an already scheduled campaign
  console.log('\n[Test 4] Rescheduling an existing scheduled campaign');
  const rescheduledTime = new Date(Date.now() + 172800000).toISOString(); // +2 days
  const rescheduled = await campaignService.rescheduleCampaign({
    workspaceId,
    campaignId: campaign1Id,
    scheduledAt: rescheduledTime,
    timezone: 'UTC',
  });
  assert.strictEqual(rescheduled.status, CAMPAIGN_STATUS.SCHEDULED);
  assert.strictEqual(rescheduled.timezone, 'UTC');
  console.log('✓ Campaign successfully rescheduled');

  // Test 5: Cancelling a scheduled campaign
  console.log('\n[Test 5] Cancelling a scheduled campaign');
  const cancelResult = await campaignService.cancelCampaign({
    workspaceId,
    campaignId: campaign1Id,
  });
  assert.strictEqual(cancelResult.status, CAMPAIGN_STATUS.CANCELLED);
  console.log('✓ Campaign cancellation transitions to CANCELLED state');

  // Test 6: Cross-workspace IDOR protection on scheduling & cancel
  console.log('\n[Test 6] Cross-workspace IDOR protection');
  const alienWorkspaceId = new mongoose.Types.ObjectId().toString();
  let threwIdor = false;
  try {
    await campaignService.cancelCampaign({
      workspaceId: alienWorkspaceId,
      campaignId: campaign1Id,
    });
  } catch (err) {
    threwIdor = true;
  }
  assert(threwIdor, 'Cross-workspace cancel operation must be rejected');
  console.log('✓ Cross-workspace scheduling actions strictly isolated');

  // Test 7: Automation Rule creation, listing, toggle, and deletion
  console.log('\n[Test 7] Automation Rule CRUD and Status Management');
  const createdAuto = await automationService.createAutomation({
    workspaceId,
    userId,
    data: {
      name: 'Onboarding Welcome Flow',
      description: 'Send email when contact subscribes',
      trigger: {
        type: AUTOMATION_TRIGGER_TYPES.CONTACT_SUBSCRIBED,
        configuration: {},
      },
      action: {
        type: AUTOMATION_ACTION_TYPES.SEND_CAMPAIGN,
        configuration: {
          campaignId: campaign1Id,
          delayMinutes: 10,
        },
      },
    },
  });
  assert(createdAuto._id, 'Automation rule must have an ID');
  assert.strictEqual(createdAuto.status, AUTOMATION_STATUS.ACTIVE);
  console.log('✓ Automation rule created successfully');

  // List automations
  const list = await automationService.listAutomations({ workspaceId });
  assert.strictEqual(list.automations.length, 1);
  console.log('✓ Automation listing works correctly');

  // Toggle status
  const toggled = await automationService.toggleStatus({
    workspaceId,
    automationId: createdAuto._id,
  });
  assert.strictEqual(toggled.status, AUTOMATION_STATUS.INACTIVE);
  console.log('✓ Automation toggle active/inactive works');

  // Cross-workspace protection on automation
  let threwAutoIdor = false;
  try {
    await automationService.getAutomationById({
      workspaceId: alienWorkspaceId,
      automationId: createdAuto._id,
    });
  } catch (err) {
    threwAutoIdor = true;
  }
  assert(threwAutoIdor, 'Cross-workspace automation access must be rejected');
  console.log('✓ Automation rules workspace isolation verified');

  // Delete automation
  const delRes = await automationService.deleteAutomation({
    workspaceId,
    automationId: createdAuto._id,
  });
  assert.strictEqual(delRes.success, true);
  console.log('✓ Automation deleted successfully');

  console.log('\n======================================================');
  console.log('✓ ALL PHASE 9 SCHEDULING & AUTOMATION TESTS PASSED!');
  console.log('Note: Full BullMQ queue dispatch relies on a live Redis instance');
  console.log('======================================================\n');
}

runPhase9Tests()
  .then(async () => {
    await closeRedisConnection();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Phase 9 test failed:', err);
    await closeRedisConnection();
    process.exit(1);
  });

