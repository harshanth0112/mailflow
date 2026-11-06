import mongoose from 'mongoose';
import { Workspace } from '../models/Workspace.js';
import { Membership, INVITATION_STATUS } from '../models/Membership.js';
import { User } from '../models/User.js';
import { WORKSPACE_ROLES, PERMISSIONS } from '../config/roles.js';
import { generateRandomToken, hashToken } from '../utils/tokenUtils.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { devWorkspaces, devMemberships } from '../middleware/workspaceMiddleware.js';

const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * GET /api/v1/workspaces/current
 * Returns active workspace details and current user role
 */
export const getCurrentWorkspace = async (req, res, next) => {
  try {
    const workspace = req.workspace;
    const role = req.workspaceRole;

    return sendSuccess(res, 200, 'Current workspace retrieved', {
      workspace,
      currentUserRole: role,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/workspaces/current
 * Updates workspace settings or name
 */
export const updateCurrentWorkspace = async (req, res, next) => {
  try {
    const { name, settings } = req.body;
    const workspaceId = req.workspace._id.toString();

    let updatedWorkspace = null;

    if (isDbConnected()) {
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace) {
        return sendError(res, 404, 'Workspace not found');
      }

      if (name) workspace.name = name.trim();
      if (settings) {
        workspace.settings = {
          ...workspace.settings?.toObject(),
          ...settings,
        };
      }

      updatedWorkspace = await workspace.save();
    } else {
      const workspace = devWorkspaces.get(workspaceId);
      if (!workspace) {
        return sendError(res, 404, 'Workspace not found');
      }

      if (name) workspace.name = name.trim();
      if (settings) {
        workspace.settings = {
          ...workspace.settings,
          ...settings,
        };
      }
      workspace.updatedAt = new Date();
      updatedWorkspace = workspace;
    }

    return sendSuccess(res, 200, 'Workspace updated successfully', {
      workspace: updatedWorkspace,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/workspaces/current/members
 * Retrieves all members and pending invitations for the current workspace
 */
export const getWorkspaceMembers = async (req, res, next) => {
  try {
    const workspaceId = req.workspace._id;

    if (isDbConnected()) {
      const memberships = await Membership.find({
        workspaceId,
        invitationStatus: INVITATION_STATUS.ACCEPTED,
      })
        .populate('userId', 'name email role status createdAt')
        .sort({ role: 1, createdAt: 1 });

      const members = memberships.map((m) => ({
        id: m._id,
        role: m.role,
        joinedAt: m.joinedAt,
        user: m.userId
          ? {
              id: m.userId._id,
              name: m.userId.name,
              email: m.userId.email,
              status: m.userId.status,
            }
          : null,
      }));

      return sendSuccess(res, 200, 'Workspace members retrieved', {
        members,
        total: members.length,
      });
    } else {
      const members = Array.from(devMemberships.values())
        .filter(
          (m) =>
            m.workspaceId === workspaceId.toString() &&
            m.invitationStatus === INVITATION_STATUS.ACCEPTED
        )
        .map((m) => ({
          id: m._id,
          role: m.role,
          joinedAt: m.joinedAt,
          user: {
            id: m.userId,
            name: req.user.name,
            email: req.user.email,
            status: 'active',
          },
        }));

      return sendSuccess(res, 200, 'Workspace members retrieved', {
        members,
        total: members.length,
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/workspaces/current/invitations
 * Invites a user by email to join the current workspace
 */
export const createWorkspaceInvitation = async (req, res, next) => {
  try {
    const { email, role } = req.body;
    const normalizedEmail = email.toLowerCase().trim();
    const workspaceId = req.workspace._id;
    const inviterId = req.user._id;

    // Security check: Only Super Admin can invite Super Admin or Admin
    if (
      (role === WORKSPACE_ROLES.SUPER_ADMIN || role === WORKSPACE_ROLES.ADMIN) &&
      req.workspaceRole !== WORKSPACE_ROLES.SUPER_ADMIN
    ) {
      return sendError(
        res,
        403,
        'Only Super Admins can invite administrative roles.'
      );
    }

    const rawToken = generateRandomToken(32);
    const invitationTokenHash = hashToken(rawToken);
    const invitationExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    if (isDbConnected()) {
      // 1. Check if user already a member of this workspace
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) {
        const existingMembership = await Membership.findOne({
          workspaceId,
          userId: existingUser._id,
          invitationStatus: INVITATION_STATUS.ACCEPTED,
        });
        if (existingMembership) {
          return sendError(res, 409, 'User is already a member of this workspace');
        }
      }

      // 2. Check if pending invitation exists; if so, replace or renew it
      let pendingInvite = await Membership.findOne({
        workspaceId,
        invitedEmail: normalizedEmail,
        invitationStatus: INVITATION_STATUS.PENDING,
      });

      if (pendingInvite) {
        pendingInvite.role = role;
        pendingInvite.invitationTokenHash = invitationTokenHash;
        pendingInvite.invitationExpiresAt = invitationExpiresAt;
        pendingInvite.invitedBy = inviterId;
        await pendingInvite.save();
      } else {
        pendingInvite = await Membership.create({
          workspaceId,
          role,
          invitationStatus: INVITATION_STATUS.PENDING,
          invitedEmail: normalizedEmail,
          invitedBy: inviterId,
          invitationTokenHash,
          invitationExpiresAt,
        });
      }

      return sendSuccess(res, 201, 'Workspace invitation created successfully', {
        invitation: {
          id: pendingInvite._id,
          email: normalizedEmail,
          role,
          expiresAt: invitationExpiresAt,
        },
        // In local development, surface the raw invitation token for testing
        devInvitationToken: rawToken,
      });
    } else {
      const id = new mongoose.Types.ObjectId().toString();
      const invite = {
        _id: id,
        id,
        workspaceId: workspaceId.toString(),
        role,
        invitationStatus: INVITATION_STATUS.PENDING,
        invitedEmail: normalizedEmail,
        invitedBy: inviterId.toString(),
        invitationTokenHash,
        invitationExpiresAt,
        createdAt: new Date(),
      };
      devMemberships.set(id, invite);

      return sendSuccess(res, 201, 'Workspace invitation created successfully', {
        invitation: {
          id,
          email: normalizedEmail,
          role,
          expiresAt: invitationExpiresAt,
        },
        devInvitationToken: rawToken,
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/workspaces/current/invitations
 * Retrieves pending invitations for current workspace
 */
export const getWorkspaceInvitations = async (req, res, next) => {
  try {
    const workspaceId = req.workspace._id;

    if (isDbConnected()) {
      const invites = await Membership.find({
        workspaceId,
        invitationStatus: INVITATION_STATUS.PENDING,
      })
        .populate('invitedBy', 'name email')
        .sort({ createdAt: -1 });

      const formatted = invites.map((inv) => ({
        id: inv._id,
        email: inv.invitedEmail,
        role: inv.role,
        status: inv.invitationStatus,
        createdAt: inv.createdAt,
        invitedBy: inv.invitedBy
          ? {
              id: inv.invitedBy._id,
              name: inv.invitedBy.name,
              email: inv.invitedBy.email,
            }
          : null,
      }));

      return sendSuccess(res, 200, 'Pending invitations retrieved', {
        invitations: formatted,
        total: formatted.length,
      });
    } else {
      const invites = Array.from(devMemberships.values())
        .filter(
          (m) =>
            m.workspaceId === workspaceId.toString() &&
            m.invitationStatus === INVITATION_STATUS.PENDING
        )
        .map((inv) => ({
          id: inv._id,
          email: inv.invitedEmail,
          role: inv.role,
          status: inv.invitationStatus,
          createdAt: inv.createdAt,
          invitedBy: {
            id: req.user._id,
            name: req.user.name,
            email: req.user.email,
          },
        }));

      return sendSuccess(res, 200, 'Pending invitations retrieved', {
        invitations: invites,
        total: invites.length,
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/workspaces/invitations/:token/accept
 * Accepts a workspace invitation and joins the workspace
 */
export const acceptWorkspaceInvitation = async (req, res, next) => {
  try {
    const { token } = req.params;
    const tokenHash = hashToken(token);
    const userId = req.user._id;
    const userEmail = req.user.email.toLowerCase().trim();

    if (isDbConnected()) {
      const invitation = await Membership.findOne({
        invitationTokenHash: tokenHash,
        invitationStatus: INVITATION_STATUS.PENDING,
        invitationExpiresAt: { $gt: new Date() },
      }).select('+invitationTokenHash +invitationExpiresAt');

      if (!invitation) {
        return sendError(
          res,
          400,
          'Invitation link is invalid, expired, or has already been accepted.'
        );
      }

      // Security check: Match invited email if specified
      if (
        invitation.invitedEmail &&
        invitation.invitedEmail.toLowerCase() !== userEmail
      ) {
        return sendError(
          res,
          403,
          `This invitation was sent to ${invitation.invitedEmail}. Please log in with the corresponding account.`
        );
      }

      // Update membership to accepted
      invitation.userId = userId;
      invitation.invitationStatus = INVITATION_STATUS.ACCEPTED;
      invitation.joinedAt = new Date();
      invitation.invitationTokenHash = undefined;
      invitation.invitationExpiresAt = undefined;

      await invitation.save();

      const workspace = await Workspace.findById(invitation.workspaceId);

      return sendSuccess(res, 200, 'Successfully joined the workspace!', {
        workspace,
        role: invitation.role,
      });
    } else {
      let invitation = null;
      for (const m of devMemberships.values()) {
        if (
          m.invitationTokenHash === tokenHash &&
          m.invitationStatus === INVITATION_STATUS.PENDING &&
          m.invitationExpiresAt > new Date()
        ) {
          invitation = m;
          break;
        }
      }

      if (!invitation) {
        return sendError(
          res,
          400,
          'Invitation link is invalid, expired, or has already been accepted.'
        );
      }

      invitation.userId = userId.toString();
      invitation.invitationStatus = INVITATION_STATUS.ACCEPTED;
      invitation.joinedAt = new Date();
      invitation.invitationTokenHash = undefined;

      const workspace = devWorkspaces.get(invitation.workspaceId);

      return sendSuccess(res, 200, 'Successfully joined the workspace!', {
        workspace,
        role: invitation.role,
      });
    }
  } catch (error) {
    next(error);
  }
};

