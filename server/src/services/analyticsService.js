import mongoose from 'mongoose';
import { Campaign, CAMPAIGN_STATUS } from '../models/Campaign.js';
import { CampaignRecipient, RECIPIENT_STATUS } from '../models/CampaignRecipient.js';
import { Contact, CONTACT_STATUS, CONSENT_STATUS } from '../models/Contact.js';
import { EmailAccount, CONNECTION_STATUS } from '../models/EmailAccount.js';
import { AutomationRule, AUTOMATION_STATUS } from '../models/AutomationRule.js';
import { ActivityLog, LOG_STATUS } from '../models/ActivityLog.js';
import { Workspace } from '../models/Workspace.js';
import { Membership } from '../models/Membership.js';
import { User } from '../models/User.js';
import { getQueueMetrics } from '../queues/queueManager.js';
import { isRedisConnected } from '../config/redis.js';

export const analyticsService = {
  /**
   * Main workspace overview statistics
   * Supports timeframe: 'today' | '7d' | '30d' | 'all'
   */
  async getDashboardAnalytics({ workspaceId, timeframe = '30d' }) {
    const now = new Date();
    let startDate = null;

    if (timeframe === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (timeframe === '7d') {
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeframe === '30d') {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    if (mongoose.connection.readyState === 1) {
      const campFilter = { workspaceId };
      const contactFilter = { workspaceId };
      const autoReplyFilter = { workspaceId };

      if (startDate) {
        campFilter.createdAt = { $gte: startDate };
        contactFilter.createdAt = { $gte: startDate };
        autoReplyFilter.createdAt = { $gte: startDate };
      }

      // Aggregate Campaigns stats
      const [
        totalCampaigns,
        scheduledCampaigns,
        activeCampaigns,
        campaignStatsAgg,
        totalContacts,
        subscribedContacts,
        unsubscribedContacts,
        activeAutomationRules,
        autoRepliesSent,
        incomingMessagesProcessed,
      ] = await Promise.all([
        Campaign.countDocuments(campFilter),
        Campaign.countDocuments({ workspaceId, status: CAMPAIGN_STATUS.SCHEDULED }),
        Campaign.countDocuments({
          workspaceId,
          status: { $in: [CAMPAIGN_STATUS.PROCESSING, CAMPAIGN_STATUS.QUEUED] },
        }),
        Campaign.aggregate([
          { $match: campFilter },
          {
            $group: {
              _id: null,
              totalRecipients: { $sum: '$statistics.totalRecipients' },
              sent: { $sum: '$statistics.sent' },
              delivered: { $sum: '$statistics.delivered' },
              failed: { $sum: '$statistics.failed' },
              bounced: { $sum: '$statistics.bounced' },
              opens: { $sum: '$statistics.opens' },
              uniqueOpens: { $sum: '$statistics.uniqueOpens' },
              clicks: { $sum: '$statistics.clicks' },
              uniqueClicks: { $sum: '$statistics.uniqueClicks' },
            },
          },
        ]),
        Contact.countDocuments({ workspaceId }),
        Contact.countDocuments({ workspaceId, status: CONTACT_STATUS.SUBSCRIBED }),
        Contact.countDocuments({ workspaceId, status: CONTACT_STATUS.UNSUBSCRIBED }),
        AutomationRule.countDocuments({ workspaceId, status: AUTOMATION_STATUS.ACTIVE }),
        ActivityLog.countDocuments({ ...autoReplyFilter, status: LOG_STATUS.REPLIED }),
        ActivityLog.countDocuments(autoReplyFilter),
      ]);

      const campTotals = campaignStatsAgg[0] || {
        totalRecipients: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
        bounced: 0,
        opens: 0,
        uniqueOpens: 0,
        clicks: 0,
        uniqueClicks: 0,
      };

      // Calculate safe ratios
      const deliveryRate = campTotals.sent > 0 ? (campTotals.delivered / campTotals.sent) * 100 : 0;
      const openRate = campTotals.delivered > 0 ? (campTotals.uniqueOpens / campTotals.delivered) * 100 : 0;
      const clickRate = campTotals.delivered > 0 ? (campTotals.uniqueClicks / campTotals.delivered) * 100 : 0;

      return {
        timeframe,
        campaigns: {
          total: totalCampaigns,
          scheduled: scheduledCampaigns,
          active: activeCampaigns,
          sent: campTotals.sent,
          delivered: campTotals.delivered,
          failed: campTotals.failed,
          bounced: campTotals.bounced,
          opens: campTotals.opens,
          uniqueOpens: campTotals.uniqueOpens,
          clicks: campTotals.clicks,
          uniqueClicks: campTotals.uniqueClicks,
          rates: {
            deliveryRate: Math.round(deliveryRate * 10) / 10,
            openRate: Math.round(openRate * 10) / 10,
            clickRate: Math.round(clickRate * 10) / 10,
          },
        },
        contacts: {
          total: totalContacts,
          subscribed: subscribedContacts,
          unsubscribed: unsubscribedContacts,
        },
        automations: {
          activeRules: activeAutomationRules,
          incomingProcessed: incomingMessagesProcessed,
          autoRepliesSent,
        },
      };
    } else {
      // In-memory dev fallback
      const { devCampaigns } = await import('./campaignService.js');
      const { devContacts } = await import('./contactService.js');
      const { devAutomations } = await import('./automationService.js');
      const { devActivityLogs } = await import('./autoReplyService.js');

      const camps = Array.from(devCampaigns.values()).filter(
        (c) => c.workspaceId.toString() === workspaceId.toString()
      );
      const contacts = Array.from(devContacts.values()).filter(
        (c) => c.workspaceId.toString() === workspaceId.toString()
      );
      const automations = Array.from(devAutomations.values()).filter(
        (a) => a.workspaceId.toString() === workspaceId.toString()
      );
      const logs = Array.from(devActivityLogs.values()).filter(
        (l) => l.workspaceId.toString() === workspaceId.toString()
      );

      let sent = 0,
        delivered = 0,
        failed = 0,
        bounced = 0,
        opens = 0,
        uniqueOpens = 0,
        clicks = 0,
        uniqueClicks = 0;

      camps.forEach((c) => {
        sent += c.statistics?.sent || 0;
        delivered += c.statistics?.delivered || 0;
        failed += c.statistics?.failed || 0;
        bounced += c.statistics?.bounced || 0;
        opens += c.statistics?.opens || 0;
        uniqueOpens += c.statistics?.uniqueOpens || 0;
        clicks += c.statistics?.clicks || 0;
        uniqueClicks += c.statistics?.uniqueClicks || 0;
      });

      return {
        timeframe,
        campaigns: {
          total: camps.length,
          scheduled: camps.filter((c) => c.status === CAMPAIGN_STATUS.SCHEDULED).length,
          active: camps.filter((c) => [CAMPAIGN_STATUS.QUEUED, CAMPAIGN_STATUS.PROCESSING].includes(c.status)).length,
          sent,
          delivered,
          failed,
          bounced,
          opens,
          uniqueOpens,
          clicks,
          uniqueClicks,
          rates: {
            deliveryRate: sent > 0 ? Math.round((delivered / sent) * 1000) / 10 : 0,
            openRate: delivered > 0 ? Math.round((uniqueOpens / delivered) * 1000) / 10 : 0,
            clickRate: delivered > 0 ? Math.round((uniqueClicks / delivered) * 1000) / 10 : 0,
          },
        },
        contacts: {
          total: contacts.length,
          subscribed: contacts.filter((c) => c.status === CONTACT_STATUS.SUBSCRIBED).length,
          unsubscribed: contacts.filter((c) => c.status === CONTACT_STATUS.UNSUBSCRIBED).length,
        },
        automations: {
          activeRules: automations.filter((a) => a.status === AUTOMATION_STATUS.ACTIVE).length,
          incomingProcessed: logs.length,
          autoRepliesSent: logs.filter((l) => l.status === LOG_STATUS.REPLIED).length,
        },
      };
    }
  },

  /**
   * Campaign performance breakdown
   */
  async getCampaignAnalytics({ workspaceId, campaignId }) {
    let campaign = null;
    if (mongoose.connection.readyState === 1) {
      campaign = await Campaign.findOne({ _id: campaignId, workspaceId }).lean();
    } else {
      const { devCampaigns } = await import('./campaignService.js');
      campaign = devCampaigns.get(campaignId);
      if (campaign && campaign.workspaceId.toString() !== workspaceId.toString()) {
        campaign = null;
      }
    }

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const stats = campaign.statistics || {};
    const sent = stats.sent || 0;
    const delivered = stats.delivered || 0;
    const opens = stats.opens || 0;
    const uniqueOpens = stats.uniqueOpens || 0;
    const clicks = stats.clicks || 0;
    const uniqueClicks = stats.uniqueClicks || 0;
    const unsubscribed = stats.unsubscribed || 0;
    const bounced = stats.bounced || 0;
    const failed = stats.failed || 0;

    return {
      campaignId: campaign._id,
      name: campaign.name,
      status: campaign.status,
      subject: campaign.subject,
      scheduledAt: campaign.scheduledAt,
      completedAt: campaign.completedAt,
      totalRecipients: stats.totalRecipients || 0,
      sent,
      delivered,
      failed,
      bounced,
      opens,
      uniqueOpens,
      clicks,
      uniqueClicks,
      unsubscribed,
      rates: {
        deliveryRate: sent > 0 ? Math.round((delivered / sent) * 1000) / 10 : 0,
        openRate: delivered > 0 ? Math.round((uniqueOpens / delivered) * 1000) / 10 : 0,
        clickRate: delivered > 0 ? Math.round((uniqueClicks / delivered) * 1000) / 10 : 0,
        bounceRate: sent > 0 ? Math.round((bounced / sent) * 1000) / 10 : 0,
        unsubscribeRate: delivered > 0 ? Math.round((unsubscribed / delivered) * 1000) / 10 : 0,
      },
      providerCapabilities: {
        openTrackingSupported: false, // Disclosed transparently: Nodemailer / Gmail OAuth does not fabricate tracking pixel
        clickTrackingSupported: false,
        note: 'Open & click tracking rates reflect verified provider webhook events. MailFlow preserves email deliverability and does not fabricate tracking metrics.',
      },
    };
  },

  /**
   * Automatic reply analytics summary
   */
  async getAutoReplyAnalytics({ workspaceId, emailAccountId = null }) {
    if (mongoose.connection.readyState === 1) {
      const filter = { workspaceId };
      if (emailAccountId) filter.emailAccountId = emailAccountId;

      const [totalProcessed, replied, skipped, failed, topRulesAgg] = await Promise.all([
        ActivityLog.countDocuments(filter),
        ActivityLog.countDocuments({ ...filter, status: LOG_STATUS.REPLIED }),
        ActivityLog.countDocuments({ ...filter, status: LOG_STATUS.SKIPPED }),
        ActivityLog.countDocuments({ ...filter, status: LOG_STATUS.FAILED }),
        ActivityLog.aggregate([
          { $match: { ...filter, matchedRuleId: { $ne: null } } },
          { $group: { _id: '$matchedRuleId', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 },
          {
            $lookup: {
              from: 'autoreplyrules',
              localField: '_id',
              foreignField: '_id',
              as: 'rule',
            },
          },
          { $unwind: { path: '$rule', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              ruleId: '$_id',
              ruleName: '$rule.name',
              count: 1,
            },
          },
        ]),
      ]);

      return {
        totalProcessed,
        replied,
        skipped,
        failed,
        successRate: totalProcessed > 0 ? Math.round((replied / totalProcessed) * 1000) / 10 : 0,
        topTriggeredRules: topRulesAgg,
      };
    } else {
      const { devActivityLogs, devAutoReplyRules } = await import('./autoReplyService.js');
      let list = Array.from(devActivityLogs.values()).filter(
        (l) => l.workspaceId.toString() === workspaceId.toString()
      );
      if (emailAccountId) {
        list = list.filter((l) => l.emailAccountId.toString() === emailAccountId.toString());
      }

      const replied = list.filter((l) => l.status === LOG_STATUS.REPLIED).length;
      const skipped = list.filter((l) => l.status === LOG_STATUS.SKIPPED).length;
      const failed = list.filter((l) => l.status === LOG_STATUS.FAILED).length;

      return {
        totalProcessed: list.length,
        replied,
        skipped,
        failed,
        successRate: list.length > 0 ? Math.round((replied / list.length) * 1000) / 10 : 0,
        topTriggeredRules: [],
      };
    }
  },

  /**
   * Admin system health overview
   */
  async getAdminSystemHealth({ workspaceId }) {
    const queueMetrics = await getQueueMetrics();
    const redisLive = isRedisConnected();

    let accountCount = 0;
    let campaignCount = 0;
    let memberCount = 0;

    if (mongoose.connection.readyState === 1) {
      [accountCount, campaignCount, memberCount] = await Promise.all([
        EmailAccount.countDocuments({ workspaceId }),
        Campaign.countDocuments({ workspaceId }),
        Membership.countDocuments({ workspaceId }),
      ]);
    } else {
      const { devEmailAccounts } = await import('./emailAccountService.js');
      const { devCampaigns } = await import('./campaignService.js');
      accountCount = Array.from(devEmailAccounts.values()).filter(
        (a) => a.workspaceId.toString() === workspaceId.toString()
      ).length;
      campaignCount = Array.from(devCampaigns.values()).filter(
        (c) => c.workspaceId.toString() === workspaceId.toString()
      ).length;
      memberCount = 1;
    }

    return {
      redis: {
        connected: redisLive,
        mode: redisLive ? 'active' : 'degraded (fallback)',
      },
      queues: queueMetrics,
      workspaceSummary: {
        connectedMailboxes: accountCount,
        totalCampaigns: campaignCount,
        teamMembers: memberCount,
      },
      workers: {
        campaignWorker: 'ready',
        autoReplyWorker: 'ready',
      },
    };
  },

  /**
   * Export campaign performance data as CSV string
   */
  async exportCampaignsCsv(workspaceId) {
    let campaigns = [];
    if (mongoose.connection.readyState === 1) {
      campaigns = await Campaign.find({ workspaceId }).sort({ createdAt: -1 }).lean();
    } else {
      const { devCampaigns } = await import('./campaignService.js');
      campaigns = Array.from(devCampaigns.values()).filter(
        (c) => c.workspaceId.toString() === workspaceId.toString()
      );
    }

    const headers = [
      'Campaign Name',
      'Status',
      'Subject',
      'Total Recipients',
      'Sent',
      'Delivered',
      'Failed',
      'Bounced',
      'Created At',
      'Scheduled At',
    ];

    const rows = campaigns.map((c) => [
      `"${(c.name || '').replace(/"/g, '""')}"`,
      c.status || '',
      `"${(c.subject || '').replace(/"/g, '""')}"`,
      c.statistics?.totalRecipients || 0,
      c.statistics?.sent || 0,
      c.statistics?.delivered || 0,
      c.statistics?.failed || 0,
      c.statistics?.bounced || 0,
      c.createdAt ? new Date(c.createdAt).toISOString() : '',
      c.scheduledAt ? new Date(c.scheduledAt).toISOString() : '',
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  },
};
