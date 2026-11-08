import { Worker } from 'bullmq';
import mongoose from 'mongoose';
import { getRedisClient, createRedisConnection } from '../config/redis.js';
import { QUEUE_NAMES } from '../queues/queueManager.js';
import { Campaign, CAMPAIGN_STATUS } from '../models/Campaign.js';
import { CampaignRecipient, RECIPIENT_STATUS } from '../models/CampaignRecipient.js';
import { Contact, CONSENT_STATUS, CONTACT_STATUS } from '../models/Contact.js';
import { EmailAccount } from '../models/EmailAccount.js';
import { getCampaignEmailProvider } from '../services/email/campaignEmailProvider.js';
import { decryptToken } from '../utils/cryptoUtils.js';
import { personalizeContent } from '../utils/templatePersonalizer.js';
import { generateRandomToken } from '../utils/tokenUtils.js';
import { trackingService } from '../services/trackingService.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let dispatchWorker = null;
let schedulingWorker = null;

/**
 * Campaign Delivery Worker Processor
 * Executes due campaign dispatch with controlled concurrency, pre-send re-validation,
 * secure credential retrieval, and accurate delivery state tracking.
 */
export const processCampaignDispatch = async (job) => {
  const { campaignId, workspaceId } = job.data;
  console.log(`[Worker] Starting campaign dispatch processing: Campaign ID ${campaignId}`);

  const campaign = await Campaign.findOne({ _id: campaignId, workspaceId });
  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found in workspace ${workspaceId}`);
  }

  // Safety check: Don't process if cancelled
  if (campaign.status === CAMPAIGN_STATUS.CANCELLED) {
    console.log(`[Worker] Campaign ${campaignId} was cancelled. Skipping dispatch.`);
    return { status: 'cancelled', dispatched: 0 };
  }

  // Transition to PROCESSING
  campaign.status = CAMPAIGN_STATUS.PROCESSING;
  campaign.startedAt = campaign.startedAt || new Date();
  await campaign.save();

  // Load Sender Email Account & decrypt tokens
  const senderAccount = await EmailAccount.findOne({
    _id: campaign.senderEmailAccountId,
    workspaceId,
  }).select('+encryptedAccessToken +encryptedRefreshToken');

  if (!senderAccount) {
    campaign.status = CAMPAIGN_STATUS.FAILED;
    await campaign.save();
    throw new Error(`Sender email account for campaign ${campaignId} was not found or access denied.`);
  }

  const provider = getCampaignEmailProvider(senderAccount);
  const isSendliberty = provider.name === 'sendliberty';
  const accessToken = isSendliberty ? undefined : decryptToken(senderAccount.encryptedAccessToken);
  const refreshToken = isSendliberty ? undefined : decryptToken(senderAccount.encryptedRefreshToken);

  // Load pending recipient records for this campaign
  const pendingRecipients = await CampaignRecipient.find({
    campaignId,
    workspaceId,
    recipientStatus: RECIPIENT_STATUS.PENDING,
  });

  console.log(`[Worker] Processing ${pendingRecipients.length} pending recipient records.`);

  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  let stopDispatch = false;

  // Process recipients with controlled concurrency (e.g. 5 at a time) to respect provider rate limits
  const CONCURRENCY = isSendliberty ? 1 : 5;
  for (let i = 0; i < pendingRecipients.length; i += CONCURRENCY) {
    // Check if campaign was cancelled during execution
    const freshCheck = await Campaign.findById(campaignId).select('status');
    if (freshCheck && freshCheck.status === CAMPAIGN_STATUS.CANCELLED) {
      console.log(`[Worker] Campaign ${campaignId} was cancelled mid-flight. Halting further recipients.`);
      break;
    }

    const batch = pendingRecipients.slice(i, i + CONCURRENCY);

    await Promise.all(
      batch.map(async (recipient) => {
        try {
          // 1. Re-verify Contact Consent and Subscription IMMEDIATELY before dispatch!
          let contact = null;
          if (recipient.contactId) {
            contact = await Contact.findById(recipient.contactId);
          } else {
            contact = await Contact.findOne({ workspaceId, email: recipient.email });
          }

          if (
            !contact ||
            contact.status !== CONTACT_STATUS.SUBSCRIBED ||
            contact.consentStatus !== CONSENT_STATUS.OPTED_IN ||
            contact.unsubscribedAt
          ) {
            recipient.recipientStatus = RECIPIENT_STATUS.SKIPPED_INELIGIBLE;
            recipient.errorMessage = 'Contact is unsubscribed, suppressed, or lacks active opted-in consent';
            await recipient.save();
            skippedCount++;
            return;
          }

          // 2. Personalize subject and content safely
          const personalizedSubject = personalizeContent({
            content: campaign.subject,
            contact,
            isHtml: false,
          });

          const trackingToken = recipient.trackingToken || generateRandomToken(24);
          recipient.trackingToken = trackingToken;

          const rawHtml = campaign.htmlContent || `<p>${campaign.textContent || ''}</p>`;
          const personalizedHtml = personalizeContent({
            content: rawHtml,
            contact,
            isHtml: true,
          });

          const trackedHtml = trackingService.injectTracking({
            html: personalizedHtml,
            trackingToken,
            baseUrl: env.API_BASE_URL || 'http://localhost:5000',
          });

          const personalizedText = personalizeContent({
            content: campaign.textContent || '',
            contact,
            isHtml: false,
          });

          // 3. Dispatch through provider with attachments support
          const result = await provider.sendEmail({
            from: senderAccount.emailAddress,
            to: recipient.email,
            subject: personalizedSubject,
            html: trackedHtml,
            text: personalizedText,
            attachments: campaign.attachments || [],
            accessToken,
            refreshToken,
          });

          recipient.recipientStatus = RECIPIENT_STATUS.SENT;
          recipient.sentAt = new Date();
          recipient.providerMessageId = result.messageId || 'MOCK_SENT';
          await recipient.save();
          sentCount++;
        } catch (err) {
          const maxAttempts = job.opts?.attempts || 3;
          if (isSendliberty && err.retryable && job.attemptsMade < maxAttempts - 1) {
            logger.warn('Campaign recipient delivery will be retried.', {
              campaignId,
              errorCode: err.code,
            });
            if (err.retryAfterMs > 0) {
              await new Promise((resolve) => setTimeout(resolve, err.retryAfterMs));
            }
            throw err;
          }
          if (isSendliberty && err.retryable) {
            const failedRecipients = [
              recipient,
              ...pendingRecipients.slice(i + 1),
            ];
            for (const failedRecipient of failedRecipients) {
              failedRecipient.recipientStatus = RECIPIENT_STATUS.FAILED;
              failedRecipient.errorCode = err.code || 'SEND_ERROR';
              failedRecipient.errorMessage = 'Sendliberty retry limit was exhausted before delivery.';
              await failedRecipient.save();
              failedCount++;
            }
            stopDispatch = true;
            return;
          }
          logger.warn('Campaign recipient delivery failed.', {
            campaignId,
            errorName: err.name,
            errorCode: err.code,
          });
          recipient.recipientStatus = RECIPIENT_STATUS.FAILED;
          recipient.errorCode = err.code || 'SEND_ERROR';
          recipient.errorMessage = err.message || 'Unknown provider error';
          await recipient.save();
          failedCount++;
        }
      })
    );
    if (stopDispatch) break;
  }

  // Update Campaign Statistics and Final Status
  campaign.statistics.sent = await CampaignRecipient.countDocuments({
    campaignId,
    workspaceId,
    recipientStatus: RECIPIENT_STATUS.SENT,
  });
  campaign.statistics.failed = await CampaignRecipient.countDocuments({
    campaignId,
    workspaceId,
    recipientStatus: RECIPIENT_STATUS.FAILED,
  });
  campaign.completedAt = new Date();

  if (campaign.status !== CAMPAIGN_STATUS.CANCELLED) {
    if (campaign.statistics.failed === 0 && campaign.statistics.sent > 0) {
      campaign.status = CAMPAIGN_STATUS.SENT;
    } else if (campaign.statistics.sent > 0 && campaign.statistics.failed > 0) {
      campaign.status = CAMPAIGN_STATUS.PARTIALLY_FAILED;
    } else if (campaign.statistics.sent === 0 && campaign.statistics.failed > 0) {
      campaign.status = CAMPAIGN_STATUS.FAILED;
    } else if (skippedCount > 0 && sentCount === 0) {
      campaign.status = CAMPAIGN_STATUS.FAILED;
    }
  }

  await campaign.save();

  console.log(
    `[Worker] Campaign ${campaignId} dispatch finished. Sent: ${sentCount}, Failed: ${failedCount}, Skipped: ${skippedCount}, Final Status: ${campaign.status}`
  );

  return {
    campaignId,
    status: campaign.status,
    sentCount,
    failedCount,
    skippedCount,
  };
};

/**
 * Campaign Scheduling Worker Processor
 * Wakes up when a delayed scheduled job fires and enqueues it into the dispatch queue.
 */
export const processCampaignScheduling = async (job) => {
  const { campaignId, workspaceId } = job.data;
  console.log(`[Worker] Scheduled job triggered for Campaign ID: ${campaignId}`);

  const campaign = await Campaign.findOne({ _id: campaignId, workspaceId });
  if (!campaign) {
    console.warn(`[Worker] Scheduled campaign ${campaignId} no longer exists.`);
    return;
  }

  if (campaign.status !== CAMPAIGN_STATUS.SCHEDULED) {
    console.log(`[Worker] Campaign ${campaignId} status is '${campaign.status}'. Skipping scheduled trigger.`);
    return;
  }

  // Transition to QUEUED and trigger dispatch job
  const { campaignService } = await import('../services/campaignService.js');
  await campaignService.triggerCampaignSend({
    workspaceId,
    campaignId,
    idempotencyKey: `sched-trigger-${Date.now()}`,
  });
};

/**
 * Initializes and starts standalone background workers
 */
export const startBackgroundWorkers = () => {
  const connection = createRedisConnection();

  // Campaign Dispatch Worker
  dispatchWorker = new Worker(
    QUEUE_NAMES.CAMPAIGN_DISPATCH,
    processCampaignDispatch,
    {
      connection,
      concurrency: 2, // Process up to 2 campaigns simultaneously
      limiter: {
        max: 50,
        duration: 1000, // Provider rate limiter (max 50 emails/sec)
      },
    }
  );

  dispatchWorker.on('completed', (job) => {
    console.log(`[Worker] Dispatch job ${job.id} completed successfully.`);
  });

  dispatchWorker.on('failed', async (job, err) => {
    logger.error('Campaign dispatch job failed.', {
      jobId: job?.id,
      errorName: err.name,
    });
    // If all attempts exhausted, update campaign status in DB so it doesn't stay stuck in PROCESSING
    if (job && job.attemptsMade >= (job.opts?.attempts || 3)) {
      try {
        const { campaignId, workspaceId } = job.data || {};
        if (campaignId) {
          await Campaign.findOneAndUpdate(
            { _id: campaignId, ...(workspaceId ? { workspaceId } : {}) },
            {
              status: CAMPAIGN_STATUS.FAILED,
              completedAt: new Date(),
            }
          );
          console.warn(`[Worker] Campaign ${campaignId} exhausted all retries. Marked as FAILED.`);
        }
      } catch (dbErr) {
        logger.error('Campaign status update failed after job exhaustion.', {
          errorName: dbErr.name,
        });
      }
    }
  });

  // Campaign Scheduling Worker
  schedulingWorker = new Worker(
    QUEUE_NAMES.CAMPAIGN_SCHEDULING,
    processCampaignScheduling,
    {
      connection,
      concurrency: 5,
    }
  );

  schedulingWorker.on('completed', (job) => {
    console.log(`[Worker] Scheduling job ${job.id} executed.`);
  });

  console.log('👷 Background workers initialized and listening for jobs.');
  return { dispatchWorker, schedulingWorker };
};

/**
 * Graceful worker shutdown
 */
export const stopBackgroundWorkers = async () => {
  console.log('Shutting down background workers gracefully...');
  if (dispatchWorker) await dispatchWorker.close();
  if (schedulingWorker) await schedulingWorker.close();
  console.log('Background workers stopped.');
};
