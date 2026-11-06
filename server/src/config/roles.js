export const WORKSPACE_ROLES = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  CAMPAIGN_MANAGER: 'Campaign Manager',
  USER: 'User',
};

export const PERMISSIONS = {
  // Workspace management
  WORKSPACE_UPDATE: 'workspace:update',
  WORKSPACE_DELETE: 'workspace:delete',
  
  // Member management
  MEMBERS_READ: 'members:read',
  MEMBERS_INVITE: 'members:invite',
  MEMBERS_UPDATE_ROLE: 'members:update_role',
  MEMBERS_REMOVE: 'members:remove',

  // Campaigns & Contacts
  CAMPAIGNS_CREATE: 'campaigns:create',
  CAMPAIGNS_READ: 'campaigns:read',
  CAMPAIGNS_UPDATE: 'campaigns:update',
  CAMPAIGNS_DELETE: 'campaigns:delete',
  CAMPAIGNS_SEND: 'campaigns:send',

  CONTACTS_MANAGE: 'contacts:manage',
  CONTACTS_READ: 'contacts:read',

  // Settings & Integrations
  SETTINGS_MANAGE: 'settings:manage',
  INTEGRATIONS_MANAGE: 'integrations:manage',
};

const ROLE_PERMISSIONS = {
  [WORKSPACE_ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),
  [WORKSPACE_ROLES.ADMIN]: [
    PERMISSIONS.WORKSPACE_UPDATE,
    PERMISSIONS.MEMBERS_READ,
    PERMISSIONS.MEMBERS_INVITE,
    PERMISSIONS.MEMBERS_UPDATE_ROLE,
    PERMISSIONS.MEMBERS_REMOVE,
    PERMISSIONS.CAMPAIGNS_CREATE,
    PERMISSIONS.CAMPAIGNS_READ,
    PERMISSIONS.CAMPAIGNS_UPDATE,
    PERMISSIONS.CAMPAIGNS_DELETE,
    PERMISSIONS.CAMPAIGNS_SEND,
    PERMISSIONS.CONTACTS_MANAGE,
    PERMISSIONS.CONTACTS_READ,
    PERMISSIONS.SETTINGS_MANAGE,
    PERMISSIONS.INTEGRATIONS_MANAGE,
  ],
  [WORKSPACE_ROLES.CAMPAIGN_MANAGER]: [
    PERMISSIONS.MEMBERS_READ,
    PERMISSIONS.CAMPAIGNS_CREATE,
    PERMISSIONS.CAMPAIGNS_READ,
    PERMISSIONS.CAMPAIGNS_UPDATE,
    PERMISSIONS.CAMPAIGNS_SEND,
    PERMISSIONS.CONTACTS_MANAGE,
    PERMISSIONS.CONTACTS_READ,
  ],
  [WORKSPACE_ROLES.USER]: [
    PERMISSIONS.MEMBERS_READ,
    PERMISSIONS.CAMPAIGNS_READ,
    PERMISSIONS.CONTACTS_READ,
  ],
};

/**
 * Check if a role has the specified permission
 * @param {string} role 
 * @param {string} permission 
 * @returns {boolean}
 */
export const hasPermission = (role, permission) => {
  if (!role || !ROLE_PERMISSIONS[role]) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
};

/**
 * Role hierarchy levels for comparison
 */
export const ROLE_HIERARCHY = {
  [WORKSPACE_ROLES.SUPER_ADMIN]: 4,
  [WORKSPACE_ROLES.ADMIN]: 3,
  [WORKSPACE_ROLES.CAMPAIGN_MANAGER]: 2,
  [WORKSPACE_ROLES.USER]: 1,
};

/**
 * Determine if roleA has higher or equal authority to roleB
 */
export const hasEqualOrHigherRole = (roleA, roleB) => {
  return (ROLE_HIERARCHY[roleA] || 0) >= (ROLE_HIERARCHY[roleB] || 0);
};

