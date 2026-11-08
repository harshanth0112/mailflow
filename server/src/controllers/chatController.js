import { aiService } from '../services/aiService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const chatController = {
  /**
   * GET /api/v1/chat/conversations
   */
  async listConversations(req, res) {
    try {
      const conversations = await aiService.listConversations({
        workspaceId: req.workspace._id,
        userId: req.user._id,
      });
      return sendSuccess(res, 200, 'Conversations retrieved', conversations);
    } catch (err) {
      return sendError(res, 500, err.message || 'Failed to list conversations');
    }
  },

  /**
   * POST /api/v1/chat/conversations
   */
  async createConversation(req, res) {
    try {
      const { title } = req.body || {};
      const conversation = await aiService.createConversation({
        workspaceId: req.workspace._id,
        userId: req.user._id,
        title: title || 'New Conversation',
      });
      return sendSuccess(res, 201, 'Conversation created', conversation);
    } catch (err) {
      return sendError(res, 500, err.message || 'Failed to create conversation');
    }
  },

  /**
   * GET /api/v1/chat/conversations/:id
   */
  async getMessages(req, res) {
    try {
      const result = await aiService.getConversationMessages({
        workspaceId: req.workspace._id,
        userId: req.user._id,
        conversationId: req.params.id,
      });
      return sendSuccess(res, 200, 'Messages retrieved', result);
    } catch (err) {
      return sendError(res, 404, err.message || 'Conversation not found');
    }
  },

  /**
   * POST /api/v1/chat/conversations/:id/messages
   */
  async sendMessage(req, res) {
    try {
      const { prompt, actionType } = req.body;
      if (!prompt) {
        return sendError(res, 400, 'Prompt message is required');
      }

      const result = await aiService.sendMessage({
        workspaceId: req.workspace._id,
        userId: req.user._id,
        conversationId: req.params.id,
        prompt,
        actionType,
      });

      return sendSuccess(res, 200, 'Message sent and reply generated', result);
    } catch (err) {
      return sendError(res, 500, err.message || 'Failed to process chat message');
    }
  },

  /**
   * DELETE /api/v1/chat/conversations/:id
   */
  async deleteConversation(req, res) {
    try {
      await aiService.deleteConversation({
        workspaceId: req.workspace._id,
        userId: req.user._id,
        conversationId: req.params.id,
      });
      return sendSuccess(res, 200, 'Conversation deleted');
    } catch (err) {
      return sendError(res, 404, err.message || 'Failed to delete conversation');
    }
  },

  /**
   * POST /api/v1/chat/quick-action
   * Direct generation without saving conversation (e.g. for composer quick subject line / email draft suggestions)
   */
  async quickAction(req, res) {
    try {
      const { prompt, actionType } = req.body;
      if (!prompt) {
        return sendError(res, 400, 'Prompt is required');
      }

      const completion = await aiService.generateCompletion({
        prompt,
        actionType: actionType || 'general',
      });

      return sendSuccess(res, 200, 'Completion generated', { completion });
    } catch (err) {
      return sendError(res, 500, err.message || 'Failed to generate completion');
    }
  },
};

