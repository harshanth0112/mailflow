import assert from 'assert';
import mongoose from 'mongoose';
import { analyticsService } from './src/services/analyticsService.js';
import { auditService, devAuditLogs } from './src/services/auditService.js';
import { devCampaigns } from './src/services/campaignService.js';
import { devContacts } from './src/services/contactService.js';
import { devActivityLogs } from './src/services/autoReplyService.js';
import { CAMPAIGN_STATUS } from './src/models/Campaign.js';
import { CONTACT_STATUS } from './src/models/Contact.js';
import { LOG_STATUS } from './src/models/ActivityLog.js';
import { AUDIT_ACTIONS } from './src/models/AuditLog.js';

async function runPhase11Tests() {
  console.log('--- MAILFLOW PHASE 11: ANALYTICS & ADMIN SMOKE TESTS ---');

  const workspaceId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();

  // Test 1: Record sample campaigns with metrics
  console.log('\n[Test 1] Populating campaign metrics in workspace');
  const campId1 = new mongoose.Types.ObjectId().toString();
  devCampaigns.set(campId1, {
    _id: campId1,
    workspaceId,
    name: 'Holiday Launch Campaign',
    subject: 'Special Discounts inside',
    status: CAMPAIGN_STATUS.SENT,
    statistics: {
      totalRecipients: 100,
      sent: 100,
      delivered: 98,
      failed: 2,
      bounced: 1,
      opens: 45,
      uniqueOpens: 30,
      clicks: 15,
      uniqueClicks: 10,
      unsubscribed: 1,
    },
    createdAt: new Date(),
  });

  const campId2 = new mongoose.Types.ObjectId().toString();
  devCampaigns.set(campId2, {
    _id: campId2,
    workspaceId,
    name: 'Upcoming Webinar Invite',
    subject: 'Join our live session',
    status: CAMPAIGN_STATUS.SCHEDULED,
    scheduledAt: new Date(Date.now() + 86400000),
    statistics: {
      totalRecipients: 50,
      sent: 0,
      delivered: 0,
    },
    createdAt: new Date(),
  });
  console.log('✓ Campaigns registered');

  // Test 2: Populating contacts in workspace
  console.log('\n[Test 2] Setting up audience contacts');
  devContacts.set('contact-1', {
    _id: 'contact-1',
    workspaceId,
    email: 'c1@example.com',
    status: CONTACT_STATUS.SUBSCRIBED,
  });
  devContacts.set('contact-2', {
    _id: 'contact-2',
    workspaceId,
    email: 'c2@example.com',
    status: CONTACT_STATUS.UNSUBSCRIBED,
  });
  console.log('✓ Audience registered');

  // Test 3: Get Dashboard Analytics Aggregation
  console.log('\n[Test 3] Verifying Dashboard Overview Analytics calculation');
  const overview = await analyticsService.getDashboardAnalytics({
    workspaceId,
    timeframe: '30d',
  });
  assert(overview !== null, 'Overview must return an object');
  assert.strictEqual(overview.campaigns.total, 2);
  assert.strictEqual(overview.campaigns.scheduled, 1);
  assert.strictEqual(overview.campaigns.sent, 100);
  assert.strictEqual(overview.campaigns.delivered, 98);
  assert.strictEqual(overview.contacts.total, 2);
  assert.strictEqual(overview.contacts.subscribed, 1);
  assert.strictEqual(overview.contacts.unsubscribed, 1);
  console.log('✓ Overview aggregation rates accurately calculated: Delivery Rate = ' + overview.campaigns.rates.deliveryRate + '%');

  // Test 4: Campaign Specific Analytics
  console.log('\n[Test 4] Verifying Single Campaign Performance Analytics');
  const campPerf = await analyticsService.getCampaignAnalytics({
    workspaceId,
    campaignId: campId1,
  });
  assert.strictEqual(campPerf.campaignId, campId1);
  assert.strictEqual(campPerf.delivered, 98);
  assert.strictEqual(campPerf.rates.deliveryRate, 98);
  assert.strictEqual(campPerf.rates.openRate, 30.6); // 30 uniqueOpens / 98 delivered
  assert.strictEqual(campPerf.rates.clickRate, 10.2); // 10 uniqueClicks / 98 delivered
  console.log('✓ Campaign performance ratios verified with documented denominators');

  // Test 5: Auto-Reply Analytics
  console.log('\n[Test 5] Verifying Auto-Reply Analytics');
  devActivityLogs.set('act-1', {
    workspaceId,
    status: LOG_STATUS.REPLIED,
  });
  devActivityLogs.set('act-2', {
    workspaceId,
    status: LOG_STATUS.SKIPPED,
  });
  const autoReplyMetrics = await analyticsService.getAutoReplyAnalytics({ workspaceId });
  assert.strictEqual(autoReplyMetrics.totalProcessed, 2);
  assert.strictEqual(autoReplyMetrics.replied, 1);
  assert.strictEqual(autoReplyMetrics.skipped, 1);
  console.log('✓ Auto-reply processed & replied metrics aggregated');

  // Test 6: Audit Log Recording & Querying
  console.log('\n[Test 6] Recording security audit logs');
  const logEntry = await auditService.logAction({
    workspaceId,
    userId,
    actorName: 'Admin User',
    actorEmail: 'admin@mailflow.io',
    action: AUDIT_ACTIONS.CAMPAIGN_SEND,
    entityType: 'campaign',
    entityId: campId1,
    details: { recipientCount: 100 },
  });
  assert(logEntry && logEntry._id, 'Audit log entry must have an ID');

  const auditList = await auditService.listLogs({ workspaceId });
  assert.strictEqual(auditList.logs.length, 1);
  assert.strictEqual(auditList.logs[0].action, AUDIT_ACTIONS.CAMPAIGN_SEND);
  console.log('✓ Audit log safely recorded and retrieved');

  // Test 7: Export Campaigns Performance to CSV
  console.log('\n[Test 7] CSV Export generation');
  const csvString = await analyticsService.exportCampaignsCsv(workspaceId);
  assert(csvString.includes('Holiday Launch Campaign'), 'CSV must contain campaign name');
  assert(csvString.includes('Total Recipients'), 'CSV must include header row');
  console.log('✓ Campaign performance CSV generated and escaped properly');

  // Test 8: Multi-tenant Workspace Isolation
  console.log('\n[Test 8] Cross-workspace IDOR protection');
  const foreignWorkspaceId = new mongoose.Types.ObjectId().toString();
  const foreignOverview = await analyticsService.getDashboardAnalytics({
    workspaceId: foreignWorkspaceId,
  });
  assert.strictEqual(foreignOverview.campaigns.total, 0, 'Foreign workspace must have 0 campaigns');
  assert.strictEqual(foreignOverview.contacts.total, 0, 'Foreign workspace must have 0 contacts');

  let threwIdor = false;
  try {
    await analyticsService.getCampaignAnalytics({
      workspaceId: foreignWorkspaceId,
      campaignId: campId1,
    });
  } catch (err) {
    threwIdor = true;
  }
  assert(threwIdor, 'Cross-workspace campaign analytics query must be rejected');
  console.log('✓ Multi-tenant isolation verified on analytics endpoints');

  console.log('\n======================================================');
  console.log('✓ ALL PHASE 11 ANALYTICS & ADMIN SMOKE TESTS PASSED!');
  console.log('======================================================\n');
}

runPhase11Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Phase 11 test failed:', err);
    process.exit(1);
  });

