import mongoose from 'mongoose';
import { verifyAccessToken } from '../utils/tokenUtils.js';
import { User } from '../models/User.js';
import { sendError } from '../utils/apiResponse.js';
import { env } from '../config/env.js';

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return sendError(res, 401, 'Authentication token missing or invalid');
    }

    const decoded = verifyAccessToken(token);
    if (!decoded || !decoded.userId) {
      return sendError(res, 401, 'Access token is invalid or has expired');
    }

    // Attach user to request
    let user = null;
    if (mongoose.connection.readyState === 1) {
      try {
        user = await User.findById(decoded.userId);
      } catch (e) {
        user = null;
      }

      if (!user) {
        return sendError(res, 401, 'User account does not exist or has been removed');
      }
    } else {
      // In-memory fallback allowed ONLY in development/test mode when DB is disconnected
      if (env.NODE_ENV === 'production') {
        return sendError(res, 503, 'Database service is currently unavailable');
      }

      user = {
        _id: decoded.userId,
        name: decoded.name || 'MailFlow User',
        email: decoded.email,
        role: decoded.role || 'user',
        status: 'active',
        isVerified: true,
      };
    }

    if (user.status === 'suspended' || user.status === 'deactivated') {
      return sendError(res, 403, 'Account is suspended or deactivated. Contact support.');
    }

    req.user = user;
    next();
  } catch (err) {
    return sendError(res, 401, 'Authentication failed', err.message);
  }
};

// Middleware to restrict access to specific roles (e.g. admin)
export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return sendError(res, 403, 'You do not have permission to perform this action');
    }
    next();
  };
};
