import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Workspace } from '../models/Workspace.js';
import { Membership } from '../models/Membership.js';
import { Campaign } from '../models/Campaign.js';
import { EmailAccount } from '../models/EmailAccount.js';
import { AuditLog } from '../models/AuditLog.js';
import { getQueue, QUEUE_NAMES } from '../queues/queueManager.js';
import { isQueueWorkerReady } from '../config/redis.js';
import { escapeRegex } from '../utils/regexUtils.js';
import { env } from '../config/env.js';

export const adminService = {
  /**
   * System overview metrics for platform administrators
   */
  async getSystemMetrics() {
    if (mongoose.connection.readyState === 1) {
      const [
        totalUsers,
        activeUsers,
        suspendedUsers,
        totalWorkspaces,
        totalCampaigns,
        totalEmailAccounts,
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ status: 'active' }),
        User.countDocuments({ status: 'suspended' }),
        Workspace.countDocuments(),
        Campaign.countDocuments(),
        EmailAccount.countDocuments(),
      ]);

      return {
        users: {
          total: totalUsers,
          active: activeUsers,
          suspended: suspendedUsers,
        },
        workspaces: {
          total: totalWorkspaces,
        },
        campaigns: {
          total: totalCampaigns,
        },
        emailAccounts: {
          total: totalEmailAccounts,
        },
        system: {
          nodeEnv: process.env.NODE_ENV || 'development',
          uptimeSeconds: Math.floor(process.uptime()),
          memoryUsage: process.memoryUsage(),
        },
      };
    } else {
      // Mock metrics for development/test mode
      return {
        users: { total: 10, active: 8, suspended: 2 },
        workspaces: { total: 5 },
        campaigns: { total: 12 },
        emailAccounts: { total: 4 },
        system: {
          nodeEnv: process.env.NODE_ENV || 'development',
          uptimeSeconds: Math.floor(process.uptime()),
          memoryUsage: process.memoryUsage(),
        },
      };
    }
  },

  /**
   * List platform users with search, role/status filtering, and pagination
   */
  async listUsers({ search = '', role, status, page = 1, limit = 20 }) {
    const skip = (page - 1) * limit;

    if (mongoose.connection.readyState === 1) {
      const filter = {};
      if (role) filter.role = role;
      if (status) filter.status = status;

      if (search && search.trim() !== '') {
        const safeSearch = escapeRegex(search.trim());
        const regex = new RegExp(safeSearch, 'i');
        filter.$or = [{ name: regex }, { email: regex }];
      }

      const [users, total] = await Promise.all([
        User.find(filter)
          .select('-passwordHash -verificationTokenHash -resetPasswordTokenHash')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        User.countDocuments(filter),
      ]);

      return {
        users,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    } else {
      // Dev mode fallback
      const mockUsers = [
        {
          _id: new mongoose.Types.ObjectId().toString(),
          name: 'Platform Administrator',
          email: 'admin@mailflow.io',
          role: 'admin',
          status: 'active',
          isVerified: true,
          createdAt: new Date(),
        },
        {
          _id: new mongoose.Types.ObjectId().toString(),
          name: 'Demo User',
          email: 'demo@mailflow.io',
          role: 'user',
          status: 'active',
          isVerified: true,
          createdAt: new Date(),
        },
      ];
      return {
        users: mockUsers,
        pagination: { total: mockUsers.length, page: 1, limit, totalPages: 1 },
      };
    }
  },

  /**
   * Get user detail and associated workspaces
   */
  async getUserDetails(userId) {
    if (mongoose.connection.readyState === 1) {
      const user = await User.findById(userId).select(
        '-passwordHash -verificationTokenHash -resetPasswordTokenHash'
      );
      if (!user) throw new Error('User not found');

      const memberships = await Membership.find({ userId }).populate('workspaceId').lean();
      return {
        user,
        memberships,
      };
    } else {
      return {
        user: { _id: userId, name: 'Sample User', email: 'user@example.com', role: 'user', status: 'active' },
        memberships: [],
      };
    }
  },

  /**
   * Update user status (e.g. suspend or reactivate) with administrative audit log
   */
  async updateUserStatus({ adminUserId, targetUserId, status, reason = '' }) {
    if (adminUserId.toString() === targetUserId.toString()) {
      throw new Error('Administrators cannot suspend or change status of their own account');
    }

    const validStatuses = ['active', 'suspended', 'deactivated'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid account status. Allowed: ${validStatuses.join(', ')}`);
    }

    if (mongoose.connection.readyState === 1) {
      const user = await User.findById(targetUserId);
      if (!user) throw new Error('Target user not found');

      const oldStatus = user.status;
      user.status = status;
      await user.save();

      // Record administrative audit log
      await AuditLog.create({
        userId: adminUserId,
        action: `admin_user_status_changed`,
        resourceType: 'User',
        resourceId: targetUserId,
        details: { oldStatus, newStatus: status, reason },
      });

      return user.toSafeObject();
    } else {
      return { _id: targetUserId, status };
    }
  },

  /**
   * Update user platform role with administrative audit log
   */
  async updateUserRole({ adminUserId, targetUserId, role }) {
    if (adminUserId.toString() === targetUserId.toString()) {
      throw new Error('Administrators cannot change their own platform role');
    }

    const validRoles = ['user', 'admin'];
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid platform role. Allowed: ${validRoles.join(', ')}`);
    }

    if (mongoose.connection.readyState === 1) {
      const user = await User.findById(targetUserId);
      if (!user) throw new Error('Target user not found');

      const oldRole = user.role;
      user.role = role;
      await user.save();

      // Record administrative audit log
      await AuditLog.create({
        userId: adminUserId,
        action: `admin_user_role_changed`,
        resourceType: 'User',
        resourceId: targetUserId,
        details: { oldRole, newRole: role },
      });

      return user.toSafeObject();
    } else {
      return { _id: targetUserId, role };
    }
  },

  /**
   * BullMQ queue monitoring telemetry
   */
  async getQueueStats() {
    const queueNames = Object.values(QUEUE_NAMES);
    const results = {};

    if (!env.QUEUE_FEATURES_ENABLED) {
      for (const qName of queueNames) {
        results[qName] = {
          name: qName,
          status: 'disabled',
          counts: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 },
        };
      }
      return {
        workerOnline: false,
        queues: results,
      };
    }

    const workerReady = await isQueueWorkerReady();

    for (const qName of queueNames) {
      try {
        const queue = getQueue(qName);
        const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused');
        results[qName] = {
          name: qName,
          status: 'online',
          counts,
        };
      } catch (err) {
        results[qName] = {
          name: qName,
          status: 'unavailable',
          counts: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 },
        };
      }
    }

    return {
      workerOnline: workerReady,
      queues: results,
    };
  },

  /**
   * Retry failed jobs in a specified queue
   */
  async retryFailedJobs(queueName) {
    const queue = getQueue(queueName);
    const failedJobs = await queue.getFailed(0, 100);
    let retriedCount = 0;

    for (const job of failedJobs) {
      await job.retry();
      retriedCount++;
    }

    return {
      queueName,
      retriedCount,
    };
  },
};

