import mongoose from 'mongoose';
import { campaignService } from './src/services/campaignService.js';
import { CAMPAIGN_STATUS, RECIPIENT_SELECTION_TYPE } from './src/models/Campaign.js';
import { personalizeContent } from './src/utils/templatePersonalizer.js';
import { contactService, devContacts } from './src/services/contactService.js';
import { CONSENT_STATUS, CONTACT_STATUS } from './src/models/Contact.js';
import { devEmailAccounts } from './src/services/emailAccountService.js';
import { encryptToken } from './src/utils/cryptoUtils.js';
import { templateService, devEmailTemplates } from './src/services/templateService.js';

async function runCampaignSmokeTest() {
  console.log('--- Starting Phase 8 Campaign Management System Smoke Test ---');

  const workspaceId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();
  const otherWorkspaceId = new mongoose.Types.ObjectId().toString();

  // 1. Setup contacts with different consent & subscription statuses
  console.log('1. Setting up contacts with strict consent states...');
  // Contact 1: Fully opted-in and eligible
  const c1 = await contactService.createContact({
    workspaceId,
    userId,
    data: {
      email: 'eligible1@example.com',
      firstName: 'Alice',
      lastName: 'Smith',
      company: 'AliceCorp',
      status: CONTACT_STATUS.SUBSCRIBED,
      consentStatus: CONSENT_STATUS.OPTED_IN,
      tags: ['vip'],
    },
  });

  // Contact 2: Imported but unconfirmed consent (MUST BE EXCLUDED)
  const c2 = await contactService.createContact({
    workspaceId,
    userId,
    data: {
      email: 'unconfirmed@example.com',
      firstName: 'Bob',
      status: CONTACT_STATUS.SUBSCRIBED,
      consentStatus: CONSENT_STATUS.IMPORTED_UNCONFIRMED,
      tags: ['vip'],
    },
  });

  // Contact 3: Unsubscribed (MUST BE EXCLUDED)
  const c3 = await contactService.createContact({
    workspaceId,
    userId,
    data: {
      email: 'unsubscribed@example.com',
      firstName: 'Charlie',
      status: CONTACT_STATUS.UNSUBSCRIBED,
      consentStatus: CONSENT_STATUS.OPTED_OUT,
    },
  });

  // 2. Setup connected sender email account
  console.log('2. Setting up sender email account in workspace...');
  const senderAccountId = new mongoose.Types.ObjectId().toString();
  devEmailAccounts.set(senderAccountId, {
    _id: senderAccountId,
    workspaceId,
    userId,
    provider: 'gmail',
    emailAddress: 'newsletter@mycompany.org',
    displayName: 'MyCompany Newsletter',
    encryptedAccessToken: encryptToken('fake-token'),
    encryptedRefreshToken: encryptToken('fake-refresh'),
    connectionStatus: 'connected',
    metadata: { dailyQuota: 500, sentToday: 0 },
  });

  // 3. Verify Recipient Eligibility Resolution
  console.log('3. Testing recipient eligibility filter (only opted_in & subscribed)...');
  const eligibleRecipients = await campaignService.resolveEligibleRecipients(workspaceId, {
    type: RECIPIENT_SELECTION_TYPE.ALL_ELIGIBLE,
  });
  console.log('Eligible recipients found:', eligibleRecipients.length);
  if (eligibleRecipients.length !== 1 || eligibleRecipients[0].email !== 'eligible1@example.com') {
    console.error('FAIL: Recipient eligibility filter did not correctly exclude unconfirmed or unsubscribed contacts');
    process.exit(1);
  }
  console.log('SUCCESS: Ineligible contacts successfully excluded.');

  // 4. Test Template Personalization & XSS Escaping
  console.log('4. Testing personalization & HTML escaping...');
  const dirtyContact = {
    firstName: '<script>alert("pwned")</script>Sarah',
    company: 'Acme & Co',
  };
  const rawHtml = '<p>Hello {{firstName}}, welcome to {{company}}!</p>';
  const sanitized = personalizeContent({ content: rawHtml, contact: dirtyContact, isHtml: true });
  console.log('Personalized HTML output:', sanitized);
  if (sanitized.includes('<script>') || !sanitized.includes('&lt;script&gt;')) {
    console.error('FAIL: Untrusted contact data was not escaped in HTML personalization');
    process.exit(1);
  }
  console.log('SUCCESS: HTML XSS injection prevented.');

  // 5. Create Campaign (Draft)
  console.log('5. Creating campaign draft...');
  const campaign = await campaignService.createCampaign({
    workspaceId,
    userId,
    data: {
      name: 'November Product Announcements',
      subject: 'Special offer for {{firstName}} at {{company}}',
      previewText: 'Exclusive November preview',
      senderEmailAccountId: senderAccountId,
      senderName: 'Announcements Team',
      replyTo: 'support@mycompany.org',
      htmlContent: '<p>Hello {{firstName}}, here is your offer.</p>',
      textContent: 'Hello {{firstName}}, here is your offer.',
      recipientConfiguration: {
        type: RECIPIENT_SELECTION_TYPE.ALL_ELIGIBLE,
      },
    },
  });
  console.log('Campaign created:', campaign.name, 'Status:', campaign.status, 'Recipients estimated:', campaign.statistics.totalRecipients);
  if (campaign.status !== CAMPAIGN_STATUS.DRAFT || campaign.statistics.totalRecipients !== 1) {
    console.error('FAIL: Campaign initial status or estimated count incorrect');
    process.exit(1);
  }

  // 6. Update draft campaign
  console.log('6. Updating campaign draft...');
  const updated = await campaignService.updateCampaign({
    workspaceId,
    campaignId: campaign._id,
    data: {
      subject: 'Updated November Announcements',
    },
  });
  if (updated.subject !== 'Updated November Announcements') {
    console.error('FAIL: Campaign update failed');
    process.exit(1);
  }

  // 7. Duplicate campaign
  console.log('7. Duplicating campaign...');
  const copy = await campaignService.duplicateCampaign({
    workspaceId,
    userId,
    campaignId: campaign._id,
  });
  console.log('Duplicated campaign:', copy.name, copy._id);
  if (!copy.name.includes('(Copy)')) {
    console.error('FAIL: Duplicated campaign name incorrect');
    process.exit(1);
  }

  // 8. Workspace Isolation Check (Cannot access campaign from another workspace)
  console.log('8. Verifying multi-workspace IDOR protection...');
  const foreignAttempt = await campaignService.getCampaignById({
    workspaceId: otherWorkspaceId,
    campaignId: campaign._id,
  });
  if (foreignAttempt !== null) {
    console.error('FAIL: Cross-workspace campaign access was not blocked (IDOR vulnerability)');
    process.exit(1);
  }
  console.log('SUCCESS: Cross-workspace access blocked.');

  // 9. Trigger Campaign Send & Idempotency Check
  console.log('9. Triggering campaign send and verifying recipient records initialization...');
  const sendRes = await campaignService.triggerCampaignSend({
    workspaceId,
    campaignId: campaign._id,
    idempotencyKey: 'idemp-token-12345',
  });
  console.log('Send trigger response:', sendRes);
  if (sendRes.status !== CAMPAIGN_STATUS.QUEUED || sendRes.recipientCount !== 1) {
    console.error('FAIL: Campaign status did not transition to QUEUED or recipient count mismatch');
    process.exit(1);
  }

  // 10. Duplicate send protection test
  console.log('10. Testing duplicate send prevention / idempotency constraint...');
  try {
    await campaignService.triggerCampaignSend({
      workspaceId,
      campaignId: campaign._id,
      idempotencyKey: 'idemp-token-12345',
    });
    console.error('FAIL: Duplicate campaign send was not blocked');
    process.exit(1);
  } catch (dupErr) {
    console.log('SUCCESS: Duplicate send rejected:', dupErr.message);
  }

  // 11. Recipient Delivery Records Listing
  console.log('11. Querying initialized recipient delivery records...');
  const recipientsAudit = await campaignService.getCampaignRecipients({
    workspaceId,
    campaignId: campaign._id,
    page: 1,
    limit: 10,
  });
  console.log(`Retrieved ${recipientsAudit.recipients.length} recipient audit record(s)`);
  if (recipientsAudit.recipients.length !== 1 || recipientsAudit.recipients[0].email !== 'eligible1@example.com') {
    console.error('FAIL: Campaign recipient record missing or incorrect email');
    process.exit(1);
  }
  if (recipientsAudit.recipients[0].recipientStatus !== 'pending') {
    console.error('FAIL: Recipient status should be pending before queue worker dispatch');
    process.exit(1);
  }

  console.log('12. Testing reusable email template CRUD and workspace isolation...');
  const savedTemplate = await templateService.create({
    workspaceId,
    userId,
    data: {
      name: 'Welcome Note',
      description: 'First-touch campaign and auto-reply content',
      subject: 'Welcome {{firstName}}',
      htmlContent: '<p>Hello {{firstName}}</p>',
      textContent: 'Hello {{firstName}}',
    },
  });
  const listedTemplates = await templateService.list({
    workspaceId,
    query: { page: 1, limit: 20, search: '' },
  });
  if (listedTemplates.templates.length !== 1 || listedTemplates.templates[0]._id !== savedTemplate._id) {
    console.error('FAIL: Workspace template listing returned unexpected results');
    process.exit(1);
  }
  const foreignTemplates = await templateService.list({
    workspaceId: otherWorkspaceId,
    query: { page: 1, limit: 20, search: '' },
  });
  if (foreignTemplates.templates.length !== 0) {
    console.error('FAIL: Template was visible outside its workspace');
    process.exit(1);
  }
  const updatedTemplate = await templateService.update({
    workspaceId,
    templateId: savedTemplate._id,
    data: { subject: 'Updated {{firstName}}' },
  });
  if (updatedTemplate.subject !== 'Updated {{firstName}}') {
    console.error('FAIL: Template update failed');
    process.exit(1);
  }
  let blockedForeignUpdate = false;
  try {
    await templateService.update({
      workspaceId: otherWorkspaceId,
      templateId: savedTemplate._id,
      data: { name: 'Cross-workspace' },
    });
  } catch {
    blockedForeignUpdate = true;
  }
  if (!blockedForeignUpdate) {
    console.error('FAIL: Cross-workspace template update was not blocked');
    process.exit(1);
  }
  await templateService.delete({ workspaceId, templateId: savedTemplate._id });
  if (devEmailTemplates.has(savedTemplate._id)) {
    console.error('FAIL: Template delete failed');
    process.exit(1);
  }
  console.log('SUCCESS: Template CRUD and workspace isolation verified.');

  console.log('--- ALL PHASE 8 CAMPAIGN MANAGEMENT TESTS PASSED CLEANLY ---');
  process.exit(0);
}

runCampaignSmokeTest().catch((err) => {
  console.error('Error during test execution:', err);
  process.exit(1);
});
