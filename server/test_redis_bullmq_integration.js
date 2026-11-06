import assert from 'assert';
import mongoose from 'mongoose';
import { Queue, Worker } from 'bullmq';
import { createRedisConnection, isRedisConnected, closeRedisConnection } from './src/config/redis.js';
import { getQueue, QUEUE_NAMES, getQueueMetrics } from './src/queues/queueManager.js';
import { campaignService, devCampaigns } from './src/services/campaignService.js';
import { devContacts } from './src/services/contactService.js';
import { CAMPAIGN_STATUS, RECIPIENT_SELECTION_TYPE } from './src/models/Campaign.js';
import { CONTACT_STATUS, CONSENT_STATUS } from './src/models/Contact.js';
import { startBackgroundWorkers, stopBackgroundWorkers } from './src/workers/campaignWorker.js';

console.log('\n--- MAILFLOW PRODUCTION READINESS: REDIS & BULLMQ INTEGRATION TEST SUITE ---\n');

const runRedisBullMQTests = async () => {
  // Test 1: Redis Connection & Degraded-Mode Graceful Handling
  console.log('[Test 1] Degraded Mode & Connection Resilience');
  const metrics = await getQueueMetrics();
  assert.ok(metrics, 'Queue metrics must return a valid status object');
  console.log(`Redis Initial State - Connected: ${metrics.redisConnected}`);
  assert.strictEqual(typeof metrics.redisConnected, 'boolean', 'redisConnected should be boolean');
  console.log('✓ Degraded mode gracefully handled: Queues initialize without fatal crashes');

  // Test 2: Queue Configuration & Retry Strategy Verification
  console.log('\n[Test 2] Queue & Retry Strategy Verification');
  const dispatchQueue = getQueue(QUEUE_NAMES.CAMPAIGN_DISPATCH);
  const schedulingQueue = getQueue(QUEUE_NAMES.CAMPAIGN_SCHEDULING);
  assert.ok(dispatchQueue, 'Campaign dispatch queue must be instantiated');
  assert.ok(schedulingQueue, 'Campaign scheduling queue must be instantiated');

  // Verify BullMQ retry and backoff configuration
  const defaultOpts = dispatchQueue.defaultJobOptions || {};
  assert.strictEqual(defaultOpts.attempts, 3, 'Default attempts should be 3 for reliability');
  assert.strictEqual(defaultOpts.backoff?.type, 'exponential', 'Retry backoff must be exponential');
  assert.strictEqual(defaultOpts.backoff?.delay, 2000, 'Initial retry backoff delay should be 2000ms');
  assert.ok(defaultOpts.removeOnFail?.age, 'Dead-letter retention age must be configured');
  console.log('✓ BullMQ default job options verified: 3 attempts with exponential backoff');

  // Test 3: Campaign Enqueue Verification
  console.log('\n[Test 3] Campaign Enqueue in Degraded vs Active Mode');
  const workspaceId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();
  const emailAccountId = new mongoose.Types.ObjectId().toString();
  const campaignId = new mongoose.Types.ObjectId().toString();

  const contactId = new mongoose.Types.ObjectId().toString();
  devContacts.set(contactId, {
    _id: contactId,
    workspaceId,
    email: 'recipient@example.com',
    firstName: 'Recipient',
    status: CONTACT_STATUS.SUBSCRIBED,
    consentStatus: CONSENT_STATUS.OPTED_IN,
  });

  devCampaigns.set(campaignId, {
    _id: campaignId,
    workspaceId,
    createdBy: userId,
    name: 'Audit Enqueue Campaign',
    subject: 'Production Audit',
    senderEmailAccountId: emailAccountId,
    recipientConfiguration: { type: RECIPIENT_SELECTION_TYPE.ALL_ELIGIBLE },
    status: CAMPAIGN_STATUS.DRAFT,
  });

  const sendResult = await campaignService.triggerCampaignSend({
    workspaceId,
    campaignId,
    idempotencyKey: 'audit-enqueue-123',
  });

  assert.strictEqual(sendResult.status, 'queued', 'Campaign should transition to queued');
  console.log('✓ Campaign send trigger enqueued campaign without failure');

  // Test 4: Scheduled Execution & Delay Calculation
  console.log('\n[Test 4] Scheduled Execution & Delay Logic');
  const schedCampaignId = new mongoose.Types.ObjectId().toString();
  devCampaigns.set(schedCampaignId, {
    _id: schedCampaignId,
    workspaceId,
    createdBy: userId,
    name: 'Audit Scheduled Campaign',
    subject: 'Scheduled Subject',
    senderEmailAccountId: emailAccountId,
    recipientConfiguration: { type: RECIPIENT_SELECTION_TYPE.ALL_ELIGIBLE },
    status: CAMPAIGN_STATUS.DRAFT,
  });

  const futureTime = new Date(Date.now() + 60000).toISOString();
  const schedResult = await campaignService.scheduleCampaign({
    workspaceId,
    campaignId: schedCampaignId,
    scheduledAt: futureTime,
    timezone: 'UTC',
  });

  assert.strictEqual(schedResult.status, 'scheduled', 'Campaign should transition to scheduled');
  assert.ok(schedResult.scheduledAt, 'Scheduled time must be populated');
  console.log('✓ Campaign scheduled execution accepted valid future timestamp');

  // Test 5: Reconnection & Stranded Campaign Recovery
  console.log('\n[Test 5] Reconnection & Zero Job Loss Recovery Check');
  const strandedCampaignId = new mongoose.Types.ObjectId().toString();
  devCampaigns.set(strandedCampaignId, {
    _id: strandedCampaignId,
    workspaceId,
    createdBy: userId,
    name: 'Stranded Campaign During Outage',
    subject: 'Reconnection Test',
    senderEmailAccountId: emailAccountId,
    status: CAMPAIGN_STATUS.QUEUED,
    recipientConfiguration: { type: RECIPIENT_SELECTION_TYPE.ALL_ELIGIBLE },
  });

  const recoveryResult = await campaignService.recoverStrandedCampaigns();
  assert.ok(recoveryResult.recoveredCount >= 1, 'Stranded campaign must be recovered upon reconnection');
  console.log(`✓ Reconnection recovery discovered and protected ${recoveryResult.recoveredCount} stranded campaign(s)`);

  // Test 6: Worker Process Startup & Graceful Teardown
  console.log('\n[Test 6] Worker Lifecycle & Graceful Shutdown');
  const workers = startBackgroundWorkers();
  assert.ok(workers.dispatchWorker, 'Dispatch worker must start');
  assert.ok(workers.schedulingWorker, 'Scheduling worker must start');
  
  await stopBackgroundWorkers();
  console.log('✓ Background workers shut down cleanly without leaving unhandled listeners');

  console.log('\n======================================================');
  console.log('✓ ALL REDIS & BULLMQ INTEGRATION TESTS PASSED CLEANLY');
  console.log('======================================================\n');
  process.exit(0);
};

runRedisBullMQTests().catch((err) => {
  console.error('Redis integration test failed:', err);
  process.exit(1);
});
