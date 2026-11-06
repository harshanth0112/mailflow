import IORedis from 'ioredis';
import { env } from './env.js';

let redisInstance = null;
let isConnected = false;
const WORKER_HEARTBEAT_KEY = 'mailflow:worker:heartbeat';
const WORKER_HEARTBEAT_TTL_SECONDS = 45;

export const createRedisConnection = () => {
  const options = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    connectTimeout: 10000,
    retryStrategy: (times) => {
      if (process.env.NODE_ENV === 'test') {
        return times <= 3 ? Math.min(times * 100, 300) : null;
      }
      if (times > 5) {
        return 10000;
      }
      return Math.min(times * 200, 2000);
    },
  };
  const connection = env.REDIS_URL
    ? new IORedis(env.REDIS_URL, options)
    : new IORedis({
        ...options,
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
        db: env.REDIS_DB,
      });
  const client = connection;

  client.on('connect', () => {
    isConnected = true;
  });

  client.on('ready', () => {
    isConnected = true;
  });

  client.on('error', (err) => {
    isConnected = false;
    console.warn(`Redis connection error (${err.name}).`);
  });

  client.on('close', () => {
    isConnected = false;
  });

  return client;
};

export const connectRedis = async () => {
  const client = getRedisClient();
  let timeout;
  try {
    await Promise.race([
      client.ping(),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Redis startup check timed out.')), 10000);
      }),
    ]);
  } catch (error) {
    client.disconnect();
    isConnected = false;
    throw new Error(`Redis connection failed: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }
  return client;
};

export const getRedisClient = () => {
  if (!redisInstance) {
    redisInstance = createRedisConnection();
  }
  return redisInstance;
};

export const isRedisConnected = () => isConnected;

export const setWorkerHeartbeat = async () => {
  await getRedisClient().set(
    WORKER_HEARTBEAT_KEY,
    new Date().toISOString(),
    'EX',
    WORKER_HEARTBEAT_TTL_SECONDS
  );
};

export const isQueueWorkerReady = async () => {
  if (!isConnected) return false;
  const heartbeat = await getRedisClient().get(WORKER_HEARTBEAT_KEY);
  return Boolean(heartbeat && Date.now() - Date.parse(heartbeat) < WORKER_HEARTBEAT_TTL_SECONDS * 1000);
};

export const clearWorkerHeartbeat = async () => {
  await getRedisClient().del(WORKER_HEARTBEAT_KEY);
};

export const closeRedisConnection = async () => {
  if (redisInstance) {
    try {
      await redisInstance.quit();
    } catch (error) {
      console.warn(`Redis graceful close failed (${error.name}); forcing disconnect.`);
      redisInstance.disconnect();
    }
    redisInstance = null;
    isConnected = false;
  }
};
