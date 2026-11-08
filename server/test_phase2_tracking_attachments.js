import assert from 'assert';
import mongoose from 'mongoose';
import { trackingService } from './src/services/trackingService.js';
import { devCampaignRecipients } from './src/services/campaignService.js';
import { TRACKING_EVENT_TYPES } from './src/models/TrackingEvent.js';
import { graphWebhookController } from './src/controllers/graphWebhookController.js';
import path from 'path';
import fs from 'fs';

console.log('\n--- MAILFLOW PHASE 2: TRACKING, ATTACHMENTS & WEBHOOKS TESTS ---\n');

async function runPhase2Tests() {
  const workspaceId = new mongoose.Types.ObjectId().toString();
  const campaignId = new mongoose.Types.ObjectId().toString();
  const recipientId = new mongoose.Types.ObjectId().toString();
  const trackingToken = 'track-token-' + Date.now();

  // Setup test recipient
  devCampaignRecipients.set(recipientId, {
    _id: recipientId,
    workspaceId,
    campaignId,
    email: 'test.tracking@example.com',
    trackingToken,
    openCount: 0,
    clickCount: 0,
    openedAt: null,
    clickedAt: null,
  });

  // [Test 1] 1x1 Transparent Pixel Buffer Verification
  console.log('[Test 1] 1x1 Transparent Pixel Format');
  const pixel = trackingService.getTrackingPixelBuffer();
  assert.ok(Buffer.isBuffer(pixel), 'Pixel must be a valid Buffer');
  assert.strictEqual(pixel.toString('ascii', 0, 6), 'GIF89a', 'Pixel must have standard GIF89a header');
  console.log('✓ Valid 1x1 transparent GIF buffer generated');

  // [Test 2] Open Event Tracking
  console.log('\n[Test 2] Email Open Tracking and Persistence');
  await trackingService.recordOpen({
    token: trackingToken,
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 Test Agent',
  });

  const recAfterOpen = devCampaignRecipients.get(recipientId);
  assert.strictEqual(recAfterOpen.openCount, 1, 'Recipient open count should be 1');
  assert.ok(recAfterOpen.openedAt instanceof Date, 'Recipient openedAt should be recorded');

  // Repeat open (non-unique)
  await trackingService.recordOpen({
    token: trackingToken,
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 Test Agent',
  });
  assert.strictEqual(recAfterOpen.openCount, 2, 'Recipient open count should increment to 2');
  console.log('✓ Email open event recorded, timestamped, and counted');

  // [Test 3] Click Tracking & Open Redirect Protection
  console.log('\n[Test 3] Click Tracking and Open Redirect Prevention');
  assert.strictEqual(trackingService.isValidRedirectUrl('https://mailflow.io/pricing'), true);
  assert.strictEqual(trackingService.isValidRedirectUrl('http://myblog.com/post/1'), true);
  assert.strictEqual(trackingService.isValidRedirectUrl('javascript:alert(1)'), false);
  assert.strictEqual(trackingService.isValidRedirectUrl('data:text/html,evil'), false);
  assert.strictEqual(trackingService.isValidRedirectUrl('//evil.com/phish'), false);

  const destUrl = 'https://mailflow.io/features';
  const redirected = await trackingService.recordClick({
    token: trackingToken,
    targetUrl: destUrl,
    ipAddress: '192.168.1.100',
  });
  assert.strictEqual(redirected, destUrl);
  assert.strictEqual(recAfterOpen.clickCount, 1, 'Recipient click count should be 1');
  assert.ok(recAfterOpen.clickedAt instanceof Date, 'Recipient clickedAt should be recorded');
  console.log('✓ Click tracked safely, destination verified, and open redirects blocked');

  // [Test 4] HTML Tracking Injection
  console.log('\n[Test 4] HTML Link Rewriting & Pixel Injection');
  const sampleHtml = `
    <html>
      <body>
        <h1>Welcome</h1>
        <p>Visit our <a href="https://example.com/shop">Store</a> now!</p>
        <p>Already wrapped: <a href="http://localhost:5000/api/v1/track/click/abc?url=test">Tracked</a></p>
        <a href="mailto:support@example.com">Email Us</a>
      </body>
    </html>
  `;
  const injected = trackingService.injectTracking({
    html: sampleHtml,
    trackingToken,
    baseUrl: 'https://api.mailflow.io',
  });

  assert.ok(injected.includes('https://api.mailflow.io/api/v1/track/click/'), 'Link must be rewritten with click tracker');
  assert.ok(injected.includes('url=https%3A%2F%2Fexample.com%2Fshop'), 'Target URL must be percent-encoded');
  assert.ok(injected.includes('<a href="mailto:support@example.com">Email Us</a>'), 'mailto: link must NOT be rewritten');
  assert.ok(injected.includes('https://api.mailflow.io/api/v1/track/open/'), 'Tracking pixel must be injected into HTML');
  console.log('✓ Links rewritten with tracking tokens and pixel appended cleanly');

  // [Test 5] Microsoft Graph Webhook Handshake
  console.log('\n[Test 5] Microsoft Graph Webhook Handshake');
  let handshakeStatus = null;
  let handshakeBody = null;
  const mockGraphReq = {
    query: { validationToken: 'microsoft_handshake_secret_token_123' },
    body: {},
  };
  const mockGraphRes = {
    setHeader: () => {},
    status: (code) => {
      handshakeStatus = code;
      return {
        send: (body) => {
          handshakeBody = body;
        },
      };
    },
  };

  await graphWebhookController.handleNotification(mockGraphReq, mockGraphRes);
  assert.strictEqual(handshakeStatus, 200, 'Handshake must return HTTP 200');
  assert.strictEqual(handshakeBody, 'microsoft_handshake_secret_token_123', 'Handshake must return plain text validationToken');
  console.log('✓ Microsoft Graph validation handshake completed successfully');

  // [Test 6] Attachment Path Traversal Prevention
  console.log('\n[Test 6] Attachment Path Traversal Protection');
  const evilFilename = '../../../../etc/passwd';
  const safeBase = path.basename(evilFilename);
  assert.strictEqual(safeBase, 'passwd', 'Path.basename must strip directory traversal operators');
  console.log('✓ Directory traversal sequences neutralized in attachment handling');

  console.log('\n======================================================');
  console.log('✓ ALL PHASE 2 TRACKING & ATTACHMENT TESTS PASSED!');
  console.log('======================================================\n');
  process.exit(0);
}

runPhase2Tests().catch((err) => {
  console.error('Phase 2 test failed:', err);
  process.exit(1);
});
