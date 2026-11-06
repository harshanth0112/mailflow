import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDatabase } from './config/database.js';
import { closeRedisConnection } from './config/redis.js';
import { startBackgroundWorkers, stopBackgroundWorkers } from './workers/campaignWorker.js';
import { startAutoReplyWorkers, stopAutoReplyWorkers } from './workers/autoReplyWorker.js';
import { logger } from './utils/logger.js';

dotenv.config();

logger.info('Starting MailFlow Standalone Background Worker Process...');

const start = async () => {
  try {
    await connectDatabase();
    logger.info('Database connected to worker process.');

    startBackgroundWorkers();
    startAutoReplyWorkers();

    const gracefulShutdown = async (signal) => {
      logger.info(`Received ${signal}. Gracefully stopping worker...`);
      try {
        await stopBackgroundWorkers();
        await stopAutoReplyWorkers();
        await closeRedisConnection();
        if (mongoose.connection.readyState === 1) {
          await mongoose.connection.close();
        }
      } catch (err) {
        logger.error(`Error during worker shutdown: ${err.message}`);
      }
      process.exit(0);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  } catch (err) {
    logger.error(`Fatal error starting worker process: ${err.message}`);
    process.exit(1);
  }
};

start();

