import mongoose from 'mongoose';
import { env } from './config/env.js';
import { connectDatabase, closeDatabase } from './config/database.js';
import {
  clearWorkerHeartbeat,
  closeRedisConnection,
  connectRedis,
  setWorkerHeartbeat,
} from './config/redis.js';
import { startBackgroundWorkers, stopBackgroundWorkers } from './workers/campaignWorker.js';
import { startAutoReplyWorkers, stopAutoReplyWorkers } from './workers/autoReplyWorker.js';
import { logger } from './utils/logger.js';

let heartbeatInterval;
let isShuttingDown = false;
let heartbeatStarted = false;

const closeDependencies = async () => {
  const errors = [];
  for (const closeDependency of [
    stopBackgroundWorkers,
    stopAutoReplyWorkers,
    async () => {
      if (heartbeatStarted) {
        await clearWorkerHeartbeat();
        heartbeatStarted = false;
      }
    },
    closeRedisConnection,
    closeDatabase,
  ]) {
    try {
      await closeDependency();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    logger.error('One or more worker dependencies failed to close.', {
      errorNames: errors.map((error) => error.name),
    });
    process.exitCode = 1;
  }
};

const start = async () => {
  try {
    if (env.NODE_ENV === 'production' && !env.QUEUE_FEATURES_ENABLED) {
      throw new Error('Production worker startup requires QUEUE_FEATURES_ENABLED=true.');
    }

    await connectDatabase();
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Worker startup requires an active MongoDB connection.');
    }

    await connectRedis();
    const campaignWorkers = startBackgroundWorkers();
    const autoReplyWorkers = startAutoReplyWorkers();
    await Promise.all(
      [
        campaignWorkers.dispatchWorker,
        campaignWorkers.schedulingWorker,
        autoReplyWorkers.pollingWorker,
        autoReplyWorkers.autoReplyWorker,
      ].map((worker) => worker.waitUntilReady())
    );

    await setWorkerHeartbeat();
    heartbeatStarted = true;
    heartbeatInterval = setInterval(() => {
      setWorkerHeartbeat().catch((error) => {
        logger.warn('Worker readiness heartbeat update failed.', {
          errorName: error.name,
        });
      });
    }, 15000);
    heartbeatInterval.unref();
    logger.info('MailFlow background workers are ready.');

    const gracefulShutdown = async (signal) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      clearInterval(heartbeatInterval);
      logger.info(`Received ${signal}. Gracefully stopping worker...`);
      await closeDependencies();
    };

    process.once('SIGINT', () => gracefulShutdown('SIGINT'));
    process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
  } catch (error) {
    logger.error('Fatal error starting worker process.', { errorName: error.name });
    await closeDependencies();
    process.exitCode = 1;
  }
};

start();
