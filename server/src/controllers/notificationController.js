import { notificationService } from '../services/notificationService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const notificationController = {
  /**
   * GET /api/v1/notifications
   */
  async list(req, res) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;
      const isRead =
        req.query.isRead === 'true'
          ? true
          : req.query.isRead === 'false'
          ? false
          : undefined;

      const result = await notificationService.listNotifications({
        workspaceId: req.workspace._id,
        userId: req.user._id,
        isRead,
        page,
        limit,
      });

      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Notifications retrieved successfully',
        data: result.notifications,
        pagination: result.pagination,
      });
    } catch (err) {
      return sendError(res, 500, err.message || 'Failed to list notifications');
    }
  },

  /**
   * GET /api/v1/notifications/unread-count
   */
  async getUnreadCount(req, res) {
    try {
      const count = await notificationService.getUnreadCount({
        workspaceId: req.workspace._id,
        userId: req.user._id,
      });
      return sendSuccess(res, 200, 'Unread count retrieved', { unreadCount: count });
    } catch (err) {
      return sendError(res, 500, err.message || 'Failed to get unread count');
    }
  },

  /**
   * PATCH /api/v1/notifications/:id/read
   */
  async markAsRead(req, res) {
    try {
      const notif = await notificationService.markAsRead({
        workspaceId: req.workspace._id,
        userId: req.user._id,
        notificationId: req.params.id,
      });
      return sendSuccess(res, 200, 'Notification marked as read', notif);
    } catch (err) {
      return sendError(res, 404, err.message || 'Failed to update notification');
    }
  },

  /**
   * PATCH /api/v1/notifications/read-all
   */
  async markAllAsRead(req, res) {
    try {
      await notificationService.markAllAsRead({
        workspaceId: req.workspace._id,
        userId: req.user._id,
      });
      return sendSuccess(res, 200, 'All notifications marked as read');
    } catch (err) {
      return sendError(res, 500, err.message || 'Failed to mark all as read');
    }
  },
};

