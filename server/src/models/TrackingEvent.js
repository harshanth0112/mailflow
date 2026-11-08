import mongoose from 'mongoose';

export const TRACKING_EVENT_TYPES = {
  OPEN: 'open',
  CLICK: 'click',
};

const trackingEventSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
      index: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CampaignRecipient',
      required: true,
      index: true,
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contact',
      default: null,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    eventType: {
      type: String,
      enum: Object.values(TRACKING_EVENT_TYPES),
      required: true,
      index: true,
    },
    targetUrl: {
      type: String,
      default: null,
    },
    ipAddress: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

trackingEventSchema.index({ campaignId: 1, eventType: 1 });
trackingEventSchema.index({ recipientId: 1, eventType: 1 });

export const TrackingEvent = mongoose.model('TrackingEvent', trackingEventSchema);

