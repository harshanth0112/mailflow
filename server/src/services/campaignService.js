import mongoose from 'mongoose';
import { Campaign, CAMPAIGN_STATUS, RECIPIENT_SELECTION_TYPE } from '../models/Campaign.js';
import { CampaignRecipient, RECIPIENT_STATUS } from '../models/CampaignRecipient.js';
import { Contact, CONSENT_STATUS, CONTACT_STATUS } from '../models/Contact.js';
import { EmailAccount, CONNECTION_STATUS } from '../models/EmailAccount.js';
import { getCampaignEmailProvider } from './email/campaignEmailProvider.js';
import { decryptToken } from '../utils/cryptoUtils.js';
import { personalizeContent } from '../utils/templatePersonalizer.js';
import { generateRandomToken } from '../utils/tokenUtils.js';
import { getQueue, QUEUE_NAMES } from '../queues/queueManager.js';
import { isQueueWorkerReady } from '../config/redis.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/apiResponse.js';
import { escapeRegex } from '../utils/regexUtils.js';

const requireProductionQueueWorker = async () => {
  if (env.NODE_ENV !== 'production') return;
  if (!env.QUEUE_FEATURES_ENABLED) {
    throw new ApiError(503, 'Campaign sending and scheduling are disabled until a worker is deployed.');
  }
  if (!(await isQueueWorkerReady())) {
    throw new ApiError(503, 'Campaign sending and scheduling are unavailable because the worker is not ready.');
  }
};

// In-memory fallback map for test/offline mode
export const devCampaigns = new Map();
export const devCampaignRecipients = new Map();

