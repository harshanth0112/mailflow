import app from './app.js';
import { env } from './config/env.js';
import { connectDatabase, closeDatabase } from './config/database.js';
import { closeRedisConnection, connectRedis } from './config/redis.js';
import { closeQueues } from './queues/queueManager.js';
import { logger } from './utils/logger.js';

let server;
let isShuttingDown = false;

const closeDependencies = async () => {
  const errors = [];
  for (const closeDependency of [closeQueues, closeDatabase, closeRedisConnection]) {
    try {
      await closeDependency();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    logger.error('One or more dependencies failed to close.', {
      errorNames: errors.map((error) => error.name),
    });
    process.exitCode = 1;
  }
};

const startServer = async () => {
  await connectDatabase();
  if (env.QUEUE_FEATURES_ENABLED) {
    await connectRedis();
  }

  server = app.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`MailFlow Server listening on port ${env.PORT} [${env.NODE_ENV}]`);
    logger.info('Health check path: /api/v1/health');
  });

  const handleTermination = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    if (server) {
      server.close(async () => {
        logger.info('HTTP server closed.');
        await closeDependencies();
      });
    } else {
      await closeDependencies();
    }
  };

  process.once('SIGTERM', () => handleTermination('SIGTERM'));
  process.once('SIGINT', () => handleTermination('SIGINT'));
};

startServer().catch((err) => {
  logger.error('Fatal error starting server.', { errorName: err.name });
  closeDependencies().finally(() => {
    process.exitCode = 1;
  });
});
