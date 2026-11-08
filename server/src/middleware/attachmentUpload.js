import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const UPLOAD_ROOT = path.resolve('uploads', 'attachments');

// Ensure base upload directory exists
if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'text/csv',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.csv',
  '.txt',
  '.docx',
  '.xlsx',
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const workspaceId = req.workspace?._id?.toString() || 'common';
    const targetDir = path.join(UPLOAD_ROOT, workspaceId);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeUniqueName = `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${ext}`;
    cb(null, safeUniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(
      new Error(
        `File type "${ext}" or MIME "${file.mimetype}" is not permitted. Allowed: PDF, PNG, JPG, GIF, CSV, TXT, DOCX, XLSX.`
      ),
      false
    );
  }
  cb(null, true);
};

export const uploadAttachment = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 5, // max 5 attachments per campaign
  },
});

