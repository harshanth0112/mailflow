import mongoose from 'mongoose';
import { contactService } from './src/services/contactService.js';
import { CONSENT_STATUS, CONTACT_STATUS } from './src/models/Contact.js';
import * as XLSX from 'xlsx';

async function runSmokeTest() {
  console.log('--- Starting Phase 6 Contact Management Smoke Test ---');

  const workspaceId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();
  const otherWorkspaceId = new mongoose.Types.ObjectId().toString();

  // 1. Create a contact group
  console.log('1. Creating contact group...');
  const group = await contactService.createGroup({
    workspaceId,
    userId,
    data: { name: 'VIP Subscribers', description: 'Priority leads' },
  });
  console.log('Group created:', group.name, group._id);

  // 2. Duplicate group rejection check
  try {
    await contactService.createGroup({
      workspaceId,
      userId,
      data: { name: 'VIP Subscribers' },
    });
    console.error('FAIL: Duplicate group name was not blocked');
    process.exit(1);
  } catch (err) {
    console.log('SUCCESS: Duplicate group name blocked correctly');
  }

  // 3. Create a contact
  console.log('2. Creating a contact...');
  const contact = await contactService.createContact({
    workspaceId,
    userId,
    data: {
      email: 'John.Doe@Example.COM', // test normalization
      firstName: 'John',
      lastName: 'Doe',
      company: 'Acme Corp',
      status: CONTACT_STATUS.SUBSCRIBED,
      consentStatus: CONSENT_STATUS.OPTED_IN,
      tags: ['vip', 'enterprise'],
      groups: [group._id],
    },
  });
  console.log('Contact created with normalized email:', contact.email);
  if (contact.email !== 'john.doe@example.com') {
    console.error('FAIL: Email not lowercased/normalized');
    process.exit(1);
  }

  // 4. Duplicate contact within workspace check
  console.log('3. Checking duplicate contact rejection in same workspace...');
  try {
    await contactService.createContact({
      workspaceId,
      userId,
      data: {
        email: 'john.doe@example.com',
        firstName: 'Johnny',
      },
    });
    console.error('FAIL: Duplicate contact allowed in same workspace');
    process.exit(1);
  } catch (err) {
    console.log('SUCCESS: Duplicate contact rejected:', err.message);
  }

  // 5. Allowed contact with same email in DIFFERENT workspace (Workspace isolation)
  console.log('4. Verifying workspace isolation (same email in different workspace)...');
  const contactOtherWs = await contactService.createContact({
    workspaceId: otherWorkspaceId,
    userId,
    data: {
      email: 'john.doe@example.com',
      firstName: 'John Workspace 2',
    },
  });
  console.log('SUCCESS: Contact safely created in second workspace:', contactOtherWs.workspaceId);

  // 6. List contacts with search and filter
  console.log('5. Testing list, search, and count...');
  const listRes = await contactService.listContacts({
    workspaceId,
    query: { search: 'Acme', page: 1, limit: 10 },
  });
  console.log(`Listed ${listRes.contacts.length} contact(s) matching search 'Acme'`);
  if (listRes.contacts.length !== 1) {
    console.error('FAIL: Search filter did not find expected contact');
    process.exit(1);
  }

  const count = await contactService.getContactCount(workspaceId);
  console.log(`Workspace total contacts: ${count}`);
  if (count !== 1) {
    console.error('FAIL: Contact count incorrect');
    process.exit(1);
  }

  // 7. Unsubscribe and suppression test
  console.log('6. Testing unsubscribe & suppression...');
  const unsubscribed = await contactService.unsubscribeContact({
    workspaceId,
    contactId: contact._id,
  });
  console.log('Contact status after unsubscribe:', unsubscribed.status, 'Consent:', unsubscribed.consentStatus);
  if (unsubscribed.status !== CONTACT_STATUS.UNSUBSCRIBED || unsubscribed.consentStatus !== CONSENT_STATUS.OPTED_OUT) {
    console.error('FAIL: Unsubscribe did not update status and consent');
    process.exit(1);
  }

  // 8. Excel & CSV Export test
  console.log('7. Testing contact export to CSV and XLSX...');
  const csvExport = await contactService.exportContacts({ workspaceId, format: 'csv' });
  console.log('CSV buffer generated. Length:', csvExport.buffer.length, 'Filename:', csvExport.filename);
  if (!csvExport.buffer || csvExport.buffer.length === 0) {
    console.error('FAIL: CSV export empty');
    process.exit(1);
  }

  const xlsxExport = await contactService.exportContacts({ workspaceId, format: 'xlsx' });
  console.log('XLSX buffer generated. Length:', xlsxExport.buffer.length, 'Filename:', xlsxExport.filename);
  if (!xlsxExport.buffer || xlsxExport.buffer.length === 0) {
    console.error('FAIL: XLSX export empty');
    process.exit(1);
  }

  // 9. Spreadsheet parsing & preview test
  console.log('8. Testing CSV/Excel import parser & preview...');
  const sampleWorkbook = XLSX.utils.book_new();
  const sampleData = [
    { 'Email Address': 'alice@wonderland.org', 'First Name': 'Alice', 'Company': 'Wonderland Ltd', 'Tag List': 'vip, novel' },
    { 'Email Address': 'bob@builder.com', 'First Name': 'Bob', 'Company': 'Builder Co', 'Tag List': 'construction' },
    { 'Email Address': 'invalid-email-address', 'First Name': 'Bad', 'Company': 'Fail' },
  ];
  const sampleSheet = XLSX.utils.json_to_sheet(sampleData);
  XLSX.utils.book_append_sheet(sampleWorkbook, sampleSheet, 'ImportTest');
  const sampleBuffer = XLSX.write(sampleWorkbook, { bookType: 'xlsx', type: 'buffer' });

  const preview = await contactService.previewImport({
    buffer: sampleBuffer,
    originalName: 'test_contacts.xlsx',
  });
  console.log('Import Preview Headers:', preview.headers);
  console.log('Suggested Mapping:', preview.suggestedMapping);
  if (!preview.headers.includes('Email Address')) {
    console.error('FAIL: Preview headers missing');
    process.exit(1);
  }

  // 10. Execute import
  console.log('9. Executing spreadsheet import...');
  const importSummary = await contactService.executeImport({
    workspaceId,
    userId,
    buffer: sampleBuffer,
    originalName: 'test_contacts.xlsx',
    mapping: {
      'Email Address': 'email',
      'First Name': 'firstName',
      'Company': 'company',
      'Tag List': 'tags',
    },
    defaultTags: ['imported-lead'],
  });
  console.log('Import Summary Result:', importSummary);
  if (importSummary.invalid !== 1) {
    console.error('FAIL: Invalid email was not detected in import');
    process.exit(1);
  }

  console.log('--- ALL PHASE 6 SMOKE TESTS PASSED CLEANLY ---');
  process.exit(0);
}

runSmokeTest().catch((err) => {
  console.error('Error during test execution:', err);
  process.exit(1);
});

