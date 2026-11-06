import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog.js';

// Dev fallback in-memory store
export const devAuditLogs = new Map();

export const auditService = {
  /**
   * Log an action in the workspace audit trail
   * Sensitive values (passwords, tokens, full emails) must never be passed to details
   */
  async logAction({
    workspaceId,
    userId = null,
    actorName = 'System',
    actorEmail = '',
    action,
    entityType = '',
    entityId = '',
    details = {},
    ipAddress = '',
    userAgent = '',
  }) {
    if (!workspaceId) return null;

    // Sanitize details: strip any accidental password or token fields
    const sanitizedDetails = { ...details };
    delete sanitizedDetails.password;
    delete sanitizedDetails.token;
    delete sanitizedDetails.accessToken;
    delete sanitizedDetails.refreshToken;

    const record = {
      workspaceId,
      userId,
      actorName,
      actorEmail,
      action,
      entityType,
      entityId: entityId ? entityId.toString() : '',
      details: sanitizedDetails,
      ipAddress,
      userAgent,
      createdAt: new Date(),
    };

    if (mongoose.connection.readyState === 1) {
      try {
        const log = new AuditLog(record);
        await log.save();
        return log.toObject();
      } catch (err) {
        console.warn(`Audit log persistence failed (${err.name}).`);
        return null;
      }
    } else {
      const id = new mongoose.Types.ObjectId().toString();
      const log = { _id: id, ...record, updatedAt: new Date() };
      devAuditLogs.set(id, log);
      return log;
    }
  },

  /**
   * List audit logs with pagination and filters
   */
  async listLogs({ workspaceId, query = {} }) {
    const { page = 1, limit = 50, action = '', search = '' } = query;
    const skip = (page - 1) * limit;

    if (mongoose.connection.readyState === 1) {
      const filter = { workspaceId };
      if (action) filter.action = action;
      if (search) {
        filter.$or = [
          { actorName: { $regex: search, $options: 'i' } },
          { actorEmail: { $regex: search, $options: 'i' } },
          { action: { $regex: search, $options: 'i' } },
          { entityType: { $regex: search, $options: 'i' } },
        ];
      }

      const [logs, total] = await Promise.all([
        AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        AuditLog.countDocuments(filter),
      ]);

      return {
        logs,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    } else {
      let list = Array.from(devAuditLogs.values()).filter(
        (l) => l.workspaceId.toString() === workspaceId.toString()
      );
      if (action) list = list.filter((l) => l.action === action);
      if (search) {
        const q = search.toLowerCase();
        list = list.filter(
          (l) =>
            l.actorName.toLowerCase().includes(q) ||
            l.actorEmail.toLowerCase().includes(q) ||
            l.action.toLowerCase().includes(q)
        );
      }
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return {
        logs: list.slice(skip, skip + limit),
        pagination: {
          total: list.length,
          page,
          limit,
          totalPages: Math.ceil(list.length / limit) || 1,
        },
      };
    }
  },
};
