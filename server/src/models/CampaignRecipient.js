import mongoose from 'mongoose';

export const RECIPIENT_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  BOUNCED: 'bounced',
  FAILED: 'failed',
  SKIPPED_INELIGIBLE: 'skipped_ineligible',
};

const campaignRecipientSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
      index: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contact',
      default: null,
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Recipient email is required'],
      trim: true,
      lowercase: true,
    },
    recipientStatus: {
      type: String,
      enum: Object.values(RECIPIENT_STATUS),
      default: RECIPIENT_STATUS.PENDING,
      index: true,
    },
    providerMessageId: {
      type: String,
      default: null,
    },
    errorCode: {
      type: String,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate recipient records within the same campaign
campaignRecipientSchema.index({ campaignId: 1, email: 1 }, { unique: true });
campaignRecipientSchema.index({ workspaceId: 1, recipientStatus: 1 });

export const CampaignRecipient = mongoose.model('CampaignRecipient', campaignRecipientSchema);

