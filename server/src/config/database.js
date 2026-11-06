import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export const connectDatabase = async () => {
  if (!env.MONGODB_URI || env.MONGODB_URI.trim() === '') {
    if (env.NODE_ENV === 'production') {
      throw new Error('MONGODB_URI must be configured before production startup.');
    }
    logger.warn('MONGODB_URI is not set; starting in local development mode without MongoDB.');
    return false;
  }

  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 20, // Connection pooling for high concurrency
      minPoolSize: 5,
      socketTimeoutMS: 45000,
    });
    logger.info('MongoDB connection established.');
    return true;
  } catch (error) {
    logger.error('MongoDB connection failed.', { errorName: error.name });
    if (env.NODE_ENV === 'production') {
      throw new Error('MongoDB connection failed; production startup aborted.');
    }
    logger.warn('Continuing without MongoDB in local development mode.');
    return false;
  }
};

mongoose.connection.on('connected', () => {
  logger.info('MongoDB connection restored.');
});

mongoose.connection.on('error', (error) => {
  logger.error('MongoDB connection event reported an error.', { errorName: error.name });
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB connection was lost.');
});

export const getDbStatus = () => {
  const readyStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const stateCode = mongoose.connection.readyState;
  const statusName = readyStates[stateCode] || 'unknown';

  return {
    status: statusName,
    readyState: stateCode,
    isConnected: stateCode === 1,
  };
};

export const closeDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed gracefully.');
  }
};
