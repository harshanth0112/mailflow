import mongoose from 'mongoose';
import { Workspace } from '../models/Workspace.js';
import { Membership, INVITATION_STATUS } from '../models/Membership.js';
import { WORKSPACE_ROLES, hasPermission } from '../config/roles.js';
import { sendError } from '../utils/apiResponse.js';

// In-memory fallback map for dev mode when DB connection is offline
export const devWorkspaces = new Map();
export const devMemberships = new Map();

/**
 * Middleware that resolves and verifies active workspace context for the authenticated user.
 * Looks for Workspace context in:
 * 1. x-workspace-id header
 * 2. req.params.workspaceId
 * 3. Default workspace (first workspace where user has active membership, typically owner)
 */
export const requireWorkspace = async (req, res, next) => {
  try {
    if (!req.user || !req.user._id) {
      return sendError(res, 401, 'Authentication required to access workspace');
    }

    const userId = req.user._id.toString();
    const explicitWorkspaceId = req.headers['x-workspace-id'] || req.params.workspaceId;

    let membership = null;
    let workspace = null;

    if (mongoose.connection.readyState === 1) {
      if (explicitWorkspaceId && mongoose.Types.ObjectId.isValid(explicitWorkspaceId)) {
        membership = await Membership.findOne({
          workspaceId: explicitWorkspaceId,
          userId: req.user._id,
          invitationStatus: INVITATION_STATUS.ACCEPTED,
        }).populate('workspaceId');

        if (membership && membership.workspaceId) {
          workspace = membership.workspaceId;
        }
      } else {
        // Resolve default active workspace for this user
        membership = await Membership.findOne({
          userId: req.user._id,
          invitationStatus: INVITATION_STATUS.ACCEPTED,
        })
          .sort({ role: 1, createdAt: 1 })
          .populate('workspaceId');

        if (membership && membership.workspaceId) {
          workspace = membership.workspaceId;
        }
      }
    } else {
      // In-memory fallback for offline dev mode
      const userMemberships = Array.from(devMemberships.values()).filter(
        (m) =>
          m.userId === userId &&
          m.invitationStatus === INVITATION_STATUS.ACCEPTED
      );

      if (explicitWorkspaceId) {
        membership = userMemberships.find((m) => m.workspaceId === explicitWorkspaceId);
      } else {
        membership = userMemberships[0];
      }

      if (membership) {
        workspace = devWorkspaces.get(membership.workspaceId);
      }
    }

    if (!membership || !workspace) {
      return sendError(
        res,
        404,
        'Workspace not found or you do not have permission to access it'
      );
    }

    if (workspace.status !== 'active') {
      return sendError(res, 403, `Workspace is currently ${workspace.status}`);
    }

    // Attach validated, tamper-proof workspace context to the request
    req.workspace = workspace;
    req.membership = membership;
    req.workspaceRole = membership.role;

    next();
  } catch (error) {
    return sendError(res, 500, 'Error verifying workspace access', error.message);
  }
};

/**
 * Middleware ensuring current user's workspace role has the necessary permission
 * @param {string} permission 
 */
export const requireWorkspacePermission = (permission) => {
  return (req, res, next) => {
    if (!req.workspaceRole) {
      return sendError(res, 403, 'Workspace role not determined');
    }

    if (!hasPermission(req.workspaceRole, permission)) {
      return sendError(
        res,
        403,
        `Permission denied: '${permission}' requires elevated workspace role privileges`
      );
    }

    next();
  };
};

/**
 * Middleware requiring specific workspace roles
 * @param  {...string} allowedRoles 
 */
export const requireWorkspaceRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.workspaceRole || !allowedRoles.includes(req.workspaceRole)) {
      return sendError(res, 403, 'Access denied: insufficient workspace role');
    }
    next();
  };
};

