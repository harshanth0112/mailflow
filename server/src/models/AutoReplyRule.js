import mongoose from 'mongoose';

export const MATCH_TYPES = {
  CONTAINS: 'contains',
  EXACT: 'exact',
  STARTS_WITH: 'starts_with',
  ENDS_WITH: 'ends_with',
  REGEX: 'regex',
};

export const autoReplyRuleSchema = new mongoose.Schema(
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
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Rule name is required'],
      trim: true,
      maxlength: 120,
    },
    priority: {
      type: Number,
      default: 0, // Higher numbers evaluated first
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    // Matching conditions
    conditions: {
      keywords: [
        {
          type: String,
          trim: true,
          lowercase: true,
        },
      ],
      matchType: {
        type: String,
        enum: Object.values(MATCH_TYPES),
        default: MATCH_TYPES.CONTAINS,
      },
      checkSubject: {
        type: Boolean,
        default: true,
      },
      checkBody: {
        type: Boolean,
        default: true,
      },
      senderWhitelist: [
        {
          type: String,
          trim: true,
          lowercase: true,
        },
      ],
      senderBlacklist: [
        {
          type: String,
          trim: true,
          lowercase: true,
        },
      ],
    },
    // Reply Template
    replyTemplate: {
      subject: {
        type: String,
        default: 'Re: {{subject}}',
      },
      body: {
        type: String,
        required: [true, 'Reply body is required'],
      },
      htmlBody: {
        type: String,
        default: '',
      },
    },
    // Metrics
    statistics: {
      matchedCount: { type: Number, default: 0 },
      repliedCount: { type: Number, default: 0 },
      lastTriggeredAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  }
);

autoReplyRuleSchema.index({ workspaceId: 1, emailAccountId: 1, priority: -1 });

export const AutoReplyRule = mongoose.model('AutoReplyRule', autoReplyRuleSchema);
