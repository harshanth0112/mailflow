import { autoReplyService } from '../services/autoReplyService.js';
import {
  autoReplyRuleCreateSchema,
  autoReplyRuleUpdateSchema,
  autoReplySettingsSchema,
} from '../validators/autoReplyValidators.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const autoReplyController = {
  /**
   * GET /api/v1/auto-reply/rules
   */
  async listRules(req, res) {
    try {
      const { emailAccountId } = req.query;
      const rules = await autoReplyService.listRules({
        workspaceId: req.workspace._id,
        emailAccountId,
      });
      return sendSuccess(res, 200, 'Auto-reply rules retrieved', rules);
    } catch (error) {
      return sendError(res, 500, error.message || 'Failed to list rules');
    }
  },

  /**
   * POST /api/v1/auto-reply/rules
   */
  async createRule(req, res) {
    try {
      const validation = autoReplyRuleCreateSchema.safeParse(req.body);
      if (!validation.success) {
        return sendError(res, 400, 'Validation failed', validation.error.flatten().fieldErrors);
      }

      const rule = await autoReplyService.createRule({
        workspaceId: req.workspace._id,
        userId: req.user._id,
        data: validation.data,
      });

      return sendSuccess(res, 201, 'Auto-reply rule created', rule);
    } catch (error) {
      return sendError(res, 400, error.message || 'Failed to create rule');
    }
  },

  /**
   * GET /api/v1/auto-reply/rules/:id
   */
  async getRule(req, res) {
    try {
      const rule = await autoReplyService.getRuleById({
        workspaceId: req.workspace._id,
        ruleId: req.params.id,
      });
      if (!rule) return sendError(res, 404, 'Rule not found');
      return sendSuccess(res, 200, 'Rule retrieved', rule);
    } catch (error) {
      return sendError(res, 500, error.message || 'Failed to get rule');
    }
  },

  /**
   * PATCH /api/v1/auto-reply/rules/:id
   */
  async updateRule(req, res) {
    try {
      const validation = autoReplyRuleUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        return sendError(res, 400, 'Validation failed', validation.error.flatten().fieldErrors);
      }

      const rule = await autoReplyService.updateRule({
        workspaceId: req.workspace._id,
        ruleId: req.params.id,
        data: validation.data,
      });

      return sendSuccess(res, 200, 'Rule updated', rule);
    } catch (error) {
      return sendError(res, 400, error.message || 'Failed to update rule');
    }
  },

  /**
   * DELETE /api/v1/auto-reply/rules/:id
   */
  async deleteRule(req, res) {
    try {
      await autoReplyService.deleteRule({
        workspaceId: req.workspace._id,
        ruleId: req.params.id,
      });
      return sendSuccess(res, 200, 'Rule deleted', null);
    } catch (error) {
      return sendError(res, 400, error.message || 'Failed to delete rule');
    }
  },

  /**
   * PATCH /api/v1/auto-reply/settings/:accountId
   * Update auto-reply settings on email account
   */
  async updateSettings(req, res) {
    try {
      const validation = autoReplySettingsSchema.safeParse(req.body);
      if (!validation.success) {
        return sendError(res, 400, 'Validation failed', validation.error.flatten().fieldErrors);
      }

      const account = await autoReplyService.updateAccountSettings({
        workspaceId: req.workspace._id,
        emailAccountId: req.params.accountId,
        settings: validation.data,
      });

      return sendSuccess(res, 200, 'Auto-reply settings updated', account.autoReplySettings);
    } catch (error) {
      return sendError(res, 400, error.message || 'Failed to update settings');
    }
  },

  /**
   * GET /api/v1/auto-reply/logs
   * List activity logs
   */
  async listActivityLogs(req, res) {
    try {
      const page = req.query.page ? parseInt(req.query.page, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;

      const result = await autoReplyService.listActivityLogs({
        workspaceId: req.workspace._id,
        query: {
          page,
          limit,
          emailAccountId: req.query.emailAccountId,
          status: req.query.status,
        },
      });

      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Activity logs retrieved',
        data: result.logs,
        pagination: result.pagination,
      });
    } catch (error) {
      return sendError(res, 500, error.message || 'Failed to list activity logs');
    }
  },

  /**
   * POST /api/v1/auto-reply/simulate
   * Process a controlled incoming test message to verify matching & reply
   */
  async simulateIncoming(req, res) {
    try {
      const { emailAccountId, message } = req.body;
      if (!emailAccountId || !message || !message.from) {
        return sendError(res, 400, 'emailAccountId and message with "from" are required');
      }

      const result = await autoReplyService.processIncomingMessage({
        workspaceId: req.workspace._id,
        emailAccountId,
        message: {
          id: message.id || `sim-${Date.now()}`,
          from: message.from,
          subject: message.subject || '',
          body: message.body || '',
          snippet: message.snippet || '',
        },
      });

      return sendSuccess(res, 200, 'Incoming message processed', result);
    } catch (error) {
      return sendError(res, 400, error.message || 'Failed to process message');
    }
  },
};

