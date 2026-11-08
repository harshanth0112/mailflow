import { campaignService } from '../services/campaignService.js';
import {
  campaignCreateSchema,
  campaignUpdateSchema,
  campaignQuerySchema,
  campaignTestEmailSchema,
  campaignScheduleSchema,
  recipientConfigSchema,
} from '../validators/campaignValidators.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const campaignController = {
  /**
   * GET /api/v1/campaigns
   * List campaigns
   */
  async listCampaigns(req, res) {
    try {
      const validation = campaignQuerySchema.safeParse(req.query);
      if (!validation.success) {
        return sendError(res, 400, 'Invalid query parameters', validation.error.flatten().fieldErrors);
      }

      const result = await campaignService.listCampaigns({
        workspaceId: req.workspace._id,
        query: validation.data,
      });

      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Campaigns retrieved successfully',
        data: result.campaigns,
        pagination: result.pagination,
      });
    } catch (error) {
      return sendError(res, 500, error.message || 'Failed to list campaigns');
    }
  },

  /**
   * POST /api/v1/campaigns
   * Create new campaign
   */
  async createCampaign(req, res) {
    try {
      const validation = campaignCreateSchema.safeParse(req.body);
      if (!validation.success) {
        return sendError(res, 400, 'Validation failed', validation.error.flatten().fieldErrors);
      }

      const campaign = await campaignService.createCampaign({
        workspaceId: req.workspace._id,
        userId: req.user._id,
        data: validation.data,
      });

      return sendSuccess(res, 201, 'Campaign created successfully', campaign);
    } catch (error) {
      return sendError(res, 500, error.message || 'Failed to create campaign');
    }
  },

  /**
   * GET /api/v1/campaigns/:id
   */
  async getCampaign(req, res) {
    try {
      const campaign = await campaignService.getCampaignById({
        workspaceId: req.workspace._id,
        campaignId: req.params.id,
      });

      if (!campaign) {
        return sendError(res, 404, 'Campaign not found');
      }

      return sendSuccess(res, 200, 'Campaign retrieved successfully', campaign);
    } catch (error) {
      return sendError(res, 500, error.message || 'Failed to get campaign');
    }
  },

  /**
   * PATCH /api/v1/campaigns/:id
   */
  async updateCampaign(req, res) {
    try {
      const validation = campaignUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        return sendError(res, 400, 'Validation failed', validation.error.flatten().fieldErrors);
      }

      const updated = await campaignService.updateCampaign({
        workspaceId: req.workspace._id,
        campaignId: req.params.id,
        data: validation.data,
      });

      return sendSuccess(res, 200, 'Campaign updated successfully', updated);
    } catch (error) {
      if (error.message && error.message.includes('not found')) {
        return sendError(res, 404, error.message);
      }
      return sendError(res, 400, error.message || 'Failed to update campaign');
    }
  },

  /**
   * POST /api/v1/campaigns/:id/duplicate
   */
  async duplicateCampaign(req, res) {
    try {
      const duplicate = await campaignService.duplicateCampaign({
        workspaceId: req.workspace._id,
        userId: req.user._id,
        campaignId: req.params.id,
      });

      return sendSuccess(res, 201, 'Campaign duplicated as draft', duplicate);
    } catch (error) {
      return sendError(res, 500, error.message || 'Failed to duplicate campaign');
    }
  },

  /**
   * DELETE /api/v1/campaigns/:id
   */
  async deleteCampaign(req, res) {
    try {
      await campaignService.deleteCampaign({
        workspaceId: req.workspace._id,
        campaignId: req.params.id,
      });

      return sendSuccess(res, 200, 'Campaign deleted successfully', null);
    } catch (error) {
      return sendError(res, 400, error.message || 'Failed to delete campaign');
    }
  },

  /**
   * POST /api/v1/campaigns/preview-audience
   * Estimate recipient counts
   */
  async previewAudience(req, res) {
    try {
      const validation = recipientConfigSchema.safeParse(req.body);
      if (!validation.success) {
        return sendError(res, 400, 'Invalid recipient configuration', validation.error.flatten().fieldErrors);
      }

      const result = await campaignService.previewAudienceCount(
        req.workspace._id,
        validation.data
      );

      return sendSuccess(res, 200, 'Audience count preview', result);
    } catch (error) {
      return sendError(res, 500, error.message || 'Failed to preview audience');
    }
  },

  /**
   * POST /api/v1/campaigns/:id/test-email
   * Send test email
   */
  async sendTestEmail(req, res) {
    try {
      const validation = campaignTestEmailSchema.safeParse(req.body);
      if (!validation.success) {
        return sendError(res, 400, 'Validation failed', validation.error.flatten().fieldErrors);
      }

      const result = await campaignService.sendTestEmail({
        workspaceId: req.workspace._id,
        campaignId: req.params.id,
        recipientEmail: validation.data.recipientEmail,
        senderEmailAccountId: validation.data.senderEmailAccountId,
      });

      return sendSuccess(res, 200, 'Test email dispatched successfully', result);
    } catch (error) {
      return sendError(res, 400, error.message || 'Failed to dispatch test email');
    }
  },

  /**
   * POST /api/v1/campaigns/:id/send
   * Trigger campaign sending
   */
  async sendCampaign(req, res) {
    try {
      const idempotencyKey = req.headers['x-idempotency-key'] || null;
      const result = await campaignService.triggerCampaignSend({
        workspaceId: req.workspace._id,
        campaignId: req.params.id,
        idempotencyKey,
      });

      return sendSuccess(res, 200, 'Campaign queued for dispatch', result);
    } catch (error) {
      return sendError(res, 400, error.message || 'Failed to trigger campaign send');
    }
  },

  async scheduleCampaign(req, res) {
    const validation = campaignScheduleSchema.safeParse(req.body);
    if (!validation.success) {
      return sendError(res, 400, 'Validation failed', validation.error.flatten().fieldErrors);
    }
    try {
      const campaign = await campaignService.scheduleCampaign({
        workspaceId: req.workspace._id,
        campaignId: req.params.id,
        ...validation.data,
      });
      return sendSuccess(res, 200, 'Campaign scheduled successfully', campaign);
    } catch (error) {
      return sendError(res, error.statusCode || (error.message.includes('not found') ? 404 : 400), error.message || 'Failed to schedule campaign');
    }
  },

  async rescheduleCampaign(req, res) {
    const validation = campaignScheduleSchema.safeParse(req.body);
    if (!validation.success) {
      return sendError(res, 400, 'Validation failed', validation.error.flatten().fieldErrors);
    }
    try {
      const campaign = await campaignService.rescheduleCampaign({
        workspaceId: req.workspace._id,
        campaignId: req.params.id,
        ...validation.data,
      });
      return sendSuccess(res, 200, 'Campaign rescheduled successfully', campaign);
    } catch (error) {
      return sendError(res, error.statusCode || (error.message.includes('not found') ? 404 : 400), error.message || 'Failed to reschedule campaign');
    }
  },

  async cancelCampaign(req, res) {
    try {
      const result = await campaignService.cancelCampaign({
        workspaceId: req.workspace._id,
        campaignId: req.params.id,
      });
      return sendSuccess(res, 200, 'Campaign cancelled successfully', result);
    } catch (error) {
      return sendError(res, error.statusCode || (error.message.includes('not found') ? 404 : 400), error.message || 'Failed to cancel campaign');
    }
  },

  /**
   * GET /api/v1/campaigns/:id/recipients
   * List recipient records
   */
  async getRecipients(req, res) {
    try {
      const page = req.query.page ? parseInt(req.query.page, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;

      const result = await campaignService.getCampaignRecipients({
        workspaceId: req.workspace._id,
        campaignId: req.params.id,
        page,
        limit,
      });

      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Campaign recipients retrieved',
        data: result.recipients,
        pagination: result.pagination,
      });
    } catch (error) {
      return sendError(res, 500, error.message || 'Failed to get campaign recipients');
    }
  },
};
