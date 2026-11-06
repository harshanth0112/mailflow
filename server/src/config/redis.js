import IORedis from 'ioredis';
import { env } from './env.js';

let redisInstance = null;
let isConnected = false;

export const createRedisConnection = () => {
  const options = env.REDIS_URL
    ? env.REDIS_URL
    : {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
        db: env.REDIS_DB,
        maxRetriesPerRequest: null, // Required by BullMQ
        enableReadyCheck: false,
        lazyConnect: true,
        retryStrategy: (times) => {
          // In test mode: allow up to 3 quick retries so CI Redis (which is
          // always available) connects successfully, then give up fast so a
          // missing local Redis doesn't hang the test runner.
          if (process.env.NODE_ENV === 'test') {
            return times <= 3 ? Math.min(times * 100, 300) : null;
          }
          if (times > 5) {
            return 10000; // Cap backoff
          }
          return Math.min(times * 200, 2000);
        },
      };

  const client = new IORedis(options);

  client.on('connect', () => {
    isConnected = true;
    console.log('✅ Connected to Redis successfully');
  });

  client.on('ready', () => {
    isConnected = true;
  });

  client.on('error', (err) => {
    isConnected = false;
    // Log cleanly without crashing the whole process
    console.warn(`⚠️ Redis Connection Notice: ${err.message}`);
  });

  client.on('close', () => {
    isConnected = false;
  });

  return client;
};

export const getRedisClient = () => {
  if (!redisInstance) {
    redisInstance = createRedisConnection();
  }
  return redisInstance;
};

export const isRedisConnected = () => isConnected;

export const closeRedisConnection = async () => {
  if (redisInstance) {
    try {
      await redisInstance.quit();
    } catch {
      redisInstance.disconnect();
    }
    redisInstance = null;
    isConnected = false;
  }
};


