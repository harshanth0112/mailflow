import mongoose from 'mongoose';
import { AutoReplyRule, MATCH_TYPES } from '../models/AutoReplyRule.js';
import { ActivityLog, LOG_STATUS } from '../models/ActivityLog.js';
import { EmailAccount, CONNECTION_STATUS } from '../models/EmailAccount.js';
import { emailProviderRegistry } from './email/EmailProviderRegistry.js';
import { decryptToken } from '../utils/cryptoUtils.js';

// In-memory fallback map for dev mode
export const devAutoReplyRules = new Map();
export const devActivityLogs = new Map();

export const autoReplyService = {
  /**
   * List rules for a workspace / email account
   */
  async listRules({ workspaceId, emailAccountId }) {
    if (mongoose.connection.readyState === 1) {
      const filter = { workspaceId };
      if (emailAccountId) filter.emailAccountId = emailAccountId;
      return await AutoReplyRule.find(filter).sort({ priority: -1, createdAt: -1 }).lean();
    }
    return Array.from(devAutoReplyRules.values())
      .filter(
        (r) =>
          r.workspaceId.toString() === workspaceId.toString() &&
          (!emailAccountId || r.emailAccountId.toString() === emailAccountId.toString())
      )
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  },

  /**
   * Create rule
   */
  async createRule({ workspaceId, userId, data }) {
    const record = {
      isActive: true,
      priority: 0,
      ...data,
      workspaceId,
      createdBy: userId,
      statistics: {
        matchedCount: 0,
        repliedCount: 0,
        lastTriggeredAt: null,
      },
    };

    if (mongoose.connection.readyState === 1) {
      const rule = new AutoReplyRule(record);
      await rule.save();
      return rule.toObject();
    } else {
      const id = new mongoose.Types.ObjectId().toString();
      const rule = { _id: id, ...record, createdAt: new Date(), updatedAt: new Date() };
      devAutoReplyRules.set(id, rule);
      return rule;
    }
  },

  /**
   * Get single rule
   */
  async getRuleById({ workspaceId, ruleId }) {
    if (mongoose.connection.readyState === 1) {
      return await AutoReplyRule.findOne({ _id: ruleId, workspaceId }).lean();
    }
    const rule = devAutoReplyRules.get(ruleId);
    if (rule && rule.workspaceId.toString() === workspaceId.toString()) {
      return rule;
    }
    return null;
  },

  /**
   * Update rule
   */
  async updateRule({ workspaceId, ruleId, data }) {
    if (mongoose.connection.readyState === 1) {
      const updated = await AutoReplyRule.findOneAndUpdate(
        { _id: ruleId, workspaceId },
        { $set: data },
        { new: true, runValidators: true }
      ).lean();
      if (!updated) throw new Error('Auto-reply rule not found');
      return updated;
    } else {
      const rule = devAutoReplyRules.get(ruleId);
      if (!rule || rule.workspaceId.toString() !== workspaceId.toString()) {
        throw new Error('Auto-reply rule not found');
      }
      const updated = { ...rule, ...data, updatedAt: new Date() };
      devAutoReplyRules.set(ruleId, updated);
      return updated;
    }
  },

  /**
   * Delete rule
   */
  async deleteRule({ workspaceId, ruleId }) {
    if (mongoose.connection.readyState === 1) {
      const res = await AutoReplyRule.findOneAndDelete({ _id: ruleId, workspaceId });
      if (!res) throw new Error('Auto-reply rule not found');
      return { success: true };
    } else {
      const rule = devAutoReplyRules.get(ruleId);
      if (!rule || rule.workspaceId.toString() !== workspaceId.toString()) {
        throw new Error('Auto-reply rule not found');
      }
      devAutoReplyRules.delete(ruleId);
      return { success: true };
    }
  },

  /**
   * Update auto-reply settings for email account (toggle auto-reply, default templates, cooldowns)
   */
  async updateAccountSettings({ workspaceId, emailAccountId, settings }) {
    if (mongoose.connection.readyState === 1) {
      const account = await EmailAccount.findOne({ _id: emailAccountId, workspaceId });
      if (!account) throw new Error('Email account not found');
      account.autoReplySettings = {
        ...(account.autoReplySettings || {}),
        ...settings,
      };
      await account.save();
      return account;
    } else {
      const { devEmailAccounts } = await import('./emailAccountService.js');
      const account = devEmailAccounts.get(emailAccountId);
      if (!account || account.workspaceId.toString() !== workspaceId.toString()) {
        throw new Error('Email account not found');
      }
      account.autoReplySettings = {
        ...(account.autoReplySettings || {}),
        ...settings,
      };
      account.updatedAt = new Date();
      devEmailAccounts.set(emailAccountId, account);
      return account;
    }
  },

  /**
   * Evaluates if an incoming email message matches an auto-reply rule
   */
  matchesRule(message, rule) {
    if (!rule.isActive) return false;

    const { conditions } = rule;
    const from = (message.from || '').toLowerCase();
    const subject = (message.subject || '').toLowerCase();
    const body = (message.body || message.snippet || '').toLowerCase();

    // Check Sender Whitelist
    if (conditions.senderWhitelist && conditions.senderWhitelist.length > 0) {
      const whitelisted = conditions.senderWhitelist.some((s) => from.includes(s.toLowerCase()));
      if (!whitelisted) return false;
    }

    // Check Sender Blacklist
    if (conditions.senderBlacklist && conditions.senderBlacklist.length > 0) {
      const blacklisted = conditions.senderBlacklist.some((s) => from.includes(s.toLowerCase()));
      if (blacklisted) return false;
    }

    // Check Keywords
    const keywords = conditions.keywords || [];
    if (keywords.length === 0) {
      return true; // No keywords = universal match
    }

    const checkText = [
      conditions.checkSubject !== false ? subject : '',
      conditions.checkBody !== false ? body : '',
    ]
      .filter(Boolean)
      .join(' ');

    const matchType = conditions.matchType || MATCH_TYPES.CONTAINS;

    return keywords.some((kw) => {
      const term = kw.trim().toLowerCase();
      if (!term) return false;

      if (matchType === MATCH_TYPES.CONTAINS) {
        return checkText.includes(term);
      } else if (matchType === MATCH_TYPES.EXACT) {
        return subject === term || body.trim() === term;
      } else if (matchType === MATCH_TYPES.STARTS_WITH) {
        return subject.startsWith(term) || body.trim().startsWith(term);
      } else if (matchType === MATCH_TYPES.ENDS_WITH) {
        return subject.endsWith(term) || body.trim().endsWith(term);
      } else if (matchType === MATCH_TYPES.REGEX) {
        try {
          return new RegExp(term, 'i').test(checkText);
        } catch {
          return false;
        }
      }
      return false;
    });
  },

  /**
   * Process incoming message for an email account with all safety safeguards:
   * 1. No loop: ignores account's own messages.
   * 2. No automated/no-reply reply loops.
   * 3. Prevents duplicate replies to same providerMessageId.
   * 4. Enforces sender cooldowns.
   * 5. Matches highest priority rule or applies default reply.
   * 6. Dispatches reply via provider and logs to ActivityLog.
   */
  async processIncomingMessage({ workspaceId, emailAccountId, message, mockSend = null }) {
    let account = null;
    if (mongoose.connection.readyState === 1) {
      account = await EmailAccount.findOne({ _id: emailAccountId, workspaceId }).select(
        '+encryptedAccessToken +encryptedRefreshToken'
      );
    } else {
      const { devEmailAccounts } = await import('./emailAccountService.js');
      account = devEmailAccounts.get(emailAccountId);
    }

    if (!account) {
      throw new Error(`Email account ${emailAccountId} not found in workspace`);
    }

    // Safety Safeguard 0: Is Auto-reply enabled on the mailbox?
    const settings = account.autoReplySettings || {};
    if (!settings.enabled) {
      return { status: 'skipped', reason: 'Auto-reply disabled on mailbox' };
    }

    const senderEmail = (message.from || '').toLowerCase();
    const accountEmail = (account.emailAddress || '').toLowerCase();

    // Safety Safeguard 1: Never reply to account's own messages
    if (settings.ignoreOwnMessages !== false && senderEmail.includes(accountEmail)) {
      return { status: 'skipped', reason: 'Self message ignored' };
    }

    // Safety Safeguard 2: Ignore no-reply / automated addresses
    if (
      settings.ignoreNoReply !== false &&
      (senderEmail.includes('no-reply') ||
        senderEmail.includes('noreply') ||
        senderEmail.includes('mailer-daemon') ||
        senderEmail.includes('bounce') ||
        senderEmail.includes('donotreply'))
    ) {
      return { status: 'skipped', reason: 'Automated / no-reply address ignored' };
    }

    // Safety Safeguard 3: Prevent duplicate reply to the exact same messageId
    if (mongoose.connection.readyState === 1) {
      const existing = await ActivityLog.findOne({
        workspaceId,
        emailAccountId,
        providerMessageId: message.id,
      });
      if (existing) {
        return { status: 'skipped', reason: 'Duplicate message already processed' };
      }
    } else {
      const dup = Array.from(devActivityLogs.values()).find(
        (l) =>
          l.workspaceId.toString() === workspaceId.toString() &&
          l.emailAccountId.toString() === emailAccountId.toString() &&
          l.providerMessageId === message.id
      );
      if (dup) {
        return { status: 'skipped', reason: 'Duplicate message already processed' };
      }
    }

    // Safety Safeguard 4: Cooldown per sender to prevent mail loops
    const cooldownMins = settings.cooldownMinutes || 60;
    const cooldownTime = new Date(Date.now() - cooldownMins * 60 * 1000);

    let recentReply = null;
    if (mongoose.connection.readyState === 1) {
      recentReply = await ActivityLog.findOne({
        workspaceId,
        emailAccountId,
        from: senderEmail,
        status: LOG_STATUS.REPLIED,
        createdAt: { $gte: cooldownTime },
      });
    } else {
      recentReply = Array.from(devActivityLogs.values()).find(
        (l) =>
          l.workspaceId.toString() === workspaceId.toString() &&
          l.emailAccountId.toString() === emailAccountId.toString() &&
          l.from === senderEmail &&
          l.status === LOG_STATUS.REPLIED &&
          new Date(l.createdAt) >= cooldownTime
      );
    }

    if (recentReply) {
      return { status: 'skipped', reason: `Cooldown active for sender ${senderEmail} (${cooldownMins}m limit)` };
    }

    // Fetch active rules ordered by priority descending
    const rules = await this.listRules({ workspaceId, emailAccountId });
    let matchedRule = null;

    for (const rule of rules) {
      if (this.matchesRule(message, rule)) {
        matchedRule = rule;
        break;
      }
    }

    // Determine reply subject and content
    let replySubject = '';
    let replyBody = '';
    let replyHtml = '';

    if (matchedRule) {
      replySubject = (matchedRule.replyTemplate?.subject || 'Re: {{subject}}').replace(
        '{{subject}}',
        message.subject || ''
      );
      replyBody = matchedRule.replyTemplate?.body || '';
      replyHtml = matchedRule.replyTemplate?.htmlBody || `<p>${replyBody.replace(/\n/g, '<br/>')}</p>`;
    } else {
      // Default reply
      replySubject = (settings.defaultReplySubject || 'Re: {{subject}}').replace(
        '{{subject}}',
        message.subject || ''
      );
      replyBody = settings.defaultReplyBody || 'Hello,\n\nThank you for contacting us. We have received your email.';
      replyHtml = `<p>${replyBody.replace(/\n/g, '<br/>')}</p>`;
    }

    // Create Initial ActivityLog
    const logData = {
      workspaceId,
      emailAccountId,
      matchedRuleId: matchedRule ? matchedRule._id : null,
      provider: account.provider,
      providerMessageId: message.id,
      providerThreadId: message.threadId || '',
      from: message.from,
      to: message.to || account.emailAddress,
      subject: message.subject || '',
      snippet: message.snippet || '',
      status: LOG_STATUS.RECEIVED,
      receivedAt: new Date(),
    };

    let logId;
    if (mongoose.connection.readyState === 1) {
      const log = new ActivityLog(logData);
      await log.save();
      logId = log._id;
    } else {
      logId = new mongoose.Types.ObjectId().toString();
      devActivityLogs.set(logId, { _id: logId, ...logData, createdAt: new Date() });
    }

    // Send reply via provider or mockSend
    try {
      let sendResult;
      if (mockSend) {
        sendResult = await mockSend({
          to: message.from,
          from: account.emailAddress,
          subject: replySubject,
          body: replyBody,
        });
      } else {
        const provider = emailProviderRegistry.get(account.provider);
        const accessToken = decryptToken(account.encryptedAccessToken);
        const refreshToken = account.encryptedRefreshToken
          ? decryptToken(account.encryptedRefreshToken)
          : null;

        sendResult = await provider.sendEmail({
          from: account.emailAddress,
          to: message.from,
          subject: replySubject,
          html: replyHtml,
          text: replyBody,
          accessToken,
          refreshToken,
        });
      }

      // Update log to REPLIED
      if (mongoose.connection.readyState === 1) {
        await ActivityLog.findByIdAndUpdate(logId, {
          status: LOG_STATUS.REPLIED,
          'replyDetails.repliedAt': new Date(),
          'replyDetails.replySubject': replySubject,
          'replyDetails.replyMessageId': sendResult?.messageId || 'SENT',
        });
        if (matchedRule) {
          await AutoReplyRule.findByIdAndUpdate(matchedRule._id, {
            $inc: { 'statistics.matchedCount': 1, 'statistics.repliedCount': 1 },
            'statistics.lastTriggeredAt': new Date(),
          });
        }
      } else {
        const log = devActivityLogs.get(logId);
        log.status = LOG_STATUS.REPLIED;
        log.replyDetails = {
          repliedAt: new Date(),
          replySubject,
          replyMessageId: sendResult?.messageId || 'SENT',
        };
        devActivityLogs.set(logId, log);

        if (matchedRule) {
          const r = devAutoReplyRules.get(matchedRule._id.toString());
          if (r) {
            r.statistics.matchedCount = (r.statistics.matchedCount || 0) + 1;
            r.statistics.repliedCount = (r.statistics.repliedCount || 0) + 1;
            r.statistics.lastTriggeredAt = new Date();
          }
        }
      }

      return {
        status: 'replied',
        ruleMatched: Boolean(matchedRule),
        ruleName: matchedRule?.name || 'Default Reply',
        replySubject,
      };
    } catch (sendErr) {
      if (mongoose.connection.readyState === 1) {
        await ActivityLog.findByIdAndUpdate(logId, {
          status: LOG_STATUS.FAILED,
          'replyDetails.errorMessage': sendErr.message,
        });
      } else {
        const log = devActivityLogs.get(logId);
        log.status = LOG_STATUS.FAILED;
        log.replyDetails = { errorMessage: sendErr.message };
        devActivityLogs.set(logId, log);
      }
      throw sendErr;
    }
  },

  /**
   * Get activity logs with filtering and pagination
   */
  async listActivityLogs({ workspaceId, query = {} }) {
    const { page = 1, limit = 20, emailAccountId, status } = query;
    const skip = (page - 1) * limit;

    if (mongoose.connection.readyState === 1) {
      const filter = { workspaceId };
      if (emailAccountId) filter.emailAccountId = emailAccountId;
      if (status) filter.status = status;

      const [logs, total] = await Promise.all([
        ActivityLog.find(filter)
          .populate('emailAccountId', 'emailAddress provider')
          .populate('matchedRuleId', 'name')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        ActivityLog.countDocuments(filter),
      ]);

      return {
        logs,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    } else {
      let list = Array.from(devActivityLogs.values()).filter(
        (l) => l.workspaceId.toString() === workspaceId.toString()
      );
      if (emailAccountId) {
        list = list.filter((l) => l.emailAccountId.toString() === emailAccountId.toString());
      }
      if (status) {
        list = list.filter((l) => l.status === status);
      }

      return {
        logs: list.slice(skip, skip + limit),
        pagination: {
          total: list.length,
          page,
          limit,
          totalPages: Math.ceil(list.length / limit) || 1,
        },
      };
    }
  },
};
