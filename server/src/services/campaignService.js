import mongoose from 'mongoose';
import { Campaign, CAMPAIGN_STATUS, RECIPIENT_SELECTION_TYPE } from '../models/Campaign.js';
import { CampaignRecipient, RECIPIENT_STATUS } from '../models/CampaignRecipient.js';
import { Contact, CONSENT_STATUS, CONTACT_STATUS } from '../models/Contact.js';
import { EmailAccount, CONNECTION_STATUS } from '../models/EmailAccount.js';
import { emailProviderRegistry } from './email/EmailProviderRegistry.js';
import { decryptToken } from '../utils/cryptoUtils.js';
import { personalizeContent } from '../utils/templatePersonalizer.js';
import { generateRandomToken } from '../utils/tokenUtils.js';

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
        const regex = new RegExp(search.trim(), 'i');
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
  async sendTestEmail({ workspaceId, campaignId, recipientEmail }) {
    const campaign = await this.getCampaignById({ workspaceId, campaignId });
    if (!campaign) {
      throw new Error('Campaign not found.');
    }

    if (!campaign.senderEmailAccountId) {
      throw new Error('Please select a sender email account before dispatching a test email.');
    }

    // Load sender account
    let senderAccount = null;
    const senderAccountId = campaign.senderEmailAccountId._id || campaign.senderEmailAccountId;

    if (mongoose.connection.readyState === 1) {
      senderAccount = await EmailAccount.findOne({
        _id: senderAccountId,
        workspaceId,
      }).select('+encryptedAccessToken +encryptedRefreshToken');
    } else {
      const { devEmailAccounts } = await import('./emailAccountService.js');
      senderAccount = devEmailAccounts.get(senderAccountId.toString());
    }

    if (!senderAccount) {
      throw new Error('Configured sender mailbox account was not found or access denied.');
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

    const provider = emailProviderRegistry.get(senderAccount.provider);
    const accessToken = decryptToken(senderAccount.encryptedAccessToken);
    const refreshToken = decryptToken(senderAccount.encryptedRefreshToken);

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
};

