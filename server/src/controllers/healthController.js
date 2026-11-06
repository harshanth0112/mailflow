import { getDbStatus } from '../config/database.js';
import { isQueueWorkerReady, isRedisConnected } from '../config/redis.js';
import { env } from '../config/env.js';

export const getHealth = async (req, res, next) => {
  try {
    const db = getDbStatus();
    const redisHealthy = isRedisConnected();
    const workerHealthy =
      !env.QUEUE_FEATURES_ENABLED || (redisHealthy && (await isQueueWorkerReady()));
    const isHealthy = db.isConnected && workerHealthy;

    const healthData = {
      status: isHealthy ? 'healthy' : 'degraded',
      service: 'mailflow-api',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      database: {
        status: db.status,
        connected: db.isConnected,
      },
      redis: {
        status: env.QUEUE_FEATURES_ENABLED
          ? redisHealthy
            ? 'connected'
            : 'disconnected'
          : 'disabled',
        connected: redisHealthy,
      },
      worker: {
        status: env.QUEUE_FEATURES_ENABLED
          ? workerHealthy
            ? 'connected'
            : 'unavailable'
          : 'disabled',
        required: env.QUEUE_FEATURES_ENABLED,
      },
    };

    const statusCode = isHealthy ? 200 : 503;
    return res.status(statusCode).json({
      success: isHealthy,
      statusCode,
      message: isHealthy ? 'API is ready' : 'API dependencies are not ready',
      data: healthData,
    });
  } catch (error) {
    return next(error);
  }
};
