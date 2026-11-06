import { Worker } from 'bullmq';
import mongoose from 'mongoose';
import { getRedisClient, createRedisConnection } from '../config/redis.js';
import { QUEUE_NAMES } from './queueManager.js';
import { Campaign, CAMPAIGN_STATUS } from '../models/Campaign.js';
import { CampaignRecipient, RECIPIENT_STATUS } from '../models/CampaignRecipient.js';
import { Contact, CONSENT_STATUS, CONTACT_STATUS } from '../models/Contact.js';
import { EmailAccount } from '../models/EmailAccount.js';
import { emailProviderRegistry } from '../services/email/EmailProviderRegistry.js';
import { decryptToken } from '../utils/cryptoUtils.js';
import { personalizeContent } from '../utils/templatePersonalizer.js';

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

  const provider = emailProviderRegistry.get(senderAccount.provider);
  const accessToken = decryptToken(senderAccount.encryptedAccessToken);
  const refreshToken = decryptToken(senderAccount.encryptedRefreshToken);

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

  // Process recipients with controlled concurrency (e.g. 5 at a time) to respect provider rate limits
  const CONCURRENCY = 5;
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

          const personalizedHtml = personalizeContent({
            content: campaign.htmlContent || `<p>${campaign.textContent || ''}</p>`,
            contact,
            isHtml: true,
          });

          const personalizedText = personalizeContent({
            content: campaign.textContent || '',
            contact,
            isHtml: false,
          });

          // 3. Dispatch through Phase 7 provider
          const result = await provider.sendEmail({
            from: senderAccount.emailAddress,
            to: recipient.email,
            subject: personalizedSubject,
            html: personalizedHtml,
            text: personalizedText,
            accessToken,
            refreshToken,
          });

          recipient.recipientStatus = RECIPIENT_STATUS.SENT;
          recipient.sentAt = new Date();
          recipient.providerMessageId = result.messageId || 'MOCK_SENT';
          await recipient.save();
          sentCount++;
        } catch (err) {
          console.error(`[Worker] Error sending to recipient ${recipient.email}:`, err.message);
          recipient.recipientStatus = RECIPIENT_STATUS.FAILED;
          recipient.errorCode = err.code || 'SEND_ERROR';
          recipient.errorMessage = err.message || 'Unknown provider error';
          await recipient.save();
          failedCount++;
        }
      })
    );
  }

  // Update Campaign Statistics and Final Status
  campaign.statistics.sent += sentCount;
  campaign.statistics.failed += failedCount;
  campaign.completedAt = new Date();

  if (campaign.status !== CAMPAIGN_STATUS.CANCELLED) {
    if (failedCount === 0 && sentCount > 0) {
      campaign.status = CAMPAIGN_STATUS.SENT;
    } else if (sentCount > 0 && failedCount > 0) {
      campaign.status = CAMPAIGN_STATUS.PARTIALLY_FAILED;
    } else if (sentCount === 0 && failedCount > 0) {
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

  dispatchWorker.on('failed', (job, err) => {
    console.error(`[Worker] Dispatch job ${job.id} failed with error: ${err.message}`);
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

