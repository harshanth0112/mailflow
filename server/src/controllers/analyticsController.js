import { analyticsService } from '../services/analyticsService.js';
import { auditService } from '../services/auditService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const analyticsController = {
  /**
   * GET /api/v1/analytics/overview
   */
  async getOverview(req, res) {
    try {
      const { timeframe = '30d' } = req.query;
      const data = await analyticsService.getDashboardAnalytics({
        workspaceId: req.workspace._id,
        timeframe,
      });
      return sendSuccess(res, 200, 'Analytics retrieved', data);
    } catch (error) {
      return sendError(res, 500, error.message || 'Failed to get analytics overview');
    }
  },

  /**
   * GET /api/v1/analytics/campaigns/:id
   */
  async getCampaignAnalytics(req, res) {
    try {
      const data = await analyticsService.getCampaignAnalytics({
        workspaceId: req.workspace._id,
        campaignId: req.params.id,
      });
      return sendSuccess(res, 200, 'Campaign analytics retrieved', data);
    } catch (error) {
      return sendError(res, 404, error.message || 'Failed to get campaign analytics');
    }
  },

  /**
   * GET /api/v1/analytics/auto-reply
   */
  async getAutoReplyAnalytics(req, res) {
    try {
      const { emailAccountId } = req.query;
      const data = await analyticsService.getAutoReplyAnalytics({
        workspaceId: req.workspace._id,
        emailAccountId,
      });
      return sendSuccess(res, 200, 'Auto-reply analytics retrieved', data);
    } catch (error) {
      return sendError(res, 500, error.message || 'Failed to get auto-reply analytics');
    }
  },

  /**
   * GET /api/v1/analytics/admin/health
   */
  async getAdminHealth(req, res) {
    try {
      const data = await analyticsService.getAdminSystemHealth({
        workspaceId: req.workspace._id,
      });
      return sendSuccess(res, 200, 'System health metrics retrieved', data);
    } catch (error) {
      return sendError(res, 500, error.message || 'Failed to get admin health');
    }
  },

  /**
   * GET /api/v1/analytics/export/campaigns
   * Export campaigns performance CSV
   */
  async exportCampaignsCsv(req, res) {
    try {
      const csv = await analyticsService.exportCampaignsCsv(req.workspace._id);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="campaigns_analytics_${Date.now()}.csv"`
      );
      return res.status(200).send(csv);
    } catch (error) {
      return sendError(res, 500, error.message || 'Failed to export campaigns analytics');
    }
  },

  /**
   * GET /api/v1/analytics/audit-logs
   */
  async listAuditLogs(req, res) {
    try {
      const page = req.query.page ? parseInt(req.query.page, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
      const { action = '', search = '' } = req.query;

      const result = await auditService.listLogs({
        workspaceId: req.workspace._id,
        query: { page, limit, action, search },
      });

      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Audit logs retrieved',
        data: result.logs,
        pagination: result.pagination,
      });
    } catch (error) {
      return sendError(res, 500, error.message || 'Failed to list audit logs');
    }
  },
};

