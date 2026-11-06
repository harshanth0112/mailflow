import mongoose from 'mongoose';

export const WORKSPACE_ROLES = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  CAMPAIGN_MANAGER: 'Campaign Manager',
  USER: 'User',
};

export const INVITATION_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
};

const membershipSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace ID is required'],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: function () {
        // userId required if invitation is accepted or user already exists
        return this.invitationStatus === INVITATION_STATUS.ACCEPTED;
      },
      index: true,
    },
    role: {
      type: String,
      enum: Object.values(WORKSPACE_ROLES),
      default: WORKSPACE_ROLES.USER,
      required: true,
      index: true,
    },
    invitationStatus: {
      type: String,
      enum: Object.values(INVITATION_STATUS),
      default: INVITATION_STATUS.ACCEPTED,
      index: true,
    },
    invitedEmail: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    invitationTokenHash: {
      type: String,
      select: false,
    },
    invitationExpiresAt: {
      type: Date,
      select: false,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Enforce unique active membership per user in a workspace
membershipSchema.index(
  { workspaceId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: { userId: { $exists: true, $ne: null } },
  }
);

// Enforce unique pending invitation per invited email in a workspace
membershipSchema.index(
  { workspaceId: 1, invitedEmail: 1 },
  {
    unique: true,
    partialFilterExpression: {
      invitationStatus: INVITATION_STATUS.PENDING,
      invitedEmail: { $exists: true, $ne: null },
    },
  }
);

export const Membership = mongoose.model('Membership', membershipSchema);

