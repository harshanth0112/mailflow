import mongoose from 'mongoose';
import { Notification, NOTIFICATION_TYPES } from '../models/Notification.js';

// Fallback in-memory map for dev/test mode
export const devNotifications = new Map();

export const notificationService = {
  /**
   * Create an in-app notification
   */
  async createNotification({
    workspaceId,
    userId,
    type = NOTIFICATION_TYPES.SYSTEM_ALERT,
    title,
    message,
    link = '',
    metadata = {},
  }) {
    if (!workspaceId || !userId || !title || !message) {
      throw new Error('WorkspaceId, userId, title, and message are required');
    }

    if (mongoose.connection.readyState === 1) {
      const record = await Notification.create({
        workspaceId,
        userId,
        type,
        title,
        message,
        link,
        metadata,
        isRead: false,
      });
      return record.toObject();
    } else {
      const id = new mongoose.Types.ObjectId().toString();
      const record = {
        _id: id,
        workspaceId: workspaceId.toString(),
        userId: userId.toString(),
        type,
        title,
        message,
        link,
        metadata,
        isRead: false,
        readAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      devNotifications.set(id, record);
      return record;
    }
  },

  /**
   * List notifications for a user within a workspace
   */
  async listNotifications({ workspaceId, userId, isRead, page = 1, limit = 20 }) {
    const skip = (page - 1) * limit;

    if (mongoose.connection.readyState === 1) {
      const filter = {
        workspaceId,
        userId,
      };
      if (typeof isRead === 'boolean') {
        filter.isRead = isRead;
      }

      const [notifications, total] = await Promise.all([
        Notification.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Notification.countDocuments(filter),
      ]);

      return {
        notifications,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    } else {
      let list = Array.from(devNotifications.values()).filter(
        (n) =>
          n.workspaceId.toString() === workspaceId.toString() &&
          n.userId.toString() === userId.toString()
      );
      if (typeof isRead === 'boolean') {
        list = list.filter((n) => n.isRead === isRead);
      }
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const total = list.length;
      const paginated = list.slice(skip, skip + limit);

      return {
        notifications: paginated,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    }
  },

  /**
   * Get unread count
   */
  async getUnreadCount({ workspaceId, userId }) {
    if (mongoose.connection.readyState === 1) {
      return await Notification.countDocuments({
        workspaceId,
        userId,
        isRead: false,
      });
    } else {
      return Array.from(devNotifications.values()).filter(
        (n) =>
          n.workspaceId.toString() === workspaceId.toString() &&
          n.userId.toString() === userId.toString() &&
          !n.isRead
      ).length;
    }
  },

  /**
   * Mark a single notification as read
   */
  async markAsRead({ workspaceId, userId, notificationId }) {
    if (mongoose.connection.readyState === 1) {
      const notif = await Notification.findOneAndUpdate(
        { _id: notificationId, workspaceId, userId },
        { $set: { isRead: true, readAt: new Date() } },
        { new: true }
      ).lean();
      if (!notif) throw new Error('Notification not found');
      return notif;
    } else {
      const notif = devNotifications.get(notificationId);
      if (
        !notif ||
        notif.workspaceId.toString() !== workspaceId.toString() ||
        notif.userId.toString() !== userId.toString()
      ) {
        throw new Error('Notification not found');
      }
      notif.isRead = true;
      notif.readAt = new Date();
      return notif;
    }
  },

  /**
   * Mark all notifications as read for a user in the workspace
   */
  async markAllAsRead({ workspaceId, userId }) {
    if (mongoose.connection.readyState === 1) {
      await Notification.updateMany(
        { workspaceId, userId, isRead: false },
        { $set: { isRead: true, readAt: new Date() } }
      );
      return { success: true };
    } else {
      for (const notif of devNotifications.values()) {
        if (
          notif.workspaceId.toString() === workspaceId.toString() &&
          notif.userId.toString() === userId.toString()
        ) {
          notif.isRead = true;
          notif.readAt = new Date();
        }
      }
      return { success: true };
    }
  },
};

