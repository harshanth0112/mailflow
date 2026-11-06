import mongoose from 'mongoose';

const workspaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Workspace name is required'],
      trim: true,
      minlength: [2, 'Workspace name must be at least 2 characters'],
      maxlength: [100, 'Workspace name cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Workspace slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner ID is required'],
      index: true,
    },
    plan: {
      type: String,
      enum: ['free', 'starter', 'pro', 'enterprise'],
      default: 'free',
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'archived'],
      default: 'active',
      index: true,
    },
    settings: {
      defaultFromEmail: {
        type: String,
        trim: true,
        default: '',
      },
      defaultFromName: {
        type: String,
        trim: true,
        default: '',
      },
      timezone: {
        type: String,
        default: 'UTC',
      },
      dailySendLimit: {
        type: Number,
        default: 500,
      },
      enableTracking: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
workspaceSchema.index({ ownerId: 1, status: 1 });

export const Workspace = mongoose.model('Workspace', workspaceSchema);

