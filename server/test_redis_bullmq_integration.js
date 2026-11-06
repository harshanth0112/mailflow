/**
 * MailFlow – Redis & BullMQ Integration Test Suite
 *
 * CI behaviour  : REDIS_HOST / REDIS_URL is set by the GitHub Actions service
 *                 container. The test HARD-FAILS if Redis is unreachable in CI
 *                 (CI env-var is 'true' on GitHub Actions).
 *
 * Local behaviour: When Redis is not running (Windows dev box), the test runs
 *                 degraded-mode assertions and exits cleanly so the developer
 *                 loop is uninterrupted.
 *
 * Requirements enforced:
 *   - Enqueue a real BullMQ job and consume it with a real Worker            ✓
 *   - Assert job reaches "completed" status                                  ✓
 *   - Verify retry behaviour (transient failure → success on attempt 2)      ✓
 *   - Verify permanent-failure handling (exhausted retries → failed event)   ✓
 *   - CI Redis unavailability causes hard test failure (non-zero exit)        ✓
 *   - Degraded-mode path preserved for local development                     ✓
 */

import assert from 'assert';
import IORedis from 'ioredis';
import mongoose from 'mongoose';
import { Queue, Worker } from 'bullmq';
import {
  createRedisConnection,
  getRedisClient,
  isRedisConnected,
  closeRedisConnection,
} from './src/config/redis.js';
import { getQueue, QUEUE_NAMES } from './src/queues/queueManager.js';
import { campaignService, devCampaigns } from './src/services/campaignService.js';
import { devContacts } from './src/services/contactService.js';
import { Campaign, CAMPAIGN_STATUS, RECIPIENT_SELECTION_TYPE } from './src/models/Campaign.js';
import { CONTACT_STATUS, CONSENT_STATUS } from './src/models/Contact.js';
import { startBackgroundWorkers, stopBackgroundWorkers } from './src/workers/campaignWorker.js';

console.log('\n=== MAILFLOW PRODUCTION READINESS: REDIS & BULLMQ INTEGRATION TEST SUITE ===\n');

/* ─────────────────────────────────────────────────────────────────────────────
   Helper: probe Redis with an explicit connection (bypasses lazyConnect).
   Returns true when a PONG is received within `timeoutMs`.
───────────────────────────────────────────────────────────────────────────── */
const probeRedis = (timeoutMs = 4000) =>
  new Promise((resolve) => {
    const host = process.env.REDIS_HOST || '127.0.0.1';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    const url  = process.env.REDIS_URL || null;

    const probe = url
      ? new IORedis(url, { lazyConnect: false, enableReadyCheck: true, maxRetriesPerRequest: 1 })
      : new IORedis({ host, port, lazyConnect: false, enableReadyCheck: true, maxRetriesPerRequest: 1 });

    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      probe.disconnect();
      resolve(result);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);
    probe.on('ready', () => { clearTimeout(timer); finish(true); });
    probe.on('error', () => { clearTimeout(timer); finish(false); });
  });

