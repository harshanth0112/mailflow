import rateLimit from 'express-rate-limit';
import { sendError } from '../utils/apiResponse.js';

// General API rate limiter for standard authenticated requests: 300 requests per 15 minutes
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return sendError(
      res,
      429,
      'Too many requests to the API. Please wait a few moments before trying again.'
    );
  },
});

// General auth endpoint rate limiter: 60 requests per 15 minutes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return sendError(
      res,
      429,
      'Too many authentication requests from this IP. Please try again after 15 minutes.'
    );
  },
});

// Strict login limiter to prevent brute force: 10 attempts per 15 minutes per IP
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return sendError(
      res,
      429,
      'Too many login attempts. For security reasons, please wait 15 minutes before trying again.'
    );
  },
});

// Sensitive password reset limiter: 5 attempts per 1 hour
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return sendError(
      res,
      429,
      'Too many password reset requests. Please check your inbox or wait 1 hour.'
    );
  },
});

