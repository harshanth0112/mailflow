import assert from 'assert';
import mongoose from 'mongoose';
import { notificationService, devNotifications } from './src/services/notificationService.js';
import { adminService } from './src/services/adminService.js';
import { requireRole } from './src/middleware/authMiddleware.js';

console.log('\n--- MAILFLOW PHASE 3: ADMIN CONSOLE & NOTIFICATIONS TESTS ---\n');

async function runPhase3Tests() {
  const workspace1Id = new mongoose.Types.ObjectId().toString();
  const workspace2Id = new mongoose.Types.ObjectId().toString();
  const user1Id = new mongoose.Types.ObjectId().toString();
  const user2Id = new mongoose.Types.ObjectId().toString();

  // [Test 1] Create and Retrieve Notifications
  console.log('[Test 1] Notification Creation and Listing');
  const notif1 = await notificationService.createNotification({
    workspaceId: workspace1Id,
    userId: user1Id,
    type: 'campaign_completed',
    title: 'Black Friday Campaign Sent',
    message: 'Delivered to 1,250 subscribers successfully.',
    link: '/campaigns/123',
  });

  assert.ok(notif1._id, 'Notification must have generated ID');
  assert.strictEqual(notif1.isRead, false, 'New notification must be unread');

  const unreadCount1 = await notificationService.getUnreadCount({
    workspaceId: workspace1Id,
    userId: user1Id,
  });
  assert.strictEqual(unreadCount1, 1, 'Unread count must be 1');
  console.log('✓ Notification created with correct unread count');

  // [Test 2] Mark Notification as Read & Mark All as Read
  console.log('\n[Test 2] Mark as Read & Mark All as Read');
  const readRes = await notificationService.markAsRead({
    workspaceId: workspace1Id,
    userId: user1Id,
    notificationId: notif1._id,
  });
  assert.strictEqual(readRes.isRead, true);

  const unreadCountAfter = await notificationService.getUnreadCount({
    workspaceId: workspace1Id,
    userId: user1Id,
  });
  assert.strictEqual(unreadCountAfter, 0, 'Unread count must now be 0');

  // Add 2 more notifications
  await notificationService.createNotification({
    workspaceId: workspace1Id,
    userId: user1Id,
    type: 'security_alert',
    title: 'New Login',
    message: 'Login from Chrome on Windows.',
  });
  await notificationService.createNotification({
    workspaceId: workspace1Id,
    userId: user1Id,
    type: 'system_alert',
    title: 'Maintenance',
    message: 'System upgrade complete.',
  });

  await notificationService.markAllAsRead({
    workspaceId: workspace1Id,
    userId: user1Id,
  });
  const unreadCountAfterAll = await notificationService.getUnreadCount({
    workspaceId: workspace1Id,
    userId: user1Id,
  });
  assert.strictEqual(unreadCountAfterAll, 0, 'All notifications must be marked read');
  console.log('✓ Notification read state transitions verified');

  // [Test 3] User and Workspace Isolation for Notifications
  console.log('\n[Test 3] Notification Multi-Tenant and User Isolation');
  const user2List = await notificationService.listNotifications({
    workspaceId: workspace1Id,
    userId: user2Id,
  });
  assert.strictEqual(user2List.notifications.length, 0, 'User 2 must not see User 1 notifications');

  const foreignWsList = await notificationService.listNotifications({
    workspaceId: workspace2Id,
    userId: user1Id,
  });
  assert.strictEqual(foreignWsList.notifications.length, 0, 'Must not access notifications from foreign workspace');
  console.log('✓ Notification boundary strictly enforced between users and workspaces');

  // [Test 4] Platform Admin Role Authorization
  console.log('\n[Test 4] Administrative Role Enforcement');
  const adminMiddleware = requireRole('admin');

  let regularUserBlocked = false;
  let regularUserStatus = null;
  const mockReqRegular = { user: { _id: user1Id, role: 'user' } };
  const mockResRegular = {
    status: (code) => {
      regularUserStatus = code;
      return {
        json: () => {
          regularUserBlocked = true;
        },
      };
    },
  };

  adminMiddleware(mockReqRegular, mockResRegular, () => {
    assert.fail('Regular user was incorrectly authorized for admin endpoint!');
  });
  assert.strictEqual(regularUserBlocked, true, 'Regular user must be blocked');
  assert.strictEqual(regularUserStatus, 403, 'Must return 403 Forbidden');

  let adminPassed = false;
  const mockReqAdmin = { user: { _id: user1Id, role: 'admin' } };
  adminMiddleware(mockReqAdmin, {}, () => {
    adminPassed = true;
  });
  assert.strictEqual(adminPassed, true, 'Admin user must be authorized');
  console.log('✓ requireRole("admin") correctly allows admins and rejects non-admin users');

  // [Test 5] Admin Self-Impairment Safeguards
  console.log('\n[Test 5] Admin Self-Protection Safeguards');
  await assert.rejects(
    async () => {
      await adminService.updateUserStatus({
        adminUserId: user1Id,
        targetUserId: user1Id, // Trying to suspend oneself
        status: 'suspended',
      });
    },
    /cannot suspend or change status of their own account/,
    'Admin was able to suspend their own account'
  );

  await assert.rejects(
    async () => {
      await adminService.updateUserRole({
        adminUserId: user1Id,
        targetUserId: user1Id, // Trying to demote oneself
        role: 'user',
      });
    },
    /cannot change their own platform role/,
    'Admin was able to change their own role'
  );
  console.log('✓ Self-suspension and self-demotion strictly blocked');

  // [Test 6] Admin System Telemetry & Queue Stats
  console.log('\n[Test 6] System Telemetry and BullMQ Inspection');
  const metrics = await adminService.getSystemMetrics();
  assert.ok(metrics.users, 'Metrics must include users');
  assert.ok(metrics.system?.nodeEnv, 'Metrics must include system runtime');

  const queues = await adminService.getQueueStats();
  assert.ok(queues.queues, 'Queue statistics must be retrieved');
  console.log('✓ Administrative system metrics and queue monitoring operational');

  console.log('\n======================================================');
  console.log('✓ ALL PHASE 3 ADMIN & NOTIFICATIONS TESTS PASSED!');
  console.log('======================================================\n');
  process.exit(0);
}

runPhase3Tests().catch((err) => {
  console.error('Phase 3 test failed:', err);
  process.exit(1);
});