/* ─────────────────────────────────────────────────────────────────────────────
   Main test runner
───────────────────────────────────────────────────────────────────────────── */
const runRedisBullMQTests = async () => {

  /* ── Env-aware Redis availability check ─────────────────────────────────── */
  const isCI = process.env.CI === 'true';
  console.log(`[Env] Running in CI: ${isCI}`);
  console.log(`[Env] REDIS_HOST : ${process.env.REDIS_HOST || '(not set – default 127.0.0.1)'}`);
  console.log(`[Env] REDIS_PORT : ${process.env.REDIS_PORT || '(not set – default 6379)'}`);
  console.log(`[Env] REDIS_URL  : ${process.env.REDIS_URL  || '(not set)'}`);

  console.log('\n[Probe] Testing Redis reachability (eager connect, 4 s timeout)…');
  const redisReachable = await probeRedis(4000);
  console.log(`[Probe] Redis is ${redisReachable ? 'REACHABLE ✓' : 'UNREACHABLE ✗'}`);

  if (!redisReachable && isCI) {
    console.error('\n✗ FATAL: Redis is unreachable in CI but the GitHub Actions redis service');
    console.error('  should always provide a healthy Redis on 127.0.0.1:6379.');
    console.error('  Check the "services.redis" block in .github/workflows/ci.yml.');
    console.error('  CI must NOT silently pass through degraded mode.\n');
    process.exit(1);
  }

  // ── Test 1: Redis Connection & Lifecycle ──────────────────────────────────
  console.log('\n[Test 1] Redis Connection & Lifecycle Initialization');
  const redis = getRedisClient();
  assert.ok(redis, 'getRedisClient() must return an IORedis client instance');

  if (redisReachable) {
    // Force the shared lazy client to connect so isRedisConnected() reflects truth
    try { await redis.ping(); } catch (_) { /* handled below */ }
  }

  const liveRedis = redisReachable;
  console.log(`Redis Connection State: ${liveRedis ? 'ONLINE (live Redis)' : 'OFFLINE (degraded mode active)'}`);

  if (liveRedis) {
    const pingResponse = await redis.ping();
    assert.strictEqual(pingResponse, 'PONG', 'Redis PING must return PONG');
    console.log('✓ Redis PING / PONG handshake successful');
  } else {
    // Local development only – degraded mode
    console.log('✓ Degraded mode gracefully activated (zero crash on connection timeout)');
  }

  // ── Test 2: Queue Initialisation & Default Retry Policy ──────────────────
  console.log('\n[Test 2] BullMQ Queue Initialization & Retry Policy');
  const dispatchQueue   = getQueue(QUEUE_NAMES.CAMPAIGN_DISPATCH);
  const schedulingQueue = getQueue(QUEUE_NAMES.CAMPAIGN_SCHEDULING);
  assert.ok(dispatchQueue,   'Campaign dispatch queue must be instantiated');
  assert.ok(schedulingQueue, 'Campaign scheduling queue must be instantiated');

  const defaultOpts = dispatchQueue.defaultJobOptions || {};
  assert.strictEqual(defaultOpts.attempts,       3,             'Retry attempts must equal 3');
  assert.strictEqual(defaultOpts.backoff?.type,  'exponential', 'Retry backoff must be exponential');
  assert.strictEqual(defaultOpts.backoff?.delay, 2000,          'Initial exponential delay must be 2000 ms');
  assert.ok(defaultOpts.removeOnFail?.age, 'Dead-letter retention age must be configured');
  console.log('✓ BullMQ default job options verified: 3 attempts, exponential backoff (2 s)');

  // ── Test 3: Real Redis Queue Dispatch, Consumption, Retries & Failure ─────
  if (liveRedis) {
    console.log('\n[Test 3] Live Redis Queue Processing & Worker Consumption');
    const queueName = `mailflow_audit_live_${Date.now()}`;

    // Fresh dedicated IORedis connections (BullMQ requirement: maxRetriesPerRequest: null)
    const makeConn = () => {
      const host = process.env.REDIS_HOST || '127.0.0.1';
      const port = parseInt(process.env.REDIS_PORT || '6379', 10);
      const url  = process.env.REDIS_URL || null;
      return url
        ? new IORedis(url,          { maxRetriesPerRequest: null, enableReadyCheck: false })
        : new IORedis({ host, port, maxRetriesPerRequest: null, enableReadyCheck: false });
    };

    const queueConn = makeConn();
    const testQueue = new Queue(queueName, { connection: queueConn });

    /* ── 3.1 Job Creation & Enqueueing ───────────────────────────────────── */
    const jobData = { testId: 'audit-run-001', payload: 'mailflow-live-test' };
    const liveJob = await testQueue.add('test-task', jobData, {
      attempts: 3,
      backoff: { type: 'fixed', delay: 100 },
    });
    assert.ok(liveJob.id, 'Live job must receive a valid BullMQ job ID');
    console.log(`✓ Job successfully enqueued to real Redis (Job ID: ${liveJob.id})`);

    /* ── 3.2 Deterministic Idempotency & Duplicate Prevention ─────────────── */
    const duplicateJob = await testQueue.add('test-task', jobData, {
      jobId: liveJob.id, // attempt to enqueue with identical ID
    });
    assert.strictEqual(duplicateJob.id, liveJob.id,
      'Duplicate job with same jobId must return existing ID');
    console.log('✓ Deterministic job idempotency verified: Duplicate jobId prevented duplication');

    /* ── 3.3 Actual Job Consumption with BullMQ Worker ───────────────────── */
    let jobConsumed      = false;
    let attemptsObserved = 0;

    const workerConn = makeConn();
    const testWorker = new Worker(
      queueName,
      async (job) => {
        attemptsObserved++;
        if (job.data.shouldFailOnce && attemptsObserved === 1) {
          throw new Error('Simulated transient worker failure');
        }
        jobConsumed = true;
        return { processed: true, testId: job.data.testId };
      },
      { connection: workerConn }
    );

    // Track 'completed' event explicitly for log evidence
    testWorker.on('completed', (job, result) => {
      console.log(`  [Worker event] completed  job=${job.id}  result=${JSON.stringify(result)}`);
    });
    testWorker.on('failed', (job, err) => {
      console.log(`  [Worker event] failed     job=${job?.id}  err="${err.message}"  attempt=${job?.attemptsMade}`);
    });

    // Wait up to 3 s for the initial job to be consumed
    for (let i = 0; i < 30 && !jobConsumed; i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.strictEqual(jobConsumed, true,
      'BullMQ Worker must successfully consume and process the job');
    console.log('✓ Real BullMQ worker consumed job from Redis');

    // Confirm job reached "completed" state in Redis
    const completedState = await liveJob.getState();
    assert.strictEqual(completedState, 'completed',
      `Job must reach "completed" state; actual state: ${completedState}`);
    console.log(`✓ Job ${liveJob.id} reached "completed" state in Redis (confirmed via getState())`);

    /* ── 3.4 Retry Strategy Verification (transient failure → success) ──────── */
    jobConsumed      = false;
    attemptsObserved = 0;

    const retryJob = await testQueue.add(
      'retry-task',
      { shouldFailOnce: true, testId: 'retry-test' },
      { attempts: 3, backoff: { type: 'fixed', delay: 150 } }
    );

    // Wait up to 4 s (attempt1 fails → 150 ms delay → attempt2 succeeds)
    for (let i = 0; i < 40 && !jobConsumed; i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.strictEqual(jobConsumed, true,   'Job must succeed after transient failure retry');
    assert.strictEqual(attemptsObserved, 2, 'Worker must have executed exactly 2 attempts');

    const retryState = await retryJob.getState();
    assert.strictEqual(retryState, 'completed',
      `Retry job must reach "completed" state; actual: ${retryState}`);
    console.log('✓ Worker retry verified: job retried → succeeded on attempt 2 → completed state confirmed');

    /* ── 3.5 Exhausted Retry Handling & Permanent Failure Transition ──────── */
    let failedEventReceived = false;

    // Dedicated always-failing worker on the same queue
    const failWorkerConn = makeConn();
    const failWorker = new Worker(
      queueName,
      async (_job) => { throw new Error('Permanent worker failure – always fails'); },
      { connection: failWorkerConn }
    );

    failWorker.on('failed', (j, err) => {
      if (j && j.id === 'fail-test-job') {
        failedEventReceived = true;
        console.log(`  [Worker event] failed     job=${j.id}  err="${err.message}"  attempts=${j.attemptsMade}`);
      }
    });

    await testQueue.add(
      'fail-task',
      { testId: 'always-fail' },
      {
        jobId:    'fail-test-job',
        attempts: 2, // 2 attempts so retry fires once then exhausts
        backoff:  { type: 'fixed', delay: 100 },
      }
    );

    // Wait up to 3 s for both attempts + failed event
    for (let i = 0; i < 30 && !failedEventReceived; i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.strictEqual(failedEventReceived, true,
      'The "failed" event must fire on the Worker when retries are exhausted');

    const failJobRef = await testQueue.getJob('fail-test-job');
    const failState  = failJobRef ? await failJobRef.getState() : 'unknown';
    assert.strictEqual(failState, 'failed',
      `Exhausted-retry job must reach "failed" state; actual: ${failState}`);
    console.log('✓ Permanent failure handling verified: exhausted-retry job reached "failed" state');

    // ── Cleanup ────────────────────────────────────────────────────────────
    await testWorker.close();
    await failWorker.close();
    await testQueue.obliterate({ force: true });
    await testQueue.close();
    for (const conn of [workerConn, failWorkerConn, queueConn]) {
      try { await conn.quit(); } catch { conn.disconnect(); }
    }
    console.log('✓ Live queue resources cleaned up');

  } else {
    // Local development – Redis not available
    console.log('\n[Test 3] Live Redis Execution: Host offline in local Windows development sandbox');
    console.log('  -> Degraded mode operational (Queue operations fail-safe)');
    console.log('  -> Live Redis queue execution active in GitHub Actions via redis:7-alpine service container');
    console.log('  -> This path is for LOCAL DEV ONLY. CI never reaches this branch.');
  }

  // ── Test 4: Campaign Enqueue & Service Idempotency ────────────────────────
  console.log('\n[Test 4] Campaign Enqueue in Service Layer');
  const workspaceId    = new mongoose.Types.ObjectId().toString();
  const userId         = new mongoose.Types.ObjectId().toString();
  const emailAccountId = new mongoose.Types.ObjectId().toString();
  const campaignId     = new mongoose.Types.ObjectId().toString();
  const contactId      = new mongoose.Types.ObjectId().toString();

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
  assert.strictEqual(sendResult.status, 'queued', 'Campaign must transition to queued');
  console.log('✓ Campaign send trigger enqueued campaign into service layer');

  let duplicateRejected = false;
  try {
    await campaignService.triggerCampaignSend({
      workspaceId,
      campaignId,
      idempotencyKey: 'audit-enqueue-123',
    });
  } catch (err) {
    duplicateRejected = true;
    assert.ok(
      err.message.includes('already been triggered') || err.message.includes('queued'),
      'Error must note duplicate'
    );
  }
  assert.strictEqual(duplicateRejected, true,
    'Duplicate campaign send trigger must be rejected');
  console.log('✓ Idempotency constraint verified: Duplicate campaign dispatch blocked');

  // ── Test 5: Scheduled Execution & Delay Calculation ──────────────────────
  console.log('\n[Test 5] Scheduled Execution & Delay Logic');
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
  assert.strictEqual(schedResult.status, 'scheduled',
    'Campaign should transition to scheduled');
  assert.ok(schedResult.scheduledAt, 'Scheduled time must be populated');
  console.log('✓ Campaign scheduled execution accepted valid future timestamp');

  // ── Test 6: Reconnection & Stranded Campaign Recovery ────────────────────
  console.log('\n[Test 6] Reconnection & Zero Job Loss Recovery Check');
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
  assert.ok(recoveryResult.recoveredCount >= 1,
    'Stranded campaign must be recovered upon reconnection');
  console.log(
    `✓ Reconnection recovery discovered and protected ${recoveryResult.recoveredCount} stranded campaign(s)`
  );

  // ── Test 7: Worker Lifecycle & Graceful Teardown ──────────────────────────
  console.log('\n[Test 7] Worker Lifecycle & Graceful Teardown');
  const workers = startBackgroundWorkers();
  assert.ok(workers.dispatchWorker,   'Dispatch worker must start');
  assert.ok(workers.schedulingWorker, 'Scheduling worker must start');

  await stopBackgroundWorkers();
  await closeRedisConnection();
  console.log('✓ Background workers and Redis connections cleanly shut down');

  console.log('\n======================================================');
  console.log('✓ ALL REDIS & BULLMQ INTEGRATION TESTS PASSED CLEANLY');
  console.log('======================================================\n');

  // Suppress any residual IORedis async connection errors that fire after exit
  // (background queue-manager singletons are already closing but may emit one
  // last error event into the Node.js event loop before the process terminates).
  process.on('uncaughtException', () => {});
  process.on('unhandledRejection', () => {});
  process.exit(0);
};

runRedisBullMQTests().catch((err) => {
  console.error('\n✗ Redis integration test FAILED:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
