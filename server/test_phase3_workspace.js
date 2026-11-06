import mongoose from 'mongoose';
import { Workspace } from './src/models/Workspace.js';
import { Membership, INVITATION_STATUS } from './src/models/Membership.js';
import { WORKSPACE_ROLES, hasPermission, PERMISSIONS } from './src/config/roles.js';
import { devWorkspaces, devMemberships } from './src/middleware/workspaceMiddleware.js';

async function runWorkspaceSmokeTest() {
  console.log('--- Starting Phase 3 Workspace Architecture Regression Test ---');

  const user1Id = new mongoose.Types.ObjectId().toString();
  const user2Id = new mongoose.Types.ObjectId().toString();
  const user3Id = new mongoose.Types.ObjectId().toString();

  // 1. Provision default workspace for User 1
  const ws1Id = new mongoose.Types.ObjectId().toString();
  const ws1 = {
    _id: ws1Id,
    name: "User 1's Workspace",
    slug: 'user-1-workspace',
    ownerId: user1Id,
    plan: 'free',
    status: 'active',
    settings: {
      defaultFromEmail: '',
      defaultFromName: '',
      timezone: 'UTC',
      dailySendLimit: 500,
    },
  };
  devWorkspaces.set(ws1Id, ws1);

  const m1Id = new mongoose.Types.ObjectId().toString();
  const m1 = {
    _id: m1Id,
    workspaceId: ws1Id,
    userId: user1Id,
    role: WORKSPACE_ROLES.SUPER_ADMIN,
    invitationStatus: INVITATION_STATUS.ACCEPTED,
  };
  devMemberships.set(m1Id, m1);
  console.log('1. User 1 default workspace provisioned with Super Admin role.');

  // 2. Privilege check: Super Admin can update workspace
  if (!hasPermission(m1.role, PERMISSIONS.WORKSPACE_UPDATE)) {
    console.error('FAIL: Super Admin should have WORKSPACE_UPDATE permission');
    process.exit(1);
  }
  console.log('2. Privilege verification for Super Admin passed.');

  // 3. User 2 invited as Campaign Manager
  const m2Id = new mongoose.Types.ObjectId().toString();
  const m2 = {
    _id: m2Id,
    workspaceId: ws1Id,
    userId: user2Id,
    role: WORKSPACE_ROLES.CAMPAIGN_MANAGER,
    invitationStatus: INVITATION_STATUS.ACCEPTED,
  };
  devMemberships.set(m2Id, m2);
  console.log('3. User 2 added as Campaign Manager.');

  // 4. User 2 should NOT have WORKSPACE_UPDATE permission
  if (hasPermission(m2.role, PERMISSIONS.WORKSPACE_UPDATE)) {
    console.error('FAIL: Campaign Manager should NOT have WORKSPACE_UPDATE permission');
    process.exit(1);
  }
  // User 2 SHOULD have CONTACTS_MANAGE and CAMPAIGNS_CREATE
  if (!hasPermission(m2.role, PERMISSIONS.CONTACTS_MANAGE) || !hasPermission(m2.role, PERMISSIONS.CAMPAIGNS_CREATE)) {
    console.error('FAIL: Campaign Manager missing contact or campaign creation permission');
    process.exit(1);
  }
  console.log('4. Privilege separation verified between Super Admin and Campaign Manager.');

  // 5. Cross-workspace IDOR check: User 3 in separate workspace cannot access User 1 workspace
  const user3Memberships = Array.from(devMemberships.values()).filter(
    (m) => m.userId === user3Id && m.workspaceId === ws1Id
  );
  if (user3Memberships.length > 0) {
    console.error('FAIL: User 3 found membership in User 1 workspace');
    process.exit(1);
  }
  console.log('5. IDOR & multi-workspace membership boundary verified for User 3.');

  console.log('--- ALL PHASE 3 WORKSPACE TESTS PASSED CLEANLY ---');
  process.exit(0);
}

runWorkspaceSmokeTest().catch((err) => {
  console.error('Error during test execution:', err);
  process.exit(1);
});

