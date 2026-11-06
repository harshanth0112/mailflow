import mongoose from 'mongoose';

const emailTemplateSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    subject: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },
    htmlContent: {
      type: String,
      default: '',
    },
    textContent: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

emailTemplateSchema.index({ workspaceId: 1, name: 1 });

export const EmailTemplate = mongoose.model('EmailTemplate', emailTemplateSchema);
