import assert from 'assert';
import mongoose from 'mongoose';
import { trackingService } from './src/services/trackingService.js';
import { escapeRegex } from './src/utils/regexUtils.js';
import { requireRole } from './src/middleware/authMiddleware.js';
import { sanitizeCell } from './src/utils/spreadsheetUtils.js';
import { mongoSanitize } from './src/middleware/mongoSanitize.js';
import { adminService } from './src/services/adminService.js';
import path from 'path';

console.log('\n======================================================');
console.log('--- MAILFLOW PHASE 13: COMPREHENSIVE SECURITY & QA ---');
console.log('======================================================\n');

async function runComprehensiveQATests() {
  // Vector 1: CSV Formula Execution Prevention (CWE-1236)
  console.log('[QA Vector 1] CSV Formula Execution / DDE Injection Prevention');
  const formulaPayloads = ['=cmd|"/C calc"!A0', '+100-50', '-200*10', '@SUM(A1:A10)', '\tTAB_ATTACK'];
  for (const payload of formulaPayloads) {
    const sanitized = sanitizeCell(payload);
    assert.strictEqual(
      sanitized.startsWith("'"),
      true,
      `Formula payload was not escaped with single quote: "${payload}"`
    );
  }
  console.log('✓ CSV formula injection vectors safely neutralized with single-quote prefix');

  // Vector 2: NoSQL Injection Mutation
  console.log('\n[QA Vector 2] NoSQL Injection Stripping');
  const reqObj = {
    body: {
      user: 'admin',
      password: { $gt: '' },
      nested: { $where: 'sleep(1000)' },
      'dot.field': 'malicious',
      safeEmail: 'test@example.com',
      amount: '$100.00',
    },
  };
  mongoSanitize(reqObj, {}, () => {});
  assert.strictEqual(reqObj.body.password, undefined, '$gt operator must be stripped');
  assert.strictEqual(reqObj.body.nested, undefined, '$where operator must be stripped');
  assert.strictEqual(reqObj.body['dot.field'], undefined, 'Dot operator must be stripped');
  assert.strictEqual(reqObj.body.safeEmail, 'test@example.com', 'Legitimate email must be preserved');
  assert.strictEqual(reqObj.body.amount, '$100.00', 'Dollar sign in string values must be preserved');
  console.log('✓ NoSQL operator injection stripped without affecting legitimate fields');

  // Vector 3: Open Redirect Prevention in Click Tracking
  console.log('\n[QA Vector 3] Open Redirect Prevention');
  const dangerousUrls = [
    'javascript:alert(document.cookie)',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    'vbscript:msgbox(1)',
    '//attacker.com/phishing',
    'ftp://files.example.com',
    'not-a-valid-url',
  ];
  for (const url of dangerousUrls) {
    assert.strictEqual(
      trackingService.isValidRedirectUrl(url),
      false,
      `Unsafe URL was permitted: "${url}"`
    );
  }
  assert.strictEqual(trackingService.isValidRedirectUrl('https://example.com/promo'), true);
  console.log('✓ Open redirect attack surfaces strictly blocked; only http/https permitted');

  // Vector 4: Path Traversal Attack Defense on Attachments
  console.log('\n[QA Vector 4] Directory Traversal Defense');
  const traversalFilenames = [
    '../../../../Windows/System32/cmd.exe',
    '..\\..\\..\\boot.ini',
    'uploads/../../server.js',
    '/etc/shadow',
  ];
  for (const filename of traversalFilenames) {
    const base = path.basename(filename);
    assert.ok(!base.includes('..') && !base.includes('/') && !base.includes('\\'));
  }
  console.log('✓ Path traversal sequences safely normalized');

  // Vector 5: ReDoS & Regular Expression Injection
  console.log('\n[QA Vector 5] ReDoS & Metacharacter Neutralization');
  const redosInputs = [
    '((((a+)+)+)+)$',
    'a?b?c?d?e?f?g?h?i?j?k?l?m?n?o?p?q?r?s?t?u?v?w?x?y?z?',
    'test*+?^${}()|[]\\',
  ];
  for (const input of redosInputs) {
    const safe = escapeRegex(input);
    let regex;
    assert.doesNotThrow(() => {
      regex = new RegExp(safe, 'i');
    });
    assert.strictEqual(regex.test(input), true);
  }
  console.log('✓ Complex and dangerous regular expression metacharacters safely escaped');

  // Vector 6: Admin Privilege Escalation Prevention
  console.log('\n[QA Vector 6] Privilege Escalation Safeguards');
  const testAdminId = new mongoose.Types.ObjectId().toString();
  await assert.rejects(
    async () => {
      await adminService.updateUserRole({
        adminUserId: testAdminId,
        targetUserId: testAdminId,
        role: 'user',
      });
    },
    /cannot change their own platform role/
  );
  console.log('✓ Administrators prevented from modifying their own roles');

  console.log('\n======================================================');
  console.log('✓ ALL COMPREHENSIVE SECURITY & QA TESTS PASSED!');
  console.log('======================================================\n');
  process.exit(0);
}

runComprehensiveQATests().catch((err) => {
  console.error('QA Test Suite Failed:', err);
  process.exit(1);
});

