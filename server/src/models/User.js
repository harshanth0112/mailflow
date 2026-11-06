import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
      index: true,
    },
    passwordHash: {
      type: String,
      required: function () {
        // Only require password if no oauth provider account linked
        return !this.oauth || (!this.oauth.googleId && !this.oauth.githubId && !this.oauth.microsoftId);
      },
      select: false, // Do not expose password hash in default queries
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'member'],
      default: 'user',
      index: true,
    },
    status: {
      type: String,
      enum: ['pending_verification', 'active', 'suspended', 'deactivated'],
      default: 'pending_verification',
      index: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    verificationTokenHash: {
      type: String,
      select: false,
    },
    verificationTokenExpiresAt: {
      type: Date,
      select: false,
    },
    resetPasswordTokenHash: {
      type: String,
      select: false,
    },
    resetPasswordExpiresAt: {
      type: Date,
      select: false,
    },
    emailChangePending: {
      newEmail: String,
      tokenHash: String,
      expiresAt: Date,
    },
    onboardingCompleted: {
      type: Boolean,
      default: false,
    },
    onboardingStep: {
      type: Number,
      default: 0,
    },
    onboardingSkipped: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: {
      type: Date,
    },
    lastLoginIp: {
      type: String,
    },
    oauth: {
      googleId: { type: String, sparse: true, index: true },
      githubId: { type: String, sparse: true, index: true },
      microsoftId: { type: String, sparse: true, index: true },
    },
  },
  {
    timestamps: true,
  }
);

// Compare candidate password with stored hash
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Safe JSON serialization helper: exclude sensitive fields
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject ? this.toObject() : { ...this };
  delete obj.passwordHash;
  delete obj.verificationTokenHash;
  delete obj.verificationTokenExpiresAt;
  delete obj.resetPasswordTokenHash;
  delete obj.resetPasswordExpiresAt;
  delete obj.emailChangePending;
  delete obj.__v;
  return obj;
};

export const User = mongoose.model('User', userSchema);
export default User;

