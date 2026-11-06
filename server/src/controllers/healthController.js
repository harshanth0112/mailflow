import { getDbStatus } from '../config/database.js';
import { env } from '../config/env.js';

export const getHealth = (req, res) => {
  const db = getDbStatus();
  const isHealthy = db.isConnected;

  const healthData = {
    status: isHealthy ? 'healthy' : 'degraded',
    service: 'mailflow-api',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    database: {
      status: db.status,
      readyState: db.readyState,
      connected: db.isConnected,
    },
  };

  // 200 OK regardless of degraded DB status so orchestrators know API is running
  return res.status(200).json({
    success: true,
    statusCode: 200,
    message: isHealthy
      ? 'All systems operational'
      : 'API is running; database is currently disconnected',
    data: healthData,
  });
};

