import { trackingService } from '../services/trackingService.js';
import { env } from '../config/env.js';

export const trackingController = {
  /**
   * GET /api/v1/track/open/:token
   * Serves 1x1 transparent tracking pixel
   */
  async trackOpen(req, res) {
    const { token } = req.params;
    const ipAddress = req.ip || req.connection?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    try {
      await trackingService.recordOpen({ token, ipAddress, userAgent });
    } catch (err) {
      // Never crash or fail to return pixel on tracking error
    }

    res.set({
      'Content-Type': 'image/gif',
      'Content-Length': trackingService.getTrackingPixelBuffer().length,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    });

    return res.end(trackingService.getTrackingPixelBuffer());
  },

  /**
   * GET /api/v1/track/click/:token
   * Records click event and redirects to destination URL
   */
  async trackClick(req, res) {
    const { token } = req.params;
    const targetUrl = req.query.url;
    const ipAddress = req.ip || req.connection?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    try {
      const destination = await trackingService.recordClick({
        token,
        targetUrl,
        ipAddress,
        userAgent,
      });
      return res.redirect(302, destination);
    } catch (err) {
      // Safe fallback on invalid URL / attack attempt: redirect to safe home
      return res.redirect(302, env.CLIENT_URL || '/');
    }
  },
};

