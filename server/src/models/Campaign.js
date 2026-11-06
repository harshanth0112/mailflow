import mongoose from 'mongoose';

export const CAMPAIGN_STATUS = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  QUEUED: 'queued',
  PROCESSING: 'processing',
  SENT: 'sent',
  PARTIALLY_FAILED: 'partially_failed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

export const RECIPIENT_SELECTION_TYPE = {
  ALL_ELIGIBLE: 'all_eligible',
  GROUPS: 'groups',
  TAGS: 'tags',
  SELECTED_CONTACTS: 'selected_contacts',
};

const recipientConfigSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: Object.values(RECIPIENT_SELECTION_TYPE),
      default: RECIPIENT_SELECTION_TYPE.ALL_ELIGIBLE,
    },
    groupIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ContactGroup',
      },
    ],
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    contactIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contact',
      },
    ],
    estimatedCount: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const campaignStatisticsSchema = new mongoose.Schema(
  {
    totalRecipients: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    bounced: { type: Number, default: 0 },
    unsubscribed: { type: Number, default: 0 },
  },
  { _id: false }
);

const campaignSchema = new mongoose.Schema(
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
      required: [true, 'Campaign name is required'],
      trim: true,
      maxlength: [200, 'Campaign name cannot exceed 200 characters'],
    },
    subject: {
      type: String,
      required: [true, 'Subject line is required'],
      trim: true,
      maxlength: [300, 'Subject line cannot exceed 300 characters'],
    },
    previewText: {
      type: String,
      trim: true,
      maxlength: [250, 'Preview text cannot exceed 250 characters'],
      default: '',
    },
    senderEmailAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailAccount',
      default: null,
    },
    senderName: {
      type: String,
      trim: true,
      maxlength: [100, 'Sender name cannot exceed 100 characters'],
      default: '',
    },
    replyTo: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: [255, 'Reply-to email cannot exceed 255 characters'],
      default: '',
    },
    content: {
      type: String,
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
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailTemplate',
      default: null,
    },
    recipientConfiguration: {
      type: recipientConfigSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: Object.values(CAMPAIGN_STATUS),
      default: CAMPAIGN_STATUS.DRAFT,
      index: true,
    },
    scheduledAt: {
      type: Date,
      default: null,
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    statistics: {
      type: campaignStatisticsSchema,
      default: () => ({}),
    },
    // Idempotency token to prevent double sending
    sendIdempotencyKey: {
      type: String,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
campaignSchema.index({ workspaceId: 1, status: 1 });
campaignSchema.index({ workspaceId: 1, createdAt: -1 });

export const Campaign = mongoose.model('Campaign', campaignSchema);

