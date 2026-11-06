import { automationService } from '../services/automationService.js';
import {
  automationCreateSchema,
  automationUpdateSchema,
  automationQuerySchema,
} from '../validators/automationValidators.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const automationController = {
  /**
   * GET /api/v1/automations
   * List automations
   */
  async listAutomations(req, res) {
    try {
      const validation = automationQuerySchema.safeParse(req.query);
      if (!validation.success) {
        return sendError(res, 400, 'Invalid query parameters', validation.error.flatten().fieldErrors);
      }

      const result = await automationService.listAutomations({
        workspaceId: req.workspace._id,
        query: validation.data,
      });

      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Automations retrieved successfully',
        data: result.automations,
        pagination: result.pagination,
      });
    } catch (error) {
      return sendError(res, 500, error.message || 'Failed to list automations');
    }
  },

  /**
   * POST /api/v1/automations
   * Create automation
   */
  async createAutomation(req, res) {
    try {
      const validation = automationCreateSchema.safeParse(req.body);
      if (!validation.success) {
        return sendError(res, 400, 'Validation failed', validation.error.flatten().fieldErrors);
      }

      const automation = await automationService.createAutomation({
        workspaceId: req.workspace._id,
        userId: req.user._id,
        data: validation.data,
      });

      return sendSuccess(res, 201, 'Automation rule created successfully', automation);
    } catch (error) {
      return sendError(res, 400, error.message || 'Failed to create automation rule');
    }
  },

  /**
   * GET /api/v1/automations/:id
   * Get single automation
   */
  async getAutomation(req, res) {
    try {
      const automation = await automationService.getAutomationById({
        workspaceId: req.workspace._id,
        automationId: req.params.id,
      });

      return sendSuccess(res, 200, 'Automation rule retrieved', automation);
    } catch (error) {
      return sendError(res, 404, error.message || 'Automation rule not found');
    }
  },

  /**
   * PATCH /api/v1/automations/:id
   * Update automation
   */
  async updateAutomation(req, res) {
    try {
      const validation = automationUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        return sendError(res, 400, 'Validation failed', validation.error.flatten().fieldErrors);
      }

      const automation = await automationService.updateAutomation({
        workspaceId: req.workspace._id,
        automationId: req.params.id,
        data: validation.data,
      });

      return sendSuccess(res, 200, 'Automation rule updated', automation);
    } catch (error) {
      return sendError(res, 400, error.message || 'Failed to update automation rule');
    }
  },

  /**
   * DELETE /api/v1/automations/:id
   * Delete automation
   */
  async deleteAutomation(req, res) {
    try {
      const result = await automationService.deleteAutomation({
        workspaceId: req.workspace._id,
        automationId: req.params.id,
      });

      return sendSuccess(res, 200, result.message, null);
    } catch (error) {
      return sendError(res, 400, error.message || 'Failed to delete automation rule');
    }
  },

  /**
   * POST /api/v1/automations/:id/toggle
   * Toggle active/inactive
   */
  async toggleStatus(req, res) {
    try {
      const automation = await automationService.toggleStatus({
        workspaceId: req.workspace._id,
        automationId: req.params.id,
      });

      return sendSuccess(res, 200, `Automation rule is now ${automation.status}`, automation);
    } catch (error) {
      return sendError(res, 400, error.message || 'Failed to toggle status');
    }
  },

  /**
   * GET /api/v1/automations/:id/history
   * Get execution history
   */
  async getExecutionHistory(req, res) {
    try {
      const logs = await automationService.getExecutionLogs({
        workspaceId: req.workspace._id,
        automationId: req.params.id,
      });

      return sendSuccess(res, 200, 'Execution history retrieved', logs);
    } catch (error) {
      return sendError(res, 400, error.message || 'Failed to get execution history');
    }
  },
};
