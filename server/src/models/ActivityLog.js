import mongoose from 'mongoose';

export const LOG_STATUS = {
  RECEIVED: 'received',
  MATCHED: 'matched',
  REPLIED: 'replied',
  SKIPPED: 'skipped',
  FAILED: 'failed',
};

const activityLogSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    emailAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailAccount',
      required: true,
      index: true,
    },
    matchedRuleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AutoReplyRule',
      default: null,
    },
    provider: {
      type: String,
      default: 'gmail',
    },
    // Message identification
    providerMessageId: {
      type: String,
      required: true,
      index: true,
    },
    providerThreadId: {
      type: String,
      default: '',
      index: true,
    },
    from: {
      type: String,
      required: true,
      index: true,
    },
    to: {
      type: String,
      default: '',
    },
    subject: {
      type: String,
      default: '',
    },
    snippet: {
      type: String,
      default: '',
    },
    receivedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: Object.values(LOG_STATUS),
      default: LOG_STATUS.RECEIVED,
      index: true,
    },
    skipReason: {
      type: String,
      default: '',
    },
    replyDetails: {
      repliedAt: { type: Date, default: null },
      replySubject: { type: String, default: '' },
      replyMessageId: { type: String, default: '' },
      errorMessage: { type: String, default: null },
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index: Prevent duplicate replies/processing of the same incoming message
activityLogSchema.index({ workspaceId: 1, emailAccountId: 1, providerMessageId: 1 }, { unique: true });
activityLogSchema.index({ workspaceId: 1, from: 1, createdAt: -1 });

export const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
