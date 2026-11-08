import axios from 'axios';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000/api/v1' : '/api/v1');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send httpOnly cookies (refreshToken) automatically
  timeout: 10000,
});

// Request interceptor: attach bearer access token and active workspace ID if present
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('mailflow_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const activeWorkspaceId = localStorage.getItem('mailflow_workspace_id');
    if (activeWorkspaceId) {
      config.headers['x-workspace-id'] = activeWorkspaceId;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 token refresh automatically
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/login') && !originalRequest.url?.includes('/auth/refresh')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newAccessToken = refreshResponse.data?.data?.accessToken;

        if (newAccessToken) {
          localStorage.setItem('mailflow_token', newAccessToken);
          api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
          processQueue(null, newAccessToken);
          return api(originalRequest);
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.removeItem('mailflow_token');
        localStorage.removeItem('mailflow_user');
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    const customError = {
      message: error.response?.data?.message || error.message || 'An unexpected network error occurred',
      statusCode: error.response?.status || 500,
      errors: error.response?.data?.errors || [],
    };
    return Promise.reject(customError);
  }
);

export const checkHealth = () => api.get('/health');

// Auth endpoints
export const registerUser = (data) => api.post('/auth/register', data);
export const loginUser = (data) => api.post('/auth/login', data);
export const verifyEmail = (data) => api.post('/auth/verify-email', data);
export const resendVerificationEmail = (data) => api.post('/auth/resend-verification', data);
export const forgotPassword = (data) => api.post('/auth/forgot-password', data);
export const resetPassword = (data) => api.post('/auth/reset-password', data);
export const changePassword = (data) => api.post('/auth/change-password', data);
export const logoutUser = (data) => api.post('/auth/logout', data);
export const getMyProfile = () => api.get('/auth/me');
export const updateMyProfile = (data) => api.patch('/auth/me', data);
export const getOAuthStatus = () => api.get('/auth/oauth/status');

// Workspace endpoints
export const getCurrentWorkspace = () => api.get('/workspaces/current');
export const updateCurrentWorkspace = (data) => api.patch('/workspaces/current', data);
export const getWorkspaceMembers = () => api.get('/workspaces/current/members');
export const createWorkspaceInvitation = (data) => api.post('/workspaces/current/invitations', data);
export const getWorkspaceInvitations = () => api.get('/workspaces/current/invitations');
export const acceptWorkspaceInvitation = (token) => api.post(`/workspaces/invitations/${token}/accept`);

// Contact endpoints
export const getContacts = (params) => api.get('/contacts', { params });
export const getContactStats = () => api.get('/contacts/stats');
export const createContact = (data) => api.post('/contacts', data);
export const getContactById = (id) => api.get(`/contacts/${id}`);
export const updateContact = (id, data) => api.patch(`/contacts/${id}`, data);
export const deleteContact = (id) => api.delete(`/contacts/${id}`);
export const unsubscribeContact = (id) => api.post(`/contacts/${id}/unsubscribe`);

// Contact Groups & Tags
export const getContactGroups = () => api.get('/contacts/groups');
export const createContactGroup = (data) => api.post('/contacts/groups', data);
export const updateContactGroup = (id, data) => api.patch(`/contacts/groups/${id}`, data);
export const deleteContactGroup = (id) => api.delete(`/contacts/groups/${id}`);
export const assignContactGroups = (data) => api.post('/contacts/groups/assign', data);
export const manageContactTags = (data) => api.post('/contacts/tags/manage', data);

// Import & Export
export const previewContactImport = (formData) =>
  api.post('/contacts/import/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const executeContactImport = (formData) =>
  api.post('/contacts/import/execute', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const exportContactsUrl = (format = 'csv', filters = {}) => {
  const params = new URLSearchParams({ format, ...filters });
  return `${API_BASE_URL}/contacts/export?${params.toString()}`;
};

// Email Account endpoints
export const getEmailProviders = () => api.get('/email-accounts/providers');
export const getConnectedEmailAccounts = () => api.get('/email-accounts');
export const initiateEmailOAuth = (data) => api.post('/email-accounts/oauth/initiate', data);
export const callbackEmailOAuth = (data) => api.post('/email-accounts/oauth/callback', data);
export const disconnectEmailAccount = (id) => api.delete(`/email-accounts/${id}`);
export const sendTestEmail = (id, data) => api.post(`/email-accounts/${id}/test`, data);

// Campaign endpoints
export const getCampaigns = (params) => api.get('/campaigns', { params });
export const getCampaignById = (id) => api.get(`/campaigns/${id}`);
export const createCampaign = (data) => api.post('/campaigns', data);
export const updateCampaign = (id, data) => api.patch(`/campaigns/${id}`, data);
export const deleteCampaign = (id) => api.delete(`/campaigns/${id}`);
export const duplicateCampaign = (id) => api.post(`/campaigns/${id}/duplicate`);
export const previewAudience = (data) => api.post('/campaigns/preview-audience', data);
export const sendCampaignTestEmail = (id, data) => api.post(`/campaigns/${id}/test-email`, data);
export const sendCampaign = (id, headers = {}) => api.post(`/campaigns/${id}/send`, {}, { headers });
export const scheduleCampaign = (id, data) => api.post(`/campaigns/${id}/schedule`, data);
export const rescheduleCampaign = (id, data) => api.post(`/campaigns/${id}/reschedule`, data);
export const cancelCampaign = (id) => api.post(`/campaigns/${id}/cancel`);
export const getCampaignRecipients = (id, params) => api.get(`/campaigns/${id}/recipients`, { params });

// Reusable email templates
export const getEmailTemplates = (params) => api.get('/templates', { params });
export const createEmailTemplate = (data) => api.post('/templates', data);
export const updateEmailTemplate = (id, data) => api.patch(`/templates/${id}`, data);
export const deleteEmailTemplate = (id) => api.delete(`/templates/${id}`);

// Automation endpoints
export const getAutomations = (params) => api.get('/automations', { params });
export const getAutomationById = (id) => api.get(`/automations/${id}`);
export const createAutomation = (data) => api.post('/automations', data);
export const updateAutomation = (id, data) => api.patch(`/automations/${id}`, data);
export const deleteAutomation = (id) => api.delete(`/automations/${id}`);
export const toggleAutomationStatus = (id) => api.post(`/automations/${id}/toggle`);
export const getAutomationHistory = (id) => api.get(`/automations/${id}/history`);

// Auto-Reply endpoints (Phase 10)
export const getAutoReplyRules = (params) => api.get('/auto-reply/rules', { params });
export const getAutoReplyRuleById = (id) => api.get(`/auto-reply/rules/${id}`);
export const createAutoReplyRule = (data) => api.post('/auto-reply/rules', data);
export const updateAutoReplyRule = (id, data) => api.patch(`/auto-reply/rules/${id}`, data);
export const deleteAutoReplyRule = (id) => api.delete(`/auto-reply/rules/${id}`);
export const updateAutoReplySettings = (accountId, data) => api.patch(`/auto-reply/settings/${accountId}`, data);
export const getAutoReplyLogs = (params) => api.get('/auto-reply/logs', { params });
export const simulateIncomingMessage = (data) => api.post('/auto-reply/simulate', data);

// Analytics endpoints (Phase 11)
export const getAnalyticsOverview = (params) => api.get('/analytics/overview', { params });
export const getCampaignAnalytics = (id) => api.get(`/analytics/campaigns/${id}`);
export const getAutoReplyAnalytics = (params) => api.get('/analytics/auto-reply', { params });
export const getAdminSystemHealth = () => api.get('/analytics/admin/health');
export const getAuditLogs = (params) => api.get('/analytics/audit-logs', { params });
export const exportCampaignsAnalyticsUrl = () =>
  `${API_BASE_URL}/analytics/export/campaigns`;

// Attachments endpoints (Phase 2)
export const uploadAttachments = (formData) =>
  api.post('/attachments/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const deleteAttachment = (filename) =>
  api.delete(`/attachments/${filename}`);

// Notifications endpoints (Phase 3)
export const getNotifications = (params) => api.get('/notifications', { params });
export const getUnreadNotificationCount = () => api.get('/notifications/unread-count');
export const markNotificationAsRead = (id) => api.patch(`/notifications/${id}/read`);
export const markAllNotificationsAsRead = () => api.patch('/notifications/read-all');

// Admin Console endpoints (Phase 3)
export const getAdminOverview = () => api.get('/admin/overview');
export const getAdminUsers = (params) => api.get('/admin/users', { params });
export const getAdminUserDetails = (id) => api.get(`/admin/users/${id}`);
export const updateAdminUserStatus = (id, data) => api.patch(`/admin/users/${id}/status`, data);
export const updateAdminUserRole = (id, data) => api.patch(`/admin/users/${id}/role`, data);
export const getAdminQueues = () => api.get('/admin/queues');
export const retryAdminQueueJobs = (queueName) => api.post(`/admin/queues/${queueName}/retry-failed`);

// AI Assistant endpoints (Phase 4)
export const getChatConversations = () => api.get('/chat/conversations');
export const createChatConversation = (data) => api.post('/chat/conversations', data);
export const getChatMessages = (id) => api.get(`/chat/conversations/${id}`);
export const sendChatMessage = (id, data) => api.post(`/chat/conversations/${id}/messages`, data);
export const deleteChatConversation = (id) => api.delete(`/chat/conversations/${id}`);
export const runAiQuickAction = (data) => api.post('/chat/quick-action', data);

export default api;
