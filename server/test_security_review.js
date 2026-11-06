import assert from 'assert';
import http from 'http';
import mongoose from 'mongoose';
import { mongoSanitize } from './src/middleware/mongoSanitize.js';
import { requireWorkspace, devWorkspaces, devMemberships } from './src/middleware/workspaceMiddleware.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import { env } from './src/config/env.js';
import { INVITATION_STATUS } from './src/models/Membership.js';

console.log('\n--- MAILFLOW PRODUCTION READINESS: SECURITY REVIEW TEST SUITE ---\n');

const runSecurityReviewTests = async () => {
  // Test 1: Workspace Membership & x-workspace-id IDOR Protection
  console.log('[Test 1] Workspace Membership Enforcement & Header Spoofing Prevention');
  
  const user1Id = new mongoose.Types.ObjectId().toString();
  const user2Id = new mongoose.Types.ObjectId().toString();
  const workspace1Id = new mongoose.Types.ObjectId().toString();
  const workspace2Id = new mongoose.Types.ObjectId().toString();

  // Workspace 1 belongs to User 1
  devWorkspaces.set(workspace1Id, { _id: workspace1Id, name: 'User 1 Workspace', status: 'active' });
  devMemberships.set(`${workspace1Id}_${user1Id}`, {
    workspaceId: workspace1Id,
    userId: user1Id,
    role: 'super_admin',
    invitationStatus: INVITATION_STATUS.ACCEPTED,
  });

  // Workspace 2 belongs to User 2
  devWorkspaces.set(workspace2Id, { _id: workspace2Id, name: 'User 2 Workspace', status: 'active' });
  devMemberships.set(`${workspace2Id}_${user2Id}`, {
    workspaceId: workspace2Id,
    userId: user2Id,
    role: 'super_admin',
    invitationStatus: INVITATION_STATUS.ACCEPTED,
  });

  // Scenario 1: User 1 accesses Workspace 1 (Legitimate)
  let user1Passed = false;
  const mockReq1 = {
    user: { _id: user1Id },
    headers: { 'x-workspace-id': workspace1Id },
    params: {},
  };
  const mockRes1 = {
    status: (code) => ({ json: (data) => ({ statusCode: code, data }) }),
  };
  await requireWorkspace(mockReq1, mockRes1, () => {
    user1Passed = true;
  });
  assert.strictEqual(user1Passed, true, 'User 1 legitimate access was blocked');
  assert.strictEqual(mockReq1.workspace._id, workspace1Id, 'Workspace context mismatch');
  console.log('✓ Legitimate workspace member access authorized correctly');

  // Scenario 2: User 1 attempts IDOR bypass by setting x-workspace-id to Workspace 2 (Spoofing)
  let spoofBlocked = false;
  let spoofStatusCode = null;
  const mockReqSpoof = {
    user: { _id: user1Id },
    headers: { 'x-workspace-id': workspace2Id }, // Foreign workspace ID
    params: {},
  };
  const mockResSpoof = {
    status: (code) => {
      spoofStatusCode = code;
      return {
        json: (data) => {
          spoofBlocked = true;
          return { statusCode: code, data };
        },
      };
    },
  };
  await requireWorkspace(mockReqSpoof, mockResSpoof, () => {
    assert.fail('Security Vulnerability: User 1 bypassed workspace boundary via x-workspace-id!');
  });
  assert.strictEqual(spoofBlocked, true, 'Spoofed x-workspace-id was not blocked');
  assert.strictEqual(spoofStatusCode, 404, 'Spoofed x-workspace-id should return 404');
  console.log('✓ x-workspace-id header spoofing attempt strictly blocked (IDOR protected)');

  // Test 2: Custom NoSQL Sanitizer Verification
  console.log('\n[Test 2] NoSQL Sanitizer Mutation & Legitimate Content Preservation');
  
  const testPayload = {
    // Malicious NoSQL attack vectors (must be neutralized)
    injectionAttempt: { $gt: '' },
    nestedAttack: {
      $where: 'sleep(5000)',
      legitNum: 42,
    },
    'malicious.dot.operator': 'admin_escalation',
    
    // Legitimate email, marketing, and content fields (MUST NOT be altered)
    recipientEmail: 'john.doe+newsletter@mailflow.io',
    contactEmails: ['alice.smith@example.com', 'bob.jones+tag@domain.co.uk'],
    campaignSubject: 'Exclusive offer: Save $50 on your next subscription!',
    messageBody: 'Hello John,\nThe total invoice comes to $1,250.75 USD. Please visit https://mailflow.io/pay.\nRegards.',
    htmlContent: '<p>Click <a href="https://example.com/item.html?ref=mail">here</a> to buy for $19.99.</p>',
    metadata: {
      category: 'promotional.newsletter',
      rate: '$49/mo',
    },
  };

  const mockSanitizeReq = {
    body: JSON.parse(JSON.stringify(testPayload)),
    query: {
      'user.admin': 'true',
      filter: 'active',
    },
    params: {
      id: '64a1b2c3d4e5f6a7b8c9d001',
    },
  };

  mongoSanitize(mockSanitizeReq, {}, () => {});

  // Assert malicious keys stripped
  assert.strictEqual(mockSanitizeReq.body.injectionAttempt, undefined, 'NoSQL injection object not stripped');
  assert.strictEqual(mockSanitizeReq.body.nestedAttack.$where, undefined, 'Nested $where operator not stripped');
  assert.strictEqual(mockSanitizeReq.body['malicious.dot.operator'], undefined, 'Key with dot operator not stripped');
  assert.strictEqual(mockSanitizeReq.query['user.admin'], undefined, 'Query dot injection not stripped');

  // Assert legitimate content completely preserved without mutation
  assert.strictEqual(
    mockSanitizeReq.body.recipientEmail,
    'john.doe+newsletter@mailflow.io',
    'Email address was corrupted'
  );
  assert.deepStrictEqual(
    mockSanitizeReq.body.contactEmails,
    ['alice.smith@example.com', 'bob.jones+tag@domain.co.uk'],
    'Contact emails array corrupted'
  );
  assert.strictEqual(
    mockSanitizeReq.body.campaignSubject,
    'Exclusive offer: Save $50 on your next subscription!',
    'Subject line dollar sign or text corrupted'
  );
  assert.ok(
    mockSanitizeReq.body.messageBody.includes('$1,250.75') && mockSanitizeReq.body.messageBody.includes('https://mailflow.io/pay'),
    'Message body with dollar signs and URLs was mutated'
  );
  assert.strictEqual(
    mockSanitizeReq.body.htmlContent,
    '<p>Click <a href="https://example.com/item.html?ref=mail">here</a> to buy for $19.99.</p>',
    'HTML body was corrupted'
  );
  assert.strictEqual(mockSanitizeReq.body.metadata.rate, '$49/mo', 'Metadata rate corrupted');
  assert.strictEqual(mockSanitizeReq.body.nestedAttack.legitNum, 42, 'Legitimate nested field stripped');
  assert.strictEqual(mockSanitizeReq.query.filter, 'active', 'Clean query param stripped');
  console.log('✓ NoSQL attacks stripped while email addresses, dollar amounts ($), URLs, and HTML remain 100% intact');

  // Test 3: Production Error Handling Masking
  console.log('\n[Test 3] Production Error Handler Information Leakage Prevention');
  const internalError = new Error('Database connection failed: mongo://admin:SecretPass123@cluster0.db.net:27017');
  
  let prodErrorStatus = null;
  let prodErrorBody = null;
  const mockResProd = {
    status: (code) => {
      prodErrorStatus = code;
      return {
        json: (payload) => {
          prodErrorBody = payload;
        },
      };
    },
  };

  // Temporarily simulate production environment
  const originalEnv = env.NODE_ENV;
  env.NODE_ENV = 'production';

  errorHandler(internalError, { originalUrl: '/api/v1/campaigns', method: 'GET', ip: '127.0.0.1' }, mockResProd, () => {});

  // Restore env
  env.NODE_ENV = originalEnv;

  assert.strictEqual(prodErrorStatus, 500, 'Error status should be 500');
  assert.strictEqual(
    prodErrorBody.message,
    'An unexpected error occurred. Please contact support.',
    'Internal database message was leaked in production error!'
  );
  assert.strictEqual(prodErrorBody.stack, undefined, 'Stack trace leaked in production error!');
  console.log('✓ Internal connection strings and stack traces strictly masked in production errors');

  console.log('\n======================================================');
  console.log('✓ ALL SECURITY REVIEW TESTS PASSED CLEANLY');
  console.log('======================================================\n');
  process.exit(0);
};

runSecurityReviewTests().catch((err) => {
  console.error('Security review test failed:', err);
  process.exit(1);
});

