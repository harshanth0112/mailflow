import path from 'path';
import fs from 'fs';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

const UPLOAD_ROOT = path.resolve('uploads', 'attachments');

export const attachmentController = {
  /**
   * POST /api/v1/attachments/upload
   * Upload campaign attachments with workspace isolation
   */
  async upload(req, res) {
    try {
      if (!req.files || req.files.length === 0) {
        return sendError(res, 400, 'No files were uploaded');
      }

      const attachments = req.files.map((file) => ({
        filename: file.filename,
        originalName: file.originalname,
        path: file.path,
        contentType: file.mimetype,
        size: file.size,
      }));

      return sendSuccess(res, 201, 'Attachments uploaded successfully', { attachments });
    } catch (error) {
      return sendError(res, 500, error.message || 'Failed to upload attachments');
    }
  },

  /**
   * GET /api/v1/attachments/download/:filename
   * Securely download workspace-scoped attachment
   */
  async download(req, res) {
    try {
      const { filename } = req.params;
      const workspaceId = req.workspace._id.toString();

      // Normalize and prevent path traversal
      const safeFilename = path.basename(filename);
      const filePath = path.resolve(UPLOAD_ROOT, workspaceId, safeFilename);

      // Verify file is strictly inside the workspace directory
      const workspaceDir = path.resolve(UPLOAD_ROOT, workspaceId);
      if (!filePath.startsWith(workspaceDir) || !fs.existsSync(filePath)) {
        return sendError(res, 404, 'Attachment file not found');
      }

      return res.download(filePath, safeFilename);
    } catch (error) {
      return sendError(res, 500, 'Error downloading attachment', error.message);
    }
  },

  /**
   * DELETE /api/v1/attachments/:filename
   * Safely deletes workspace attachment
   */
  async delete(req, res) {
    try {
      const { filename } = req.params;
      const workspaceId = req.workspace._id.toString();
      const safeFilename = path.basename(filename);
      const filePath = path.resolve(UPLOAD_ROOT, workspaceId, safeFilename);
      const workspaceDir = path.resolve(UPLOAD_ROOT, workspaceId);

      if (filePath.startsWith(workspaceDir) && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      return sendSuccess(res, 200, 'Attachment removed successfully');
    } catch (error) {
      return sendError(res, 500, 'Failed to remove attachment', error.message);
    }
  },
};

