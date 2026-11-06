import { Worker } from 'bullmq';
import mongoose from 'mongoose';
import { createRedisConnection } from '../config/redis.js';
import { QUEUE_NAMES } from '../queues/queueManager.js';
import { EmailAccount, CONNECTION_STATUS } from '../models/EmailAccount.js';
import { emailProviderRegistry } from '../services/email/EmailProviderRegistry.js';
import { autoReplyService } from '../services/autoReplyService.js';
import { decryptToken } from '../utils/cryptoUtils.js';

let pollingWorker = null;
let autoReplyWorker = null;

/**
 * Poll inbox for a single email account and enqueue incoming messages for reply processing
 */
export const processInboxPollingJob = async (job) => {
  const { workspaceId, emailAccountId } = job.data;
  console.log(`[InboxPollingWorker] Polling mailbox: ${emailAccountId}`);

  let account = null;
  if (mongoose.connection.readyState === 1) {
    account = await EmailAccount.findOne({ _id: emailAccountId, workspaceId }).select(
      '+encryptedAccessToken +encryptedRefreshToken'
    );
  } else {
    const { devEmailAccounts } = await import('../services/emailAccountService.js');
    account = devEmailAccounts.get(emailAccountId);
  }

  if (!account || account.connectionStatus !== CONNECTION_STATUS.CONNECTED) {
    console.log(`[InboxPollingWorker] Mailbox ${emailAccountId} is not connected or active. Skipping.`);
    return { status: 'skipped', reason: 'Mailbox not connected' };
  }

  const settings = account.autoReplySettings || {};
  if (!settings.enabled) {
    console.log(`[InboxPollingWorker] Auto-reply is disabled on mailbox ${account.emailAddress}. Skipping.`);
    return { status: 'skipped', reason: 'Auto-reply disabled' };
  }

  const provider = emailProviderRegistry.get(account.provider);
  const accessToken = decryptToken(account.encryptedAccessToken);

  try {
    const listResult = await provider.listMessages({ accessToken, maxResults: 10 });
    const messages = listResult.messages || [];
    console.log(`[InboxPollingWorker] Found ${messages.length} messages for ${account.emailAddress}`);

    let processedCount = 0;
    for (const msgSummary of messages) {
      let fullMessage = msgSummary;
      if (!msgSummary.body && provider.getMessage) {
        fullMessage = await provider.getMessage({ accessToken, messageId: msgSummary.id });
      }

      const res = await autoReplyService.processIncomingMessage({
        workspaceId,
        emailAccountId,
        message: fullMessage,
      });

      if (res.status === 'replied') {
        processedCount++;
      }
    }

    if (mongoose.connection.readyState === 1) {
      await EmailAccount.findByIdAndUpdate(emailAccountId, {
        'autoReplySettings.lastPolledAt': new Date(),
        lastSyncedAt: new Date(),
      });
    }

    return { polled: messages.length, replied: processedCount };
  } catch (err) {
    console.error(`[InboxPollingWorker] Failed to poll mailbox ${account.emailAddress}:`, err.message);
    throw err;
  }
};

/**
 * Auto-reply dispatch job
 */
export const processAutoReplyDispatchJob = async (job) => {
  const { workspaceId, emailAccountId, message } = job.data;
  return await autoReplyService.processIncomingMessage({
    workspaceId,
    emailAccountId,
    message,
  });
};

/**
 * Start Auto Reply Background Workers
 */
export const startAutoReplyWorkers = () => {
  const connection = createRedisConnection();

  pollingWorker = new Worker(QUEUE_NAMES.INBOX_POLLING, processInboxPollingJob, {
    connection,
    concurrency: 5,
  });

  autoReplyWorker = new Worker(QUEUE_NAMES.AUTO_REPLY_DISPATCH, processAutoReplyDispatchJob, {
    connection,
    concurrency: 10,
  });

  console.log('📬 Auto-reply inbox polling workers started.');
  return { pollingWorker, autoReplyWorker };
};

export const stopAutoReplyWorkers = async () => {
  if (pollingWorker) await pollingWorker.close();
  if (autoReplyWorker) await autoReplyWorker.close();
  console.log('📬 Auto-reply inbox workers stopped.');
};
