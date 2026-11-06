import app from './app.js';
import { env } from './config/env.js';
import { connectDatabase, closeDatabase } from './config/database.js';
import { closeRedisConnection } from './config/redis.js';
import { logger } from './utils/logger.js';

let server;

const startServer = async () => {
  // Connect to DB asynchronously without blocking server listen
  connectDatabase();

  server = app.listen(env.PORT, () => {
    logger.info(`MailFlow Server listening on port ${env.PORT} [${env.NODE_ENV}]`);
    logger.info(`Health Check URL: http://localhost:${env.PORT}/api/v1/health`);
  });

  const handleTermination = async (signal) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    if (server) {
      server.close(async () => {
        logger.info('HTTP server closed.');
        try {
          await closeDatabase();
          await closeRedisConnection();
        } catch (err) {
          logger.error(`Error during server cleanup: ${err.message}`);
        }
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => handleTermination('SIGTERM'));
  process.on('SIGINT', () => handleTermination('SIGINT'));
};

startServer().catch((err) => {
  logger.error(`Fatal error starting server: ${err.message}`);
  process.exit(1);
});

