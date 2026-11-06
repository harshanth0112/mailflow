import mongoose from 'mongoose';
import { env } from './env.js';

let isConnected = false;

export const connectDatabase = async () => {
  if (!env.MONGODB_URI || env.MONGODB_URI.trim() === '') {
    console.warn('⚠️  MONGODB_URI is not set. Running in degraded mode without MongoDB.');
    return;
  }

  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log(`📦 MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    isConnected = false;
    console.error(`❌ MongoDB connection error: ${error.message}`);
    console.warn('⚠️  Server will continue running in degraded state.');
  }
};

mongoose.connection.on('connected', () => {
  isConnected = true;
  console.log('📦 Mongoose event: connected');
});

mongoose.connection.on('error', (err) => {
  isConnected = false;
  console.error(`❌ Mongoose connection event error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('⚠️  Mongoose event: disconnected');
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
    console.log('📦 MongoDB connection closed gracefully');
  }
};
