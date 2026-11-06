import { getDbStatus } from '../config/database.js';
import { isRedisConnected } from '../config/redis.js';
import { env } from '../config/env.js';

export const getHealth = (req, res) => {
  const db = getDbStatus();
  const redisHealthy = isRedisConnected();
  const isHealthy = db.isConnected;

  const healthData = {
    status: isHealthy ? 'healthy' : 'degraded',
    service: 'mailflow-api',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    database: {
      status: db.status,
      connected: db.isConnected,
    },
    redis: {
      status: redisHealthy ? 'connected' : 'disconnected',
      connected: redisHealthy,
    },
  };

  // 200 OK so container orchestrators (K8s, ECS, Fly, Render) recognize HTTP readiness
  return res.status(200).json({
    success: true,
    statusCode: 200,
    message: isHealthy
      ? 'All systems operational'
      : 'API is running in degraded mode',
    data: healthData,
  });
};

