import { templateService } from '../services/templateService.js';
import {
  emailTemplateQuerySchema,
  emailTemplateSchema,
} from '../validators/emailTemplateValidators.js';
import { sendError, sendSuccess } from '../utils/apiResponse.js';

export const emailTemplateController = {
  async list(req, res) {
    const validation = emailTemplateQuerySchema.safeParse(req.query);
    if (!validation.success) {
      return sendError(res, 400, 'Invalid query parameters', validation.error.flatten().fieldErrors);
    }
    try {
      const result = await templateService.list({
        workspaceId: req.workspace._id,
        query: validation.data,
      });
      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Email templates retrieved successfully',
        data: result.templates,
        pagination: result.pagination,
      });
    } catch (error) {
      return sendError(res, 500, error.message || 'Failed to list email templates');
    }
  },

  async create(req, res) {
    const validation = emailTemplateSchema.safeParse(req.body);
    if (!validation.success) {
      return sendError(res, 400, 'Validation failed', validation.error.flatten().fieldErrors);
    }
    try {
      const template = await templateService.create({
        workspaceId: req.workspace._id,
        userId: req.user._id,
        data: validation.data,
      });
      return sendSuccess(res, 201, 'Email template created successfully', template);
    } catch (error) {
      return sendError(res, 500, error.message || 'Failed to create email template');
    }
  },

  async update(req, res) {
    const validation = emailTemplateSchema.partial().safeParse(req.body);
    if (!validation.success) {
      return sendError(res, 400, 'Validation failed', validation.error.flatten().fieldErrors);
    }
    try {
      const template = await templateService.update({
        workspaceId: req.workspace._id,
        templateId: req.params.id,
        data: validation.data,
      });
      return sendSuccess(res, 200, 'Email template updated successfully', template);
    } catch (error) {
      return sendError(
        res,
        error.message.includes('not found') ? 404 : 400,
        error.message || 'Failed to update email template'
      );
    }
  },

  async delete(req, res) {
    try {
      await templateService.delete({
        workspaceId: req.workspace._id,
        templateId: req.params.id,
      });
      return sendSuccess(res, 200, 'Email template deleted successfully');
    } catch (error) {
      return sendError(
        res,
        error.message.includes('not found') ? 404 : 400,
        error.message || 'Failed to delete email template'
      );
    }
  },
};
