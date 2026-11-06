import mongoose from 'mongoose';

export const AUDIT_ACTIONS = {
  // Auth
  LOGIN: 'auth.login',
  LOGOUT: 'auth.logout',
  REGISTER: 'auth.register',
  PASSWORD_RESET: 'auth.password_reset',

  // Workspace & Members
  WORKSPACE_UPDATE: 'workspace.update',
  MEMBER_INVITE: 'member.invite',
  MEMBER_ROLE_CHANGE: 'member.role_change',
  MEMBER_REMOVE: 'member.remove',

  // Mailbox
  MAILBOX_CONNECT: 'mailbox.connect',
  MAILBOX_DISCONNECT: 'mailbox.disconnect',
  MAILBOX_SETTINGS_CHANGE: 'mailbox.settings_change',

  // Campaigns
  CAMPAIGN_CREATE: 'campaign.create',
  CAMPAIGN_UPDATE: 'campaign.update',
  CAMPAIGN_DELETE: 'campaign.delete',
  CAMPAIGN_SCHEDULE: 'campaign.schedule',
  CAMPAIGN_RESCHEDULE: 'campaign.reschedule',
  CAMPAIGN_CANCEL: 'campaign.cancel',
  CAMPAIGN_SEND: 'campaign.send',

  // Auto-Reply & Automations
  AUTOREPLY_RULE_CREATE: 'autoreply.rule_create',
  AUTOREPLY_RULE_UPDATE: 'autoreply.rule_update',
  AUTOREPLY_RULE_DELETE: 'autoreply.rule_delete',
  AUTOMATION_RULE_CREATE: 'automation.rule_create',
  AUTOMATION_RULE_UPDATE: 'automation.rule_update',
  AUTOMATION_RULE_DELETE: 'automation.rule_delete',

  // Contacts
  CONTACT_IMPORT: 'contact.import',
  CONTACT_EXPORT: 'contact.export',
};

const auditLogSchema = new mongoose.Schema(
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
      default: null,
      index: true,
    },
    actorName: {
      type: String,
      default: 'System',
    },
    actorEmail: {
      type: String,
      default: '',
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      default: '', // 'campaign', 'email_account', 'user', 'autoreply_rule', etc.
    },
    entityId: {
      type: String,
      default: '',
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
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

auditLogSchema.index({ workspaceId: 1, createdAt: -1 });
auditLogSchema.index({ workspaceId: 1, action: 1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
