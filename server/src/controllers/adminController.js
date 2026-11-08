import { adminService } from '../services/adminService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const adminController = {
  /**
   * GET /api/v1/admin/overview
   */
  async getOverview(req, res) {
    try {
      const metrics = await adminService.getSystemMetrics();
      return sendSuccess(res, 200, 'System metrics retrieved successfully', metrics);
    } catch (err) {
      return sendError(res, 500, err.message || 'Failed to retrieve system metrics');
    }
  },

  /**
   * GET /api/v1/admin/users
   */
  async listUsers(req, res) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;
      const { search, role, status } = req.query;

      const result = await adminService.listUsers({ search, role, status, page, limit });
      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Users retrieved successfully',
        data: result.users,
        pagination: result.pagination,
      });
    } catch (err) {
      return sendError(res, 500, err.message || 'Failed to retrieve users');
    }
  },

  /**
   * GET /api/v1/admin/users/:id
   */
  async getUserDetails(req, res) {
    try {
      const details = await adminService.getUserDetails(req.params.id);
      return sendSuccess(res, 200, 'User details retrieved successfully', details);
    } catch (err) {
      return sendError(res, 404, err.message || 'User not found');
    }
  },

  /**
   * PATCH /api/v1/admin/users/:id/status
   */
  async updateUserStatus(req, res) {
    try {
      const { status, reason } = req.body;
      const updated = await adminService.updateUserStatus({
        adminUserId: req.user._id,
        targetUserId: req.params.id,
        status,
        reason,
      });
      return sendSuccess(res, 200, 'User status updated successfully', updated);
    } catch (err) {
      return sendError(res, 400, err.message || 'Failed to update user status');
    }
  },

  /**
   * PATCH /api/v1/admin/users/:id/role
   */
  async updateUserRole(req, res) {
    try {
      const { role } = req.body;
      const updated = await adminService.updateUserRole({
        adminUserId: req.user._id,
        targetUserId: req.params.id,
        role,
      });
      return sendSuccess(res, 200, 'User role updated successfully', updated);
    } catch (err) {
      return sendError(res, 400, err.message || 'Failed to update user role');
    }
  },

  /**
   * GET /api/v1/admin/queues
   */
  async getQueues(req, res) {
    try {
      const stats = await adminService.getQueueStats();
      return sendSuccess(res, 200, 'Queue metrics retrieved successfully', stats);
    } catch (err) {
      return sendError(res, 500, err.message || 'Failed to retrieve queue statistics');
    }
  },

  /**
   * POST /api/v1/admin/queues/:queueName/retry-failed
   */
  async retryFailedJobs(req, res) {
    try {
      const result = await adminService.retryFailedJobs(req.params.queueName);
      return sendSuccess(res, 200, 'Failed jobs queued for retry', result);
    } catch (err) {
      return sendError(res, 500, err.message || 'Failed to retry queue jobs');
    }
  },
};

