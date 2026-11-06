import mongoose from 'mongoose';

export const CONSENT_STATUS = {
  OPTED_IN: 'opted_in',
  OPTED_OUT: 'opted_out',
  PENDING: 'pending',
  IMPORTED_UNCONFIRMED: 'imported_unconfirmed',
};

export const CONTACT_STATUS = {
  SUBSCRIBED: 'subscribed',
  UNSUBSCRIBED: 'unsubscribed',
  BOUNCED: 'bounced',
  SUPPRESSED: 'suppressed',
};

export const CONTACT_SOURCES = {
  MANUAL: 'manual',
  IMPORT: 'import',
  API: 'api',
  FORM: 'form',
};

const consentHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: Object.values(CONSENT_STATUS),
      required: true,
    },
    source: {
      type: String,
      default: 'manual',
    },
    note: {
      type: String,
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const contactSchema = new mongoose.Schema(
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
    firstName: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      trim: true,
      lowercase: true,
      maxlength: 255,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 50,
      default: '',
    },
    company: {
      type: String,
      trim: true,
      maxlength: 150,
      default: '',
    },
    jobTitle: {
      type: String,
      trim: true,
      maxlength: 150,
      default: '',
    },
    tags: [
      {
        type: String,
        trim: true,
        maxlength: 50,
      },
    ],
    groups: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ContactGroup',
      },
    ],
    customFields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    source: {
      type: String,
      enum: Object.values(CONTACT_SOURCES),
      default: CONTACT_SOURCES.MANUAL,
    },
    consentStatus: {
      type: String,
      enum: Object.values(CONSENT_STATUS),
      default: CONSENT_STATUS.PENDING,
    },
    consentHistory: [consentHistorySchema],
    subscribedAt: {
      type: Date,
      default: null,
    },
    unsubscribedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(CONTACT_STATUS),
      default: CONTACT_STATUS.SUBSCRIBED,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound Unique Index: Prevent duplicate contacts with the same email in the same workspace
contactSchema.index({ workspaceId: 1, email: 1 }, { unique: true });

// Performance Indexes for query filtering and searching
contactSchema.index({ workspaceId: 1, status: 1 });
contactSchema.index({ workspaceId: 1, consentStatus: 1 });
contactSchema.index({ workspaceId: 1, tags: 1 });
contactSchema.index({ workspaceId: 1, groups: 1 });
contactSchema.index({ workspaceId: 1, createdAt: -1 });

// Helper to determine if contact is strictly eligible for campaign sending
contactSchema.methods.isEligibleForCampaign = function () {
  return (
    this.status === CONTACT_STATUS.SUBSCRIBED &&
    this.consentStatus === CONSENT_STATUS.OPTED_IN &&
    !this.unsubscribedAt
  );
};

export const Contact = mongoose.model('Contact', contactSchema);

