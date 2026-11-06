import crypto from 'crypto';
import { env } from '../config/env.js';

// Derive or create a consistent 32-byte key from ENCRYPTION_KEY or fallback to a deterministic SHA256 of JWT_ACCESS_SECRET
const getMasterKey = () => {
  const secret = process.env.ENCRYPTION_KEY || env.JWT_ACCESS_SECRET || 'mailflow-default-encryption-master-secret-32b';
  return crypto.createHash('sha256').update(String(secret)).digest();
};

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard 96-bit IV for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypts a sensitive string (e.g. OAuth access token or refresh token) using AES-256-GCM.
 * Returns a composite string: iv:authTag:encryptedCiphertext (hex encoded)
 * @param {string} text 
 * @returns {string}
 */
export const encryptToken = (text) => {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getMasterKey(), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

/**
 * Decrypts an AES-256-GCM encrypted composite string.
 * @param {string} encryptedComposite 
 * @returns {string}
 */
export const decryptToken = (encryptedComposite) => {
  if (!encryptedComposite) return '';
  const parts = encryptedComposite.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, getMasterKey(), iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

