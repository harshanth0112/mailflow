import mongoose from 'mongoose';

export const EMAIL_PROVIDERS = {
  GMAIL: 'gmail',
  OUTLOOK: 'outlook',
  SMTP: 'smtp',
};

export const CONNECTION_STATUS = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
  ERROR: 'error',
};

const emailAccountSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: Object.values(EMAIL_PROVIDERS),
      required: true,
      default: EMAIL_PROVIDERS.GMAIL,
    },
    emailAddress: {
      type: String,
      required: [true, 'Email address is required'],
      trim: true,
      lowercase: true,
    },
    displayName: {
      type: String,
      trim: true,
      default: '',
    },
    // Encrypted OAuth tokens - never stored in plaintext
    encryptedAccessToken: {
      type: String,
      select: false, // Hidden from standard queries for defense-in-depth
      default: '',
    },
    encryptedRefreshToken: {
      type: String,
      select: false, // Hidden from standard queries for defense-in-depth
      default: '',
    },
    tokenExpiresAt: {
      type: Date,
      default: null,
    },
    scopes: [
      {
        type: String,
      },
    ],
    connectionStatus: {
      type: String,
      enum: Object.values(CONNECTION_STATUS),
      default: CONNECTION_STATUS.CONNECTED,
      index: true,
    },
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      dailyQuota: { type: Number, default: 500 },
      sentToday: { type: Number, default: 0 },
      lastSendReset: { type: Date, default: Date.now },
      providerUserId: { type: String, default: '' },
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index: Prevent connecting the exact same provider email multiple times within the same workspace
emailAccountSchema.index({ workspaceId: 1, emailAddress: 1, provider: 1 }, { unique: true });

// Prevent leaking encrypted tokens in JSON output
emailAccountSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.encryptedAccessToken;
  delete obj.encryptedRefreshToken;
  return obj;
};

export const EmailAccount = mongoose.model('EmailAccount', emailAccountSchema);

