import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

// Hash plaintext password with bcrypt (12 salt rounds)
export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
};

// Compare plaintext password against hash
export const verifyPassword = async (password, hash) => {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
};

// SHA256 one-way hashing for sensitive single-use tokens (verification, reset, refresh)
export const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Generate a random cryptographically secure hex token
export const generateRandomToken = (bytes = 32) => {
  return crypto.randomBytes(bytes).toString('hex');
};

// Sign JWT access token (15m)
export const signAccessToken = (payload) => {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });
};

// Sign JWT refresh token (7d)
export const signRefreshToken = (payload) => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });
};

// Verify JWT access token
export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch (err) {
    return null;
  }
};

// Verify JWT refresh token
export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET);
  } catch (err) {
    return null;
  }
};

// Cookie options for secure refresh token storage
export const getRefreshTokenCookieOptions = () => {
  const isProduction = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: '/api/v1/auth',
  };
};

