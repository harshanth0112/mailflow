import mongoose from 'mongoose';
import { Workspace } from '../models/Workspace.js';
import { Membership, INVITATION_STATUS } from '../models/Membership.js';
import { WORKSPACE_ROLES } from '../config/roles.js';
import { devWorkspaces, devMemberships } from '../middleware/workspaceMiddleware.js';

/**
 * Generate a URL-friendly, unique slug based on workspace name
 */
export const generateWorkspaceSlug = async (name) => {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'workspace';

  let slug = base;
  let counter = 1;

  if (mongoose.connection.readyState === 1) {
    while (await Workspace.findOne({ slug })) {
      slug = `${base}-${counter++}`;
    }
  } else {
    while (Array.from(devWorkspaces.values()).some((w) => w.slug === slug)) {
      slug = `${base}-${counter++}`;
    }
  }

  return slug;
};

/**
 * Creates default workspace and owner membership for a newly registered or verified user.
 * Safe to call idempotently (recovers gracefully if workspace already exists).
 */
export const createDefaultWorkspaceForUser = async (user, session = null) => {
  const userId = user._id ? user._id.toString() : user.id;

  if (mongoose.connection.readyState === 1) {
    // 1. Idempotency check: Does user already own a workspace?
    const existing = await Workspace.findOne({ ownerId: user._id }).session(session);
    if (existing) {
      // Ensure owner membership exists
      const existingMembership = await Membership.findOne({
        workspaceId: existing._id,
        userId: user._id,
      }).session(session);

      if (!existingMembership) {
        await Membership.create(
          [
            {
              workspaceId: existing._id,
              userId: user._id,
              role: WORKSPACE_ROLES.SUPER_ADMIN,
              invitationStatus: INVITATION_STATUS.ACCEPTED,
              joinedAt: new Date(),
            },
          ],
          { session }
        );
      }
      return existing;
    }

    // 2. Create workspace
    const workspaceName = `${user.name.trim()}'s Workspace`;
    const slug = await generateWorkspaceSlug(workspaceName);

    const [newWorkspace] = await Workspace.create(
      [
        {
          name: workspaceName,
          slug,
          ownerId: user._id,
          plan: 'free',
          status: 'active',
          settings: {
            defaultFromEmail: user.email,
            defaultFromName: user.name,
            timezone: 'UTC',
            dailySendLimit: 500,
            enableTracking: true,
          },
        },
      ],
      { session }
    );

    // 3. Create Super Admin owner membership
    await Membership.create(
      [
        {
          workspaceId: newWorkspace._id,
          userId: user._id,
          role: WORKSPACE_ROLES.SUPER_ADMIN,
          invitationStatus: INVITATION_STATUS.ACCEPTED,
          joinedAt: new Date(),
        },
      ],
      { session }
    );

    return newWorkspace;
  } else {
    // In-memory fallback
    const existing = Array.from(devWorkspaces.values()).find(
      (w) => w.ownerId === userId
    );
    if (existing) return existing;

    const workspaceId = new mongoose.Types.ObjectId().toString();
    const workspaceName = `${user.name.trim()}'s Workspace`;
    const slug = await generateWorkspaceSlug(workspaceName);

    const newWorkspace = {
      _id: workspaceId,
      id: workspaceId,
      name: workspaceName,
      slug,
      ownerId: userId,
      plan: 'free',
      status: 'active',
      settings: {
        defaultFromEmail: user.email,
        defaultFromName: user.name,
        timezone: 'UTC',
        dailySendLimit: 500,
        enableTracking: true,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    devWorkspaces.set(workspaceId, newWorkspace);

    const membershipId = new mongoose.Types.ObjectId().toString();
    devMemberships.set(membershipId, {
      _id: membershipId,
      id: membershipId,
      workspaceId,
      userId,
      role: WORKSPACE_ROLES.SUPER_ADMIN,
      invitationStatus: INVITATION_STATUS.ACCEPTED,
      joinedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return newWorkspace;
  }
};