export const campaignService = {
  /**
   * Resolve strictly eligible contacts according to recipient configuration
   * Only opted_in, subscribed, and non-suppressed contacts are eligible!
   */
  async resolveEligibleRecipients(workspaceId, recipientConfig = {}) {
    const {
      type = RECIPIENT_SELECTION_TYPE.ALL_ELIGIBLE,
      groupIds = [],
      tags = [],
      contactIds = [],
    } = recipientConfig;

    // Strict compliance criteria
    const baseFilter = {
      workspaceId,
      status: CONTACT_STATUS.SUBSCRIBED,
      consentStatus: CONSENT_STATUS.OPTED_IN,
      unsubscribedAt: null,
    };

    if (mongoose.connection.readyState === 1) {
      if (type === RECIPIENT_SELECTION_TYPE.GROUPS && groupIds.length > 0) {
        baseFilter.groups = { $in: groupIds };
      } else if (type === RECIPIENT_SELECTION_TYPE.TAGS && tags.length > 0) {
        baseFilter.tags = { $in: tags };
      } else if (type === RECIPIENT_SELECTION_TYPE.SELECTED_CONTACTS && contactIds.length > 0) {
        baseFilter._id = { $in: contactIds };
      }

      const eligibleContacts = await Contact.find(baseFilter).lean();
      return eligibleContacts;
    } else {
      const { devContacts } = await import('./contactService.js');
      let contacts = Array.from(devContacts.values()).filter(
        (c) =>
          c.workspaceId.toString() === workspaceId.toString() &&
          c.status === CONTACT_STATUS.SUBSCRIBED &&
          c.consentStatus === CONSENT_STATUS.OPTED_IN &&
          !c.unsubscribedAt
      );

      if (type === RECIPIENT_SELECTION_TYPE.GROUPS && groupIds.length > 0) {
        contacts = contacts.filter((c) =>
          (c.groups || []).some((g) => groupIds.includes(g.toString()))
        );
      } else if (type === RECIPIENT_SELECTION_TYPE.TAGS && tags.length > 0) {
        contacts = contacts.filter((c) =>
          (c.tags || []).some((t) => tags.includes(t))
        );
      } else if (type === RECIPIENT_SELECTION_TYPE.SELECTED_CONTACTS && contactIds.length > 0) {
        contacts = contacts.filter((c) => contactIds.includes(c._id.toString()));
      }

      return contacts;
    }
  },

  /**
   * Preview audience count for a given recipient configuration
   */
  async previewAudienceCount(workspaceId, recipientConfig) {
    const recipients = await this.resolveEligibleRecipients(workspaceId, recipientConfig);
    return {
      eligibleCount: recipients.length,
    };
  },

  /**
   * Create new Campaign
   */
  async createCampaign({ workspaceId, userId, data }) {
    // Calculate initial estimated recipient count
    const recipients = await this.resolveEligibleRecipients(
      workspaceId,
      data.recipientConfiguration
    );
    const estimatedCount = recipients.length;

    const campaignData = {
      ...data,
      workspaceId,
      createdBy: userId,
      status: CAMPAIGN_STATUS.DRAFT,
      recipientConfiguration: {
        ...(data.recipientConfiguration || {}),
        estimatedCount,
      },
      statistics: {
        totalRecipients: estimatedCount,
        sent: 0,
        delivered: 0,
        failed: 0,
        bounced: 0,
        unsubscribed: 0,
      },
    };

    if (mongoose.connection.readyState === 1) {
      const campaign = new Campaign(campaignData);
      await campaign.save();
      return await campaign.populate('senderEmailAccountId', 'emailAddress displayName provider');
    } else {
      const id = new mongoose.Types.ObjectId().toString();
      const campaign = {
        _id: id,
        ...campaignData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      devCampaigns.set(id, campaign);
      return campaign;
    }
  },

  /**
   * List campaigns with filtering, search, sorting, pagination
   */
  async listCampaigns({ workspaceId, query }) {
    const {
      page = 1,
      limit = 20,
      search = '',
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    if (mongoose.connection.readyState === 1) {
      const filter = { workspaceId };
      if (status) filter.status = status;
      if (search && search.trim() !== '') {
        const safeSearch = escapeRegex(search.trim());
        const regex = new RegExp(safeSearch, 'i');
        filter.$or = [{ name: regex }, { subject: regex }];
      }

      const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

      const [campaigns, total] = await Promise.all([
        Campaign.find(filter)
          .populate('senderEmailAccountId', 'emailAddress displayName provider')
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        Campaign.countDocuments(filter),
      ]);

      return {
        campaigns,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    } else {
      let list = Array.from(devCampaigns.values()).filter(
        (c) => c.workspaceId.toString() === workspaceId.toString()
      );

      if (status) list = list.filter((c) => c.status === status);
      if (search) {
        const s = search.toLowerCase();
        list = list.filter(
          (c) =>
            (c.name && c.name.toLowerCase().includes(s)) ||
            (c.subject && c.subject.toLowerCase().includes(s))
        );
      }

      list.sort((a, b) => {
        const valA = a[sortBy] || '';
        const valB = b[sortBy] || '';
        if (sortOrder === 'asc') return valA > valB ? 1 : -1;
        return valA < valB ? 1 : -1;
      });

      const total = list.length;
      const campaigns = list.slice(skip, skip + limit);

      return {
        campaigns,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    }
  },

  /**
   * Get single campaign by ID
   */
  async getCampaignById({ workspaceId, campaignId }) {
    if (mongoose.connection.readyState === 1) {
      return await Campaign.findOne({ _id: campaignId, workspaceId }).populate(
        'senderEmailAccountId',
        'emailAddress displayName provider'
      );
    }
    const c = devCampaigns.get(campaignId);
    if (c && c.workspaceId.toString() === workspaceId.toString()) {
      return c;
    }
    return null;
  },

  /**
   * Update draft campaign
   */
  async updateCampaign({ workspaceId, campaignId, data }) {
    if (mongoose.connection.readyState === 1) {
      const campaign = await Campaign.findOne({ _id: campaignId, workspaceId });
      if (!campaign) {
        throw new Error('Campaign not found.');
      }

      if (
        campaign.status !== CAMPAIGN_STATUS.DRAFT &&
        campaign.status !== CAMPAIGN_STATUS.SCHEDULED
      ) {
        throw new Error(`Cannot modify a campaign in '${campaign.status}' state.`);
      }

      if (data.recipientConfiguration) {
        const recipients = await this.resolveEligibleRecipients(
          workspaceId,
          data.recipientConfiguration
        );
        data.recipientConfiguration.estimatedCount = recipients.length;
        if (!campaign.statistics) campaign.statistics = {};
        campaign.statistics.totalRecipients = recipients.length;
      }

      Object.assign(campaign, data);
      await campaign.save();
      return await campaign.populate('senderEmailAccountId', 'emailAddress displayName provider');
    } else {
      const campaign = devCampaigns.get(campaignId);
      if (!campaign || campaign.workspaceId.toString() !== workspaceId.toString()) {
        throw new Error('Campaign not found.');
      }
      Object.assign(campaign, data, { updatedAt: new Date() });
      devCampaigns.set(campaignId, campaign);
      return campaign;
    }
  },

  /**
   * Duplicate a campaign as a new draft
   */
  async duplicateCampaign({ workspaceId, userId, campaignId }) {
    const original = await this.getCampaignById({ workspaceId, campaignId });
    if (!original) {
      throw new Error('Campaign not found to duplicate.');
    }

    const duplicateData = {
      name: `${original.name} (Copy)`,
      subject: original.subject,
      previewText: original.previewText,
      senderEmailAccountId: original.senderEmailAccountId?._id || original.senderEmailAccountId,
      senderName: original.senderName,
      replyTo: original.replyTo,
      htmlContent: original.htmlContent,
      textContent: original.textContent,
      recipientConfiguration: original.recipientConfiguration,
    };

    return await this.createCampaign({
      workspaceId,
      userId,
      data: duplicateData,
    });
  },

  /**
   * Delete a draft or cancelled campaign
   */
  async deleteCampaign({ workspaceId, campaignId }) {
    if (mongoose.connection.readyState === 1) {
      const campaign = await Campaign.findOne({ _id: campaignId, workspaceId });
      if (!campaign) {
        throw new Error('Campaign not found.');
      }

      if (
        campaign.status !== CAMPAIGN_STATUS.DRAFT &&
        campaign.status !== CAMPAIGN_STATUS.CANCELLED
      ) {
        throw new Error(`Only draft or cancelled campaigns can be deleted.`);
      }

      await Campaign.deleteOne({ _id: campaignId });
      await CampaignRecipient.deleteMany({ campaignId });
      return campaign;
    } else {
      const campaign = devCampaigns.get(campaignId);
      if (!campaign || campaign.workspaceId.toString() !== workspaceId.toString()) {
        throw new Error('Campaign not found.');
      }
      devCampaigns.delete(campaignId);
      return campaign;
    }
  },

  /**
   * Dispatch a single test email for a campaign
   */
  async sendTestEmail({ workspaceId, campaignId, recipientEmail, senderEmailAccountId = null }) {
    const campaign = await this.getCampaignById({ workspaceId, campaignId });
    if (!campaign) {
      throw new Error('Campaign not found.');
    }

    const effectiveSenderId =
      senderEmailAccountId ||
      campaign.senderEmailAccountId?._id ||
      campaign.senderEmailAccountId;

    if (!effectiveSenderId) {
      throw new Error('Please select a sender email account before dispatching a test email.');
    }

    // Load sender account with workspace verification
    let senderAccount = null;

    if (mongoose.connection.readyState === 1) {
      senderAccount = await EmailAccount.findOne({
        _id: effectiveSenderId,
        workspaceId,
      }).select('+encryptedAccessToken +encryptedRefreshToken');
    } else {
      const { devEmailAccounts } = await import('./emailAccountService.js');
      senderAccount = devEmailAccounts.get(effectiveSenderId.toString());
      if (senderAccount && senderAccount.workspaceId.toString() !== workspaceId.toString()) {
        senderAccount = null;
      }
    }

    if (!senderAccount) {
      throw new Error('Configured sender mailbox account was not found or access denied.');
    }

    if (senderAccount.connectionStatus && senderAccount.connectionStatus !== CONNECTION_STATUS.CONNECTED) {
      throw new Error(`Sender email account is currently ${senderAccount.connectionStatus}. Please reauthorize.`);
    }

    const provider = getCampaignEmailProvider(senderAccount);
    const isSendliberty = provider.name === 'sendliberty';

    let accessToken = isSendliberty ? undefined : decryptToken(senderAccount.encryptedAccessToken);
    let refreshToken = isSendliberty ? undefined : decryptToken(senderAccount.encryptedRefreshToken);

    // Refresh token proactively if expired
    if (!isSendliberty && senderAccount.tokenExpiresAt && new Date() >= new Date(senderAccount.tokenExpiresAt)) {
      if (!refreshToken) {
        senderAccount.connectionStatus = CONNECTION_STATUS.EXPIRED;
        if (senderAccount.save) await senderAccount.save();
        throw new Error('Sender access token expired and no refresh token is available. Please reauthorize.');
      }

      try {
        const refreshed = await provider.refreshAccessToken(refreshToken);
        accessToken = refreshed.accessToken;
        senderAccount.encryptedAccessToken = (await import('../utils/cryptoUtils.js')).encryptToken(refreshed.accessToken);
        senderAccount.tokenExpiresAt = refreshed.tokenExpiresAt;
        if (senderAccount.save) await senderAccount.save();
      } catch (refreshErr) {
        senderAccount.connectionStatus = refreshErr.isRevoked ? CONNECTION_STATUS.REVOKED : CONNECTION_STATUS.ERROR;
        if (senderAccount.save) await senderAccount.save();
        throw new Error(`Failed to refresh mailbox credentials: ${refreshErr.message}`);
      }
    }

    // Mock contact for placeholder replacement in preview
    const sampleContact = {
      firstName: 'Preview',
      lastName: 'User',
      email: recipientEmail,
      company: 'MailFlow Preview Corp',
    };

    const personalizedHtml = personalizeContent({
      content: campaign.htmlContent || `<p>${campaign.textContent || 'Test Campaign Body'}</p>`,
      contact: sampleContact,
      isHtml: true,
    });

    const personalizedText = personalizeContent({
      content: campaign.textContent || '',
      contact: sampleContact,
      isHtml: false,
    });

    const personalizedSubject = personalizeContent({
      content: `[TEST] ${campaign.subject}`,
      contact: sampleContact,
      isHtml: false,
    });

    const result = await provider.sendEmail({
      from: senderAccount.emailAddress,
      to: recipientEmail,
      subject: personalizedSubject,
      html: personalizedHtml,
      text: personalizedText,
      accessToken,
      refreshToken,
    });

    return result;
  },

  /**
   * Execute or trigger campaign delivery
   * 1. Validates sender and recipients.
   * 2. Sets idempotency key and transitions status to QUEUED / PROCESSING.
   * 3. Creates immutable CampaignRecipient records.
   * 4. Prepares execution compatible with Phase 9 background job queues.
   */
  async triggerCampaignSend({ workspaceId, campaignId, idempotencyKey = null }) {
    await requireProductionQueueWorker();
    let campaign = null;

    if (mongoose.connection.readyState === 1) {
      campaign = await Campaign.findOne({ _id: campaignId, workspaceId });
    } else {
      campaign = devCampaigns.get(campaignId);
    }

    if (!campaign) {
      throw new Error('Campaign not found.');
    }

    // Idempotency protection: Prevent duplicate sends
    if (
      campaign.status === CAMPAIGN_STATUS.QUEUED ||
      campaign.status === CAMPAIGN_STATUS.PROCESSING ||
      campaign.status === CAMPAIGN_STATUS.SENT
    ) {
      throw new Error(`Campaign has already been triggered or sent (status: '${campaign.status}').`);
    }

    if (idempotencyKey && campaign.sendIdempotencyKey === idempotencyKey) {
      throw new Error('Duplicate send request rejected by idempotency constraint.');
    }

    // Sender validation
    if (!campaign.senderEmailAccountId) {
      throw new Error('Cannot send campaign without a valid connected sender email account.');
    }

    if (env.CAMPAIGN_EMAIL_PROVIDER === 'sendliberty') {
      const senderAccountId = campaign.senderEmailAccountId._id || campaign.senderEmailAccountId;
      let senderAccount;
      if (mongoose.connection.readyState === 1) {
        senderAccount = await EmailAccount.findOne({
          _id: senderAccountId,
          workspaceId,
        }).select('provider emailAddress');
      } else {
        const { devEmailAccounts } = await import('./emailAccountService.js');
        senderAccount = devEmailAccounts.get(senderAccountId.toString());
      }
      if (!senderAccount) {
        throw new Error('Configured sender mailbox account was not found or access denied.');
      }
      getCampaignEmailProvider(senderAccount);
    }

    // Recheck recipient eligibility immediately before execution!
    const eligibleContacts = await this.resolveEligibleRecipients(
      workspaceId,
      campaign.recipientConfiguration
    );

    if (eligibleContacts.length === 0) {
      throw new Error(
        'No eligible recipients found. Recipients must be opted-in, subscribed, and not suppressed.'
      );
    }

    const assignedKey = idempotencyKey || generateRandomToken(16);
    campaign.sendIdempotencyKey = assignedKey;
    campaign.status = CAMPAIGN_STATUS.QUEUED;
    campaign.startedAt = new Date();
    campaign.statistics = campaign.statistics || { totalRecipients: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0, failed: 0 };
    campaign.statistics.totalRecipients = eligibleContacts.length;

    // Persist individual recipient records before dispatch
    const recipientRecords = eligibleContacts.map((c) => ({
      campaignId: campaign._id,
      workspaceId,
      contactId: c._id,
      email: c.email,
      recipientStatus: RECIPIENT_STATUS.PENDING,
    }));

    if (mongoose.connection.readyState === 1) {
      await campaign.save();
      // Remove any existing pending records for safety and insert fresh
      await CampaignRecipient.deleteMany({ campaignId: campaign._id });
      await CampaignRecipient.insertMany(recipientRecords, { ordered: false });

      // Enqueue BullMQ dispatch job if Redis is active
      try {
        const dispatchQ = getQueue(QUEUE_NAMES.CAMPAIGN_DISPATCH);
        await dispatchQ.add(
          'dispatch-campaign',
          { campaignId: campaign._id.toString(), workspaceId: workspaceId.toString() },
          { jobId: `campaign-dispatch-${campaign._id.toString()}-${assignedKey}` }
        );
      } catch (redisErr) {
        console.warn(`Campaign dispatch could not be confirmed (${redisErr.name}). Rolling back queued state.`);
        campaign.status = CAMPAIGN_STATUS.DRAFT;
        campaign.startedAt = null;
        campaign.sendIdempotencyKey = null;
        await campaign.save();
        await CampaignRecipient.deleteMany({ campaignId: campaign._id });

        if (env.NODE_ENV === 'production') {
          throw new ApiError(
            503,
            'Campaign dispatch could not be confirmed. Check campaign status before retrying.'
          );
        }
      }
    } else {
      devCampaigns.set(campaignId, campaign);
      recipientRecords.forEach((r) => {
        const id = new mongoose.Types.ObjectId().toString();
        devCampaignRecipients.set(id, { _id: id, ...r, createdAt: new Date() });
      });
    }

    return {
      campaignId: campaign._id,
      status: campaign.status,
      recipientCount: eligibleContacts.length,
      idempotencyKey: assignedKey,
      message: 'Campaign queued successfully. Recipient records initialized.',
    };
  },

  /**
   * Schedule campaign for a future date and time
   */
  async scheduleCampaign({ workspaceId, campaignId, scheduledAt, timezone = 'UTC' }) {
    await requireProductionQueueWorker();
    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      throw new Error('Invalid scheduledAt timestamp format');
    }

    const now = new Date();
    if (scheduledDate <= now) {
      throw new Error('Scheduled date/time must be strictly in the future');
    }

    let campaign;
    if (mongoose.connection.readyState === 1) {
      campaign = await Campaign.findOne({ _id: campaignId, workspaceId });
    } else {
      campaign = devCampaigns.get(campaignId);
      if (campaign && campaign.workspaceId.toString() !== workspaceId.toString()) {
        campaign = null;
      }
    }

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (![CAMPAIGN_STATUS.DRAFT, CAMPAIGN_STATUS.SCHEDULED].includes(campaign.status)) {
      throw new Error(`Cannot schedule campaign with status '${campaign.status}'. Only draft or scheduled campaigns can be scheduled.`);
    }

    if (!campaign.senderEmailAccountId) {
      throw new Error('Cannot schedule campaign without selecting a sender email account');
    }

    campaign.scheduledAt = scheduledDate;
    campaign.timezone = timezone;
    campaign.status = CAMPAIGN_STATUS.SCHEDULED;

    const delayMs = Math.max(0, scheduledDate.getTime() - Date.now());

    if (mongoose.connection.readyState === 1) {
      await campaign.save();

      try {
        const schedQ = getQueue(QUEUE_NAMES.CAMPAIGN_SCHEDULING);
        const existingJob = await schedQ.getJob(`campaign-sched-${campaignId}`);
        if (existingJob) {
          await existingJob.remove();
        }
        await schedQ.add(
          'execute-scheduled-campaign',
          { campaignId: campaign._id.toString(), workspaceId: workspaceId.toString() },
          {
            jobId: `campaign-sched-${campaignId}`,
            delay: delayMs,
          }
        );
      } catch (redisErr) {
        console.warn(`Campaign schedule could not be confirmed (${redisErr.name}). Rolling back scheduled state.`);
        campaign.status = CAMPAIGN_STATUS.DRAFT;
        campaign.scheduledAt = null;
        await campaign.save();

        if (env.NODE_ENV === 'production') {
          throw new ApiError(
            503,
            'Campaign schedule could not be confirmed. Check campaign status before retrying.'
          );
        }
      }
    } else {
      devCampaigns.set(campaignId, campaign);
    }

    return campaign;
  },

  /**
   * Reschedule an already scheduled campaign
   */
  async rescheduleCampaign({ workspaceId, campaignId, scheduledAt, timezone }) {
    let campaign;
    if (mongoose.connection.readyState === 1) {
      campaign = await Campaign.findOne({ _id: campaignId, workspaceId });
    } else {
      campaign = devCampaigns.get(campaignId);
      if (campaign && campaign.workspaceId.toString() !== workspaceId.toString()) {
        campaign = null;
      }
    }

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status !== CAMPAIGN_STATUS.SCHEDULED) {
      throw new Error(`Campaign must be in 'scheduled' status to be rescheduled. Current status: '${campaign.status}'`);
    }

    return this.scheduleCampaign({
      workspaceId,
      campaignId,
      scheduledAt,
      timezone: timezone || campaign.timezone || 'UTC',
    });
  },

  /**
   * Cancel a scheduled or queued campaign
   */
  async cancelCampaign({ workspaceId, campaignId }) {
    let campaign;
    if (mongoose.connection.readyState === 1) {
      campaign = await Campaign.findOne({ _id: campaignId, workspaceId });
    } else {
      campaign = devCampaigns.get(campaignId);
      if (campaign && campaign.workspaceId.toString() !== workspaceId.toString()) {
        campaign = null;
      }
    }

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (![CAMPAIGN_STATUS.SCHEDULED, CAMPAIGN_STATUS.QUEUED].includes(campaign.status)) {
      throw new Error(`Only scheduled or queued campaigns can be cancelled. Current status: '${campaign.status}'`);
    }

    campaign.status = CAMPAIGN_STATUS.CANCELLED;

    if (mongoose.connection.readyState === 1) {
      await campaign.save();

      try {
        const schedQ = getQueue(QUEUE_NAMES.CAMPAIGN_SCHEDULING);
        const schedJob = await schedQ.getJob(`campaign-sched-${campaignId}`);
        if (schedJob) {
          await schedJob.remove();
        }
      } catch (redisErr) {
        console.warn(`Could not remove the scheduled BullMQ job (${redisErr.name}).`);
      }
    } else {
      devCampaigns.set(campaignId, campaign);
    }

    return {
      campaignId: campaign._id,
      status: campaign.status,
      message: 'Campaign has been successfully cancelled.',
    };
  },

  /**
   * Get recipient delivery audit for a campaign
   */
  async getCampaignRecipients({ workspaceId, campaignId, page = 1, limit = 50 }) {
    const skip = (page - 1) * limit;

    if (mongoose.connection.readyState === 1) {
      const [recipients, total] = await Promise.all([
        CampaignRecipient.find({ campaignId, workspaceId })
          .populate('contactId', 'firstName lastName')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        CampaignRecipient.countDocuments({ campaignId, workspaceId }),
      ]);

      return {
        recipients,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    } else {
      const list = Array.from(devCampaignRecipients.values()).filter(
        (r) => r.campaignId.toString() === campaignId.toString()
      );
      return {
        recipients: list.slice(skip, skip + limit),
        pagination: {
          total: list.length,
          page,
          limit,
          totalPages: Math.ceil(list.length / limit) || 1,
        },
      };
    }
  },

  /**
   * Reconnect & Disaster Recovery:
   * Scans for campaigns marked QUEUED or overdue SCHEDULED and ensures they are
   * enqueued in BullMQ without silent job loss.
   */
  async recoverStrandedCampaigns() {
    let recoveredCount = 0;
    if (mongoose.connection.readyState === 1) {
      const strandedQueued = await Campaign.find({
        status: CAMPAIGN_STATUS.QUEUED,
      });

      const overdueScheduled = await Campaign.find({
        status: CAMPAIGN_STATUS.SCHEDULED,
        scheduledAt: { $lte: new Date() },
      });

      const dispatchQ = getQueue(QUEUE_NAMES.CAMPAIGN_DISPATCH);

      for (const camp of strandedQueued) {
        try {
          const jobId = `campaign-dispatch-${camp._id.toString()}-${camp.idempotencyKey || 'recovery'}`;
          const existingJob = await dispatchQ.getJob(jobId);
          if (!existingJob) {
            await dispatchQ.add(
              'dispatch-campaign',
              { campaignId: camp._id.toString(), workspaceId: camp.workspaceId.toString() },
              { jobId }
            );
            recoveredCount++;
            console.log(`[Recovery] Re-enqueued stranded QUEUED campaign: ${camp._id}`);
          }
        } catch (err) {
          console.warn(`Campaign recovery failed for ${camp._id} (${err.name}).`);
        }
      }

      for (const camp of overdueScheduled) {
        try {
          const jobId = `campaign-sched-${camp._id.toString()}`;
          const existingJob = await dispatchQ.getJob(jobId);
          if (!existingJob) {
            await dispatchQ.add(
              'dispatch-campaign',
              { campaignId: camp._id.toString(), workspaceId: camp.workspaceId.toString() },
              { jobId }
            );
            camp.status = CAMPAIGN_STATUS.QUEUED;
            await camp.save();
            recoveredCount++;
            console.log(`[Recovery] Enqueued overdue SCHEDULED campaign: ${camp._id}`);
          }
        } catch (err) {
          console.warn(`Scheduled campaign recovery failed for ${camp._id} (${err.name}).`);
        }
      }
    } else {
      for (const camp of devCampaigns.values()) {
        if (camp.status === CAMPAIGN_STATUS.QUEUED) {
          recoveredCount++;
        }
      }
    }
    return { recoveredCount };
  },
};
