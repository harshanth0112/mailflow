import mongoose from 'mongoose';

export const AUTOMATION_TRIGGER_TYPES = {
  CONTACT_ADDED: 'contact_added',
  CONTACT_SUBSCRIBED: 'contact_subscribed',
  TAG_ADDED: 'tag_added',
  CAMPAIGN_SENT: 'campaign_sent',
};

export const AUTOMATION_ACTION_TYPES = {
  SEND_CAMPAIGN: 'send_campaign',
  ADD_TAG: 'add_tag',
  ADD_TO_GROUP: 'add_to_group',
  SEND_NOTIFICATION: 'send_notification',
};

export const AUTOMATION_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PAUSED: 'paused',
};

const automationExecutionLogSchema = new mongoose.Schema(
  {
    triggeredAt: { type: Date, default: Date.now },
    contactEmail: { type: String, default: '' },
    contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', default: null },
    status: { type: String, enum: ['success', 'failed', 'skipped'], default: 'success' },
    details: { type: String, default: '' },
    errorMessage: { type: String, default: null },
  },
  { _id: false }
);

const automationRuleSchema = new mongoose.Schema(
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
      required: [true, 'Automation name is required'],
      trim: true,
      maxlength: [150, 'Automation name cannot exceed 150 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: Object.values(AUTOMATION_STATUS),
      default: AUTOMATION_STATUS.ACTIVE,
      index: true,
    },
    trigger: {
      type: {
        type: String,
        enum: Object.values(AUTOMATION_TRIGGER_TYPES),
        required: true,
      },
      configuration: {
        tag: { type: String, default: '' },
        groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContactGroup', default: null },
      },
    },
    action: {
      type: {
        type: String,
        enum: Object.values(AUTOMATION_ACTION_TYPES),
        required: true,
      },
      configuration: {
        campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', default: null },
        tag: { type: String, default: '' },
        groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContactGroup', default: null },
        delayMinutes: { type: Number, default: 0 },
      },
    },
    statistics: {
      totalExecuted: { type: Number, default: 0 },
      successful: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      lastExecutedAt: { type: Date, default: null },
    },
    executionHistory: [automationExecutionLogSchema],
  },
  {
    timestamps: true,
  }
);

// Indexes
automationRuleSchema.index({ workspaceId: 1, status: 1 });
automationRuleSchema.index({ workspaceId: 1, 'trigger.type': 1 });

export const AutomationRule = mongoose.model('AutomationRule', automationRuleSchema);

