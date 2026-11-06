import { z } from 'zod';
import { WORKSPACE_ROLES } from '../config/roles.js';

export const updateWorkspaceSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).optional(),
  settings: z
    .object({
      defaultFromEmail: z.string().email('Invalid email address').or(z.literal('')).optional(),
      defaultFromName: z.string().max(100).optional(),
      timezone: z.string().max(50).optional(),
      dailySendLimit: z.number().int().min(1).max(50000).optional(),
      enableTracking: z.boolean().optional(),
    })
    .optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email('Valid email is required').toLowerCase().trim(),
  role: z
    .enum([
      WORKSPACE_ROLES.SUPER_ADMIN,
      WORKSPACE_ROLES.ADMIN,
      WORKSPACE_ROLES.CAMPAIGN_MANAGER,
      WORKSPACE_ROLES.USER,
    ])
    .default(WORKSPACE_ROLES.USER),
});

export const acceptInvitationParamsSchema = z.object({
  token: z.string().min(10, 'Invitation token is required'),
});

