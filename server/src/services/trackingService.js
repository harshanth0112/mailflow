import mongoose from 'mongoose';
import { TrackingEvent, TRACKING_EVENT_TYPES } from '../models/TrackingEvent.js';
import { CampaignRecipient } from '../models/CampaignRecipient.js';
import { Campaign } from '../models/Campaign.js';
import { logger } from '../utils/logger.js';

// 1x1 transparent GIF buffer
const TRANSPARENT_1X1_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

// Fallback in-memory map for dev/test mode without active DB
export const devTrackingEvents = new Map();

export const trackingService = {
  getTrackingPixelBuffer() {
    return TRANSPARENT_1X1_GIF;
  },

  /**
   * Validates target redirect URL against Open Redirect attacks.
   * Only allows valid absolute http or https protocols.
   */
  isValidRedirectUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  },

  /**
   * Record email open event
   */
  async recordOpen({ token, ipAddress = '', userAgent = '' }) {
    if (!token) return;

    if (mongoose.connection.readyState === 1) {
      const recipient = await CampaignRecipient.findOne({ trackingToken: token });
      if (!recipient) {
        logger.warn('Open tracking ignored: unknown tracking token', { token });
        return;
      }

      const isFirstOpen = recipient.openCount === 0;
      recipient.openCount += 1;
      recipient.openedAt = recipient.openedAt || new Date();
      await recipient.save();

      // Record tracking event
      await TrackingEvent.create({
        workspaceId: recipient.workspaceId,
        campaignId: recipient.campaignId,
        recipientId: recipient._id,
        contactId: recipient.contactId,
        email: recipient.email,
        eventType: TRACKING_EVENT_TYPES.OPEN,
        ipAddress,
        userAgent,
      });

      // Update Campaign statistics atomically
      const incFields = { 'statistics.opens': 1 };
      if (isFirstOpen) {
        incFields['statistics.uniqueOpens'] = 1;
      }
      await Campaign.updateOne({ _id: recipient.campaignId }, { $inc: incFields });
    } else {
      // Dev mode fallback
      const { devCampaignRecipients } = await import('./campaignService.js');
      const recipient = Array.from(devCampaignRecipients.values()).find(
        (r) => r.trackingToken === token
      );
      if (recipient) {
        const isFirst = (recipient.openCount || 0) === 0;
        recipient.openCount = (recipient.openCount || 0) + 1;
        recipient.openedAt = recipient.openedAt || new Date();

        const id = new mongoose.Types.ObjectId().toString();
        devTrackingEvents.set(id, {
          _id: id,
          recipientId: recipient._id,
          campaignId: recipient.campaignId,
          eventType: TRACKING_EVENT_TYPES.OPEN,
          isFirst,
          ipAddress,
          userAgent,
          createdAt: new Date(),
        });
      }
    }
  },

  /**
   * Record email click event and validate destination URL
   */
  async recordClick({ token, targetUrl, ipAddress = '', userAgent = '' }) {
    if (!token || !this.isValidRedirectUrl(targetUrl)) {
      throw new Error('Invalid click tracking request or unsafe destination URL');
    }

    if (mongoose.connection.readyState === 1) {
      const recipient = await CampaignRecipient.findOne({ trackingToken: token });
      if (!recipient) {
        throw new Error('Recipient matching tracking token not found');
      }

      const isFirstClick = recipient.clickCount === 0;
      recipient.clickCount += 1;
      recipient.clickedAt = recipient.clickedAt || new Date();
      await recipient.save();

      // Record tracking event
      await TrackingEvent.create({
        workspaceId: recipient.workspaceId,
        campaignId: recipient.campaignId,
        recipientId: recipient._id,
        contactId: recipient.contactId,
        email: recipient.email,
        eventType: TRACKING_EVENT_TYPES.CLICK,
        targetUrl,
        ipAddress,
        userAgent,
      });

      // Update Campaign statistics atomically
      const incFields = { 'statistics.clicks': 1 };
      if (isFirstClick) {
        incFields['statistics.uniqueClicks'] = 1;
      }
      await Campaign.updateOne({ _id: recipient.campaignId }, { $inc: incFields });
    } else {
      // Dev mode fallback
      const { devCampaignRecipients } = await import('./campaignService.js');
      const recipient = Array.from(devCampaignRecipients.values()).find(
        (r) => r.trackingToken === token
      );
      if (recipient) {
        recipient.clickCount = (recipient.clickCount || 0) + 1;
        recipient.clickedAt = recipient.clickedAt || new Date();
        const id = new mongoose.Types.ObjectId().toString();
        devTrackingEvents.set(id, {
          _id: id,
          recipientId: recipient._id,
          campaignId: recipient.campaignId,
          eventType: TRACKING_EVENT_TYPES.CLICK,
          targetUrl,
          createdAt: new Date(),
        });
      }
    }

    return targetUrl;
  },

  /**
   * Rewrites HTML content to wrap links with click redirect tracking and inject the open tracking pixel.
   */
  injectTracking({ html, trackingToken, baseUrl }) {
    if (!html || typeof html !== 'string') return html || '';
    if (!trackingToken || !baseUrl) return html;

    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    const trackClickBase = `${cleanBaseUrl}/api/v1/track/click/${trackingToken}?url=`;
    const trackOpenUrl = `${cleanBaseUrl}/api/v1/track/open/${trackingToken}`;

    // Rewrite regular http/https links in anchor tags (ignoring mailto:, tel:, #)
    let processedHtml = html.replace(
      /<a\b([^>]*?)href=(["'])(https?:\/\/[^"'>\s]+)\2([^>]*?)>/gi,
      (match, prefix, quote, originalHref, suffix) => {
        // Do not wrap if already wrapped with track URL
        if (originalHref.includes('/api/v1/track/')) {
          return match;
        }
        const trackingUrl = `${trackClickBase}${encodeURIComponent(originalHref)}`;
        return `<a${prefix}href="${trackingUrl}"${suffix}>`;
      }
    );

    // Inject tracking pixel
    const pixelImg = `<img src="${trackOpenUrl}" width="1" height="1" alt="" style="display:none !important;visibility:hidden;opacity:0;border:none;" />`;
    if (processedHtml.includes('</body>')) {
      processedHtml = processedHtml.replace('</body>', `${pixelImg}</body>`);
    } else {
      processedHtml += pixelImg;
    }

    return processedHtml;
  },
};

