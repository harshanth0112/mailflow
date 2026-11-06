import app from './app.js';
import { env } from './config/env.js';
import { connectDatabase, closeDatabase } from './config/database.js';

let server;

const startServer = async () => {
  // Connect to DB asynchronously without blocking server listen
  connectDatabase();

  server = app.listen(env.PORT, () => {
    console.log(`🚀 MailFlow Server listening on port ${env.PORT} [${env.NODE_ENV}]`);
    console.log(`🔗 Health Check URL: http://localhost:${env.PORT}/api/v1/health`);
  });

  const handleTermination = async (signal) => {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
    if (server) {
      server.close(async () => {
        console.log('🔌 HTTP server closed.');
        await closeDatabase();
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
  console.error('Fatal error starting server:', err);
  process.exit(1);
});

