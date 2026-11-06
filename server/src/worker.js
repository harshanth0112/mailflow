import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDatabase } from './config/database.js';
import { startBackgroundWorkers, stopBackgroundWorkers } from './workers/campaignWorker.js';
import { startAutoReplyWorkers, stopAutoReplyWorkers } from './workers/autoReplyWorker.js';

dotenv.config();

console.log('🚀 Starting MailFlow Standalone Worker Process...');

const start = async () => {
  try {
    await connectDatabase();
    console.log('📦 Database connected to worker process.');

    startBackgroundWorkers();
    startAutoReplyWorkers();

    const gracefulShutdown = async (signal) => {
      console.log(`\nReceived ${signal}. Gracefully stopping worker...`);
      await stopBackgroundWorkers();
      await stopAutoReplyWorkers();
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
      }
      process.exit(0);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  } catch (err) {
    console.error('Fatal error starting worker process:', err);
    process.exit(1);
  }
};

start();

