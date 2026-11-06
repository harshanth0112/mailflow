import { Queue } from 'bullmq';
import { getRedisClient, isRedisConnected } from '../config/redis.js';

export const QUEUE_NAMES = {
  CAMPAIGN_DISPATCH: 'mailflow_campaign_dispatch',
  CAMPAIGN_SCHEDULING: 'mailflow_campaign_scheduling',
  AUTOMATION_EXECUTION: 'mailflow_automation_execution',
  INBOX_POLLING: 'mailflow_inbox_polling',
  AUTO_REPLY_DISPATCH: 'mailflow_auto_reply_dispatch',
};

// Queue instances
let campaignDispatchQueue = null;
let campaignSchedulingQueue = null;
let automationQueue = null;
let inboxPollingQueue = null;
let autoReplyDispatchQueue = null;

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000, // 2s, 4s, 8s
  },
  removeOnComplete: {
    count: 1000,
    age: 24 * 3600, // keep 24 hours
  },
  removeOnFail: {
    count: 5000,
    age: 7 * 24 * 3600, // keep 7 days for diagnostics
  },
};

/**
 * Initializes and returns BullMQ Queues
 */
export const getQueue = (name) => {
  const redis = getRedisClient();

  if (name === QUEUE_NAMES.CAMPAIGN_DISPATCH) {
    if (!campaignDispatchQueue) {
      campaignDispatchQueue = new Queue(name, {
        connection: redis,
        defaultJobOptions,
      });
    }
    return campaignDispatchQueue;
  }

  if (name === QUEUE_NAMES.CAMPAIGN_SCHEDULING) {
    if (!campaignSchedulingQueue) {
      campaignSchedulingQueue = new Queue(name, {
        connection: redis,
        defaultJobOptions,
      });
    }
    return campaignSchedulingQueue;
  }

  if (name === QUEUE_NAMES.AUTOMATION_EXECUTION) {
    if (!automationQueue) {
      automationQueue = new Queue(name, {
        connection: redis,
        defaultJobOptions,
      });
    }
    return automationQueue;
  }

  if (name === QUEUE_NAMES.INBOX_POLLING) {
    if (!inboxPollingQueue) {
      inboxPollingQueue = new Queue(name, {
        connection: redis,
        defaultJobOptions,
      });
    }
    return inboxPollingQueue;
  }

  if (name === QUEUE_NAMES.AUTO_REPLY_DISPATCH) {
    if (!autoReplyDispatchQueue) {
      autoReplyDispatchQueue = new Queue(name, {
        connection: redis,
        defaultJobOptions,
      });
    }
    return autoReplyDispatchQueue;
  }

  return new Queue(name, { connection: redis, defaultJobOptions });
};

/**
 * Get queue metrics for monitoring
 */
export const getQueueMetrics = async () => {
  try {
    const dispatchQ = getQueue(QUEUE_NAMES.CAMPAIGN_DISPATCH);
    const schedulingQ = getQueue(QUEUE_NAMES.CAMPAIGN_SCHEDULING);

    const [dispatchCounts, schedulingCounts] = await Promise.all([
      dispatchQ.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
      schedulingQ.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
    ]);

    return {
      redisConnected: isRedisConnected(),
      campaignDispatch: dispatchCounts,
      campaignScheduling: schedulingCounts,
    };
  } catch (err) {
    return {
      redisConnected: false,
      error: 'Queue metrics unavailable',
    };
  }
};

export const closeQueues = async () => {
  const queues = [
    campaignDispatchQueue,
    campaignSchedulingQueue,
    automationQueue,
    inboxPollingQueue,
    autoReplyDispatchQueue,
  ].filter(Boolean);

  const results = await Promise.allSettled(queues.map((queue) => queue.close()));
  campaignDispatchQueue = null;
  campaignSchedulingQueue = null;
  automationQueue = null;
  inboxPollingQueue = null;
  autoReplyDispatchQueue = null;

  const errors = results
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason);
  if (errors.length > 0) {
    throw new AggregateError(errors, 'One or more BullMQ queues failed to close.');
  }
};
