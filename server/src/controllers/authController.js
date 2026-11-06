import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Session } from '../models/Session.js';
import {
  hashPassword,
  verifyPassword,
  hashToken,
  generateRandomToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  getRefreshTokenCookieOptions,
  getClearRefreshTokenCookieOptions,
} from '../utils/tokenUtils.js';
import { authEmailService } from '../services/authEmailService.js';
import { createDefaultWorkspaceForUser } from '../services/workspaceService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';

// In-memory fallback stores for local development without active MongoDB
const devUsers = new Map();
const devSessions = new Map();

const isDbConnected = () => mongoose.connection.readyState === 1;

export const register = async (req, res, next) => {
  try {
    if (!authEmailService.isConfigured()) {
      return sendError(res, 503, 'Transactional email is not configured for this service.');
    }

    const { name, email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check if user already exists
    if (isDbConnected()) {
      const existing = await User.findOne({ email: normalizedEmail });
      if (existing) {
        return sendError(res, 409, 'An account with this email address already exists');
      }
    } else {
      if (devUsers.has(normalizedEmail)) {
        return sendError(res, 409, 'An account with this email address already exists');
      }
    }

    // 2. Hash password
    const passwordHash = await hashPassword(password);

    // 3. Generate verification token (cryptographically random hex)
    const rawVerificationToken = generateRandomToken(32);
    const verificationTokenHash = hashToken(rawVerificationToken);
    const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    let newUser;
    if (isDbConnected()) {
      newUser = await User.create({
        name,
        email: normalizedEmail,
        passwordHash,
        role: 'user',
        status: 'pending_verification',
        isVerified: false,
        verificationTokenHash,
        verificationTokenExpiresAt,
        onboardingCompleted: false,
        onboardingStep: 0,
        onboardingSkipped: false,
      });

      // Provision default workspace for the registered user
      try {
        await createDefaultWorkspaceForUser(newUser);
      } catch (wsErr) {
        // Log workspace creation error, non-blocking to allow retry during verification
        logger.error('Initial workspace provisioning failed.', { errorName: wsErr.name });
      }
    } else {
      const id = new mongoose.Types.ObjectId().toString();
      newUser = {
        _id: id,
        id,
        name,
        email: normalizedEmail,
        passwordHash,
        role: 'user',
        status: 'pending_verification',
        isVerified: false,
        verificationTokenHash,
        verificationTokenExpiresAt,
        onboardingCompleted: false,
        onboardingStep: 0,
        onboardingSkipped: false,
        toSafeObject: function () {
          const c = { ...this };
          delete c.passwordHash;
          delete c.verificationTokenHash;
          delete c.verificationTokenExpiresAt;
          return c;
        },
      };
      devUsers.set(normalizedEmail, newUser);
      await createDefaultWorkspaceForUser(newUser);
    }

    // 4. Send verification email via Nodemailer service
    await authEmailService.sendVerificationEmail(newUser, rawVerificationToken);

    return sendSuccess(
      res,
      201,
      'Registration successful. Please check your email to verify your account.',
      {
        user: newUser.toSafeObject ? newUser.toSafeObject() : newUser,
        // In dev mode with mock transporter, surface token helper to facilitate automated testing
        ...(env.NODE_ENV === 'development' ? { _devVerificationToken: rawVerificationToken } : {}),
      }
    );
  } catch (error) {
    next(error);
  }
};

export const verifyEmail = async (req, res, next) => {
  try {
    const { token, email } = req.body;
    const tokenHash = hashToken(token);

    let user = null;
    if (isDbConnected()) {
      user = await User.findOne({
        verificationTokenHash: tokenHash,
        verificationTokenExpiresAt: { $gt: new Date() },
      }).select('+verificationTokenHash +verificationTokenExpiresAt');
    } else {
      for (const devUser of devUsers.values()) {
        if (
          devUser.verificationTokenHash === tokenHash &&
          devUser.verificationTokenExpiresAt > new Date()
        ) {
          user = devUser;
          break;
        }
      }
    }

    if (!user) {
      return sendError(
        res,
        400,
        'Verification link is invalid or has expired. Please request a new verification email.'
      );
    }

    // Mark as verified & invalidate token (single-use)
    user.isVerified = true;
    user.status = 'active';
    user.verificationTokenHash = undefined;
    user.verificationTokenExpiresAt = undefined;

    if (isDbConnected()) {
      await user.save();
    }

    // Ensure default workspace is provisioned upon verification
    try {
      await createDefaultWorkspaceForUser(user);
    } catch (wsErr) {
      logger.error('Workspace verification provisioning failed.', {
        errorName: wsErr.name,
      });
    }

    // Queue welcome email
    await authEmailService.sendWelcomeEmail(user);

    return sendSuccess(
      res,
      200,
      'Email successfully verified! You may now sign in to your MailFlow workspace.',
      {
        isVerified: true,
        email: user.email,
      }
    );
  } catch (error) {
    next(error);
  }
};

export const resendVerification = async (req, res, next) => {
  try {
    if (!authEmailService.isConfigured()) {
      return sendError(res, 503, 'Transactional email is not configured for this service.');
    }

    const { email } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    let user = null;
    if (isDbConnected()) {
      user = await User.findOne({ email: normalizedEmail });
    } else {
      user = devUsers.get(normalizedEmail);
    }

    // Generic response to avoid leaking account existence
    if (!user) {
      return sendSuccess(
        res,
        200,
        'If an unverified account exists with that email, a verification link has been sent.'
      );
    }

    if (user.isVerified) {
      return sendError(res, 400, 'This account is already verified. You can sign in directly.');
    }

    // Generate new token
    const rawToken = generateRandomToken(32);
    user.verificationTokenHash = hashToken(rawToken);
    user.verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    if (isDbConnected()) {
      await user.save();
    }

    await authEmailService.sendVerificationEmail(user, rawToken);

    return sendSuccess(
      res,
      200,
      'If an unverified account exists with that email, a verification link has been sent.',
      process.env.NODE_ENV === 'development' ? { _devVerificationToken: rawToken } : null
    );
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    let user = null;
    if (isDbConnected()) {
      user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
    } else {
      user = devUsers.get(normalizedEmail);
    }

    if (!user) {
      return sendError(res, 401, 'Invalid email or password');
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return sendError(res, 401, 'Invalid email or password');
    }

    if (!user.isVerified) {
      return sendError(
        res,
        403,
        'Please verify your email address before signing in. Check your inbox or request a new link.'
      );
    }

    if (user.status === 'suspended' || user.status === 'deactivated') {
      return sendError(res, 403, 'Your account has been suspended or deactivated. Contact support.');
    }

    // Issue short-lived access token (15m)
    const tokenPayload = {
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    };
    const accessToken = signAccessToken(tokenPayload);

    // Issue refresh token (7d)
    const rawRefreshToken = generateRandomToken(40);
    const refreshTokenHash = hashToken(rawRefreshToken);
    const refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const clientIp = req.ip || req.connection.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    // Record session
    if (isDbConnected()) {
      await Session.create({
        userId: user._id,
        refreshTokenHash,
        userAgent,
        ipAddress: clientIp,
        expiresAt: refreshTokenExpiresAt,
      });

      // Update user login metadata
      user.lastLoginAt = new Date();
      user.lastLoginIp = clientIp;
      await user.save();
    } else {
      devSessions.set(refreshTokenHash, {
        userId: user._id.toString(),
        expiresAt: refreshTokenExpiresAt,
        revokedAt: null,
      });
      user.lastLoginAt = new Date();
      user.lastLoginIp = clientIp;
    }

    // Send login security alert notification asynchronously
    authEmailService
      .sendLoginSecurityNotification(user, clientIp, userAgent)
      .catch((error) =>
        logger.warn('Login security notification was not delivered.', {
          errorName: error.name,
        })
      );

    // Set secure HttpOnly cookie for refresh token
    res.cookie('refreshToken', rawRefreshToken, getRefreshTokenCookieOptions());

    return sendSuccess(res, 200, 'Login successful', {
      user: user.toSafeObject ? user.toSafeObject() : user,
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req, res, next) => {
  try {
    const rawRefreshToken = req.cookies.refreshToken;

    if (!rawRefreshToken) {
      return sendError(res, 401, 'Refresh token required');
    }

    const tokenHash = hashToken(rawRefreshToken);
    let session = null;
    let userId = null;

    if (isDbConnected()) {
      session = await Session.findOne({
        refreshTokenHash: tokenHash,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      });
      if (session) {
        userId = session.userId;
      }
    } else {
      const devSession = devSessions.get(tokenHash);
      if (devSession && !devSession.revokedAt && devSession.expiresAt > new Date()) {
        session = devSession;
        userId = devSession.userId;
      }
    }

    if (!session || !userId) {
      return sendError(res, 401, 'Session expired or revoked. Please log in again.');
    }

    // Find user
    let user = null;
    if (isDbConnected()) {
      user = await User.findById(userId);
    } else {
      for (const u of devUsers.values()) {
        if (u._id.toString() === userId.toString()) {
          user = u;
          break;
        }
      }
    }

    if (!user || user.status === 'suspended') {
      return sendError(res, 401, 'User account invalid or suspended');
    }

    // Rotate refresh token for security
    const newRawRefreshToken = generateRandomToken(40);
    const newRefreshTokenHash = hashToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    if (isDbConnected()) {
      session.revokedAt = new Date();
      await session.save();

      await Session.create({
        userId: user._id,
        refreshTokenHash: newRefreshTokenHash,
        userAgent: req.headers['user-agent'] || '',
        ipAddress: req.ip || '',
        expiresAt: newExpiresAt,
      });
    } else {
      session.revokedAt = new Date();
      devSessions.set(newRefreshTokenHash, {
        userId: user._id.toString(),
        expiresAt: newExpiresAt,
        revokedAt: null,
      });
    }

    const accessToken = signAccessToken({
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    });

    res.cookie('refreshToken', newRawRefreshToken, getRefreshTokenCookieOptions());

    return sendSuccess(res, 200, 'Token refreshed successfully', {
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    const rawRefreshToken = req.cookies.refreshToken;

    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      if (isDbConnected()) {
        await Session.updateOne(
          { refreshTokenHash: tokenHash },
          { $set: { revokedAt: new Date() } }
        );
      } else {
        const session = devSessions.get(tokenHash);
        if (session) session.revokedAt = new Date();
      }
    }

    // Clear cookie
    res.clearCookie('refreshToken', getClearRefreshTokenCookieOptions());

    return sendSuccess(res, 200, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    if (!authEmailService.isConfigured()) {
      return sendError(res, 503, 'Transactional email is not configured for this service.');
    }

    const { email } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    let user = null;
    if (isDbConnected()) {
      user = await User.findOne({ email: normalizedEmail });
    } else {
      user = devUsers.get(normalizedEmail);
    }

    // Generic response to avoid leaking account existence
    if (!user) {
      return sendSuccess(
        res,
        200,
        'If an account exists for that email, a password reset link has been dispatched.'
      );
    }

    // Generate single-use expiring token (1 hour)
    const rawResetToken = generateRandomToken(32);
    user.resetPasswordTokenHash = hashToken(rawResetToken);
    user.resetPasswordExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

    if (isDbConnected()) {
      await user.save();
    }

    await authEmailService.sendPasswordResetEmail(user, rawResetToken);

    return sendSuccess(
      res,
      200,
      'If an account exists for that email, a password reset link has been dispatched.',
      process.env.NODE_ENV === 'development' ? { _devResetToken: rawResetToken } : null
    );
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    const tokenHash = hashToken(token);

    let user = null;
    if (isDbConnected()) {
      user = await User.findOne({
        resetPasswordTokenHash: tokenHash,
        resetPasswordExpiresAt: { $gt: new Date() },
      }).select('+resetPasswordTokenHash +resetPasswordExpiresAt');
    } else {
      for (const devUser of devUsers.values()) {
        if (
          devUser.resetPasswordTokenHash === tokenHash &&
          devUser.resetPasswordExpiresAt > new Date()
        ) {
          user = devUser;
          break;
        }
      }
    }

    if (!user) {
      return sendError(
        res,
        400,
        'Password reset link is invalid or has expired. Please request a new one.'
      );
    }

    // Hash new password
    user.passwordHash = await hashPassword(password);
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpiresAt = undefined;

    if (isDbConnected()) {
      await user.save();
      // Revoke all existing sessions for this user for security
      await Session.updateMany(
        { userId: user._id, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
    }

    // Send confirmation email
    await authEmailService.sendPasswordChangedConfirmation(user, req.ip);

    return sendSuccess(
      res,
      200,
      'Password successfully reset. You may now log in with your new password.'
    );
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;

    let user = null;
    if (isDbConnected()) {
      user = await User.findById(userId).select('+passwordHash');
    } else {
      user = req.user;
    }

    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    const isMatch = await verifyPassword(currentPassword, user.passwordHash);
    if (!isMatch) {
      return sendError(res, 400, 'Current password does not match our records');
    }

    user.passwordHash = await hashPassword(newPassword);
    if (isDbConnected()) {
      await user.save();
    }

    await authEmailService.sendPasswordChangedConfirmation(user, req.ip);

    return sendSuccess(res, 200, 'Password updated successfully');
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (req, res, next) => {
  try {
    const user = req.user;
    return sendSuccess(
      res,
      200,
      'Profile retrieved successfully',
      user.toSafeObject ? user.toSafeObject() : user
    );
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { name, onboardingStep, onboardingCompleted, onboardingSkipped } = req.body;

    let user = null;
    if (isDbConnected()) {
      user = await User.findById(userId);
    } else {
      user = req.user;
    }

    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    if (name !== undefined) user.name = name;
    if (onboardingStep !== undefined) user.onboardingStep = onboardingStep;
    if (onboardingCompleted !== undefined) user.onboardingCompleted = onboardingCompleted;
    if (onboardingSkipped !== undefined) user.onboardingSkipped = onboardingSkipped;

    if (isDbConnected()) {
      await user.save();
    }

    return sendSuccess(
      res,
      200,
      'Profile updated successfully',
      user.toSafeObject ? user.toSafeObject() : user
    );
  } catch (error) {
    next(error);
  }
};

export const getOAuthStatus = (req, res) => {
  return sendSuccess(res, 200, 'OAuth configuration status', {
    providers: {
      google: { enabled: !!process.env.GOOGLE_CLIENT_ID },
      github: { enabled: !!process.env.GITHUB_CLIENT_ID },
      microsoft: { enabled: !!process.env.MICROSOFT_CLIENT_ID },
    },
    message: 'OAuth endpoints are structured and ready for provider client credentials',
  });
};
