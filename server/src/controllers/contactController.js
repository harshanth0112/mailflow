import { contactService } from '../services/contactService.js';
import {
  contactCreateSchema,
  contactUpdateSchema,
  contactQuerySchema,
  contactGroupSchema,
  assignGroupsSchema,
  manageTagsSchema,
} from '../validators/contactValidators.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const contactController = {
  /**
   * GET /api/v1/contacts
   * List contacts with filtering, pagination, search, sorting
   */
  async listContacts(req, res) {
    try {
      const validation = contactQuerySchema.safeParse(req.query);
      if (!validation.success) {
        return sendError(res, 400, 'Invalid query parameters', validation.error.flatten().fieldErrors);
      }

      const result = await contactService.listContacts({
        workspaceId: req.workspace._id,
        query: validation.data,
      });

      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Contacts retrieved successfully',
        data: result.contacts,
        pagination: result.pagination,
      });
    } catch (error) {
      return sendError(res, 500, error.message || 'Failed to list contacts');
    }
  },

  /**
   * GET /api/v1/contacts/stats
   * Returns count of contacts in the current workspace
   */
  async getStats(req, res) {
    try {
      const total = await contactService.getContactCount(req.workspace._id);
      return sendSuccess(res, 200, 'Contact stats retrieved', { total });
    } catch (error) {
      return sendError(res, 500, error.message || 'Failed to get contact stats');
    }
  },

  /**
   * POST /api/v1/contacts
   * Create a new contact
   */
  async createContact(req, res) {
    try {
      const validation = contactCreateSchema.safeParse(req.body);
      if (!validation.success) {
        return sendError(res, 400, 'Validation failed', validation.error.flatten().fieldErrors);
      }

      const contact = await contactService.createContact({
        workspaceId: req.workspace._id,
        userId: req.user._id,
        data: validation.data,
      });

      return sendSuccess(res, 201, 'Contact created successfully', contact);
    } catch (error) {
      if (error.message && error.message.includes('already exists')) {
        return sendError(res, 409, error.message);
      }
      return sendError(res, 500, error.message || 'Failed to create contact');
    }
  },

  /**
   * GET /api/v1/contacts/:id
   */
  async getContact(req, res) {
    try {
      const contact = await contactService.getContactById({
        workspaceId: req.workspace._id,
        contactId: req.params.id,
      });

      if (!contact) {
        return sendError(res, 404, 'Contact not found');
      }

      return sendSuccess(res, 200, 'Contact details retrieved', contact);
    } catch (error) {
      return sendError(res, 500, error.message || 'Failed to get contact');
    }
  },

  /**
   * PATCH /api/v1/contacts/:id
   */
  async updateContact(req, res) {
    try {
      const validation = contactUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        return sendError(res, 400, 'Validation failed', validation.error.flatten().fieldErrors);
      }

      const updated = await contactService.updateContact({
        workspaceId: req.workspace._id,
        contactId: req.params.id,
        data: validation.data,
      });

      return sendSuccess(res, 200, 'Contact updated successfully', updated);
    } catch (error) {
      if (error.message && error.message.includes('already exists')) {
        return sendError(res, 409, error.message);
      }
      if (error.message && error.message.includes('not found')) {
        return sendError(res, 404, error.message);
      }
      return sendError(res, 500, error.message || 'Failed to update contact');
    }
  },

  /**
   * DELETE /api/v1/contacts/:id
   */
  async deleteContact(req, res) {
    try {
      await contactService.deleteContact({
        workspaceId: req.workspace._id,
        contactId: req.params.id,
      });

      return sendSuccess(res, 200, 'Contact deleted successfully', null);
    } catch (error) {
      if (error.message && error.message.includes('not found')) {
        return sendError(res, 404, error.message);
      }
      return sendError(res, 500, error.message || 'Failed to delete contact');
    }
  },

  /**
   * POST /api/v1/contacts/:id/unsubscribe
   */
  async unsubscribeContact(req, res) {
    try {
      const updated = await contactService.unsubscribeContact({
        workspaceId: req.workspace._id,
        contactId: req.params.id,
      });
      return sendSuccess(res, 200, 'Contact has been unsubscribed and suppressed', updated);
    } catch (error) {
      return sendError(res, 500, error.message || 'Failed to unsubscribe contact');
    }
  },

  /**
   * Contact Groups
   */
  async listGroups(req, res) {
    try {
      const groups = await contactService.listGroups(req.workspace._id);
      return sendSuccess(res, 200, 'Groups retrieved', groups);
    } catch (error) {
      return sendError(res, 500, error.message || 'Failed to list groups');
    }
  },

  async createGroup(req, res) {
    try {
      const validation = contactGroupSchema.safeParse(req.body);
      if (!validation.success) {
        return sendError(res, 400, 'Validation failed', validation.error.flatten().fieldErrors);
      }

      const group = await contactService.createGroup({
        workspaceId: req.workspace._id,
        userId: req.user._id,
        data: validation.data,
      });

      return sendSuccess(res, 201, 'Contact group created', group);
    } catch (error) {
      if (error.message && error.message.includes('already exists')) {
        return sendError(res, 409, error.message);
      }
      return sendError(res, 500, error.message || 'Failed to create group');
    }
  },

  async updateGroup(req, res) {
    try {
      const validation = contactGroupSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return sendError(res, 400, 'Validation failed', validation.error.flatten().fieldErrors);
      }

      const group = await contactService.updateGroup({
        workspaceId: req.workspace._id,
        groupId: req.params.groupId,
        data: validation.data,
      });

      return sendSuccess(res, 200, 'Group updated successfully', group);
    } catch (error) {
      if (error.message && error.message.includes('already exists')) {
        return sendError(res, 409, error.message);
      }
      if (error.message && error.message.includes('not found')) {
        return sendError(res, 404, error.message);
      }
      return sendError(res, 500, error.message || 'Failed to update group');
    }
  },

  async deleteGroup(req, res) {
    try {
      await contactService.deleteGroup({
        workspaceId: req.workspace._id,
        groupId: req.params.groupId,
      });

      return sendSuccess(res, 200, 'Group deleted successfully', null);
    } catch (error) {
      if (error.message && error.message.includes('not found')) {
        return sendError(res, 404, error.message);
      }
      return sendError(res, 500, error.message || 'Failed to delete group');
    }
  },

  async assignGroups(req, res) {
    try {
      const validation = assignGroupsSchema.safeParse(req.body);
      if (!validation.success) {
        return sendError(res, 400, 'Validation failed', validation.error.flatten().fieldErrors);
      }

      await contactService.assignGroups({
        workspaceId: req.workspace._id,
        ...validation.data,
      });

      return sendSuccess(res, 200, 'Groups successfully updated for selected contacts', null);
    } catch (error) {
      return sendError(res, 500, error.message || 'Failed to assign groups');
    }
  },

  async manageTags(req, res) {
    try {
      const validation = manageTagsSchema.safeParse(req.body);
      if (!validation.success) {
        return sendError(res, 400, 'Validation failed', validation.error.flatten().fieldErrors);
      }

      await contactService.manageTags({
        workspaceId: req.workspace._id,
        ...validation.data,
      });

      return sendSuccess(res, 200, 'Tags successfully updated for selected contacts', null);
    } catch (error) {
      return sendError(res, 500, error.message || 'Failed to manage tags');
    }
  },

  /**
   * Import Workflow
   */
  async previewImport(req, res) {
    try {
      if (!req.file) {
        return sendError(res, 400, 'Please upload a CSV or Excel file');
      }

      const preview = await contactService.previewImport({
        buffer: req.file.buffer,
        originalName: req.file.originalname,
      });

      return sendSuccess(res, 200, 'File parsed successfully', preview);
    } catch (error) {
      return sendError(res, 400, error.message || 'Failed to parse uploaded file');
    }
  },

  async executeImport(req, res) {
    try {
      if (!req.file) {
        return sendError(res, 400, 'Please upload a CSV or Excel file');
      }

      let mapping = {};
      let defaultTags = [];
      let defaultGroups = [];
      let updateExisting = false;

      if (req.body.mapping) {
        try {
          mapping = typeof req.body.mapping === 'string' ? JSON.parse(req.body.mapping) : req.body.mapping;
        } catch (e) {
          return sendError(res, 400, 'Invalid column mapping format');
        }
      }

      if (req.body.defaultTags) {
        try {
          defaultTags = typeof req.body.defaultTags === 'string' ? JSON.parse(req.body.defaultTags) : req.body.defaultTags;
        } catch (e) {}
      }

      if (req.body.defaultGroups) {
        try {
          defaultGroups = typeof req.body.defaultGroups === 'string' ? JSON.parse(req.body.defaultGroups) : req.body.defaultGroups;
        } catch (e) {}
      }

      if (req.body.updateExisting === 'true' || req.body.updateExisting === true) {
        updateExisting = true;
      }

      const summary = await contactService.executeImport({
        workspaceId: req.workspace._id,
        userId: req.user._id,
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mapping,
        defaultTags,
        defaultGroups,
        updateExisting,
      });

      return sendSuccess(res, 200, 'Import completed', summary);
    } catch (error) {
      return sendError(res, 500, error.message || 'Import execution failed');
    }
  },

  /**
   * Export
   */
  async exportContacts(req, res) {
    try {
      const format = req.query.format === 'xlsx' ? 'xlsx' : 'csv';
      const fileData = await contactService.exportContacts({
        workspaceId: req.workspace._id,
        format,
        query: req.query,
      });

      res.setHeader('Content-Type', fileData.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileData.filename}"`);
      return res.send(fileData.buffer);
    } catch (error) {
      return sendError(res, 500, error.message || 'Failed to export contacts');
    }
  },
};
