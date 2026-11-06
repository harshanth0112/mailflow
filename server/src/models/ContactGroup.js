import mongoose from 'mongoose';

const contactGroupSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Group name is required'],
      trim: true,
      minlength: [1, 'Group name cannot be empty'],
      maxlength: [100, 'Group name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate group name within the same workspace (case-insensitive)
contactGroupSchema.index(
  { workspaceId: 1, name: 1 },
  {
    unique: true,
    collation: { locale: 'en', strength: 2 },
  }
);

export const ContactGroup = mongoose.model('ContactGroup', contactGroupSchema);

