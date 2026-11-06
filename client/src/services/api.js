import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1',
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

      const storedRefreshToken = localStorage.getItem('mailflow_refresh_token');

      try {
        const refreshResponse = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'}/auth/refresh`,
          { refreshToken: storedRefreshToken },
          { withCredentials: true }
        );

        const newAccessToken = refreshResponse.data?.data?.accessToken;
        const newRefreshToken = refreshResponse.data?.data?.refreshToken;

        if (newAccessToken) {
          localStorage.setItem('mailflow_token', newAccessToken);
          if (newRefreshToken) {
            localStorage.setItem('mailflow_refresh_token', newRefreshToken);
          }
          api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
          processQueue(null, newAccessToken);
          return api(originalRequest);
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.removeItem('mailflow_token');
        localStorage.removeItem('mailflow_refresh_token');
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
  return `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'}/contacts/export?${params.toString()}`;
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
export const getCampaignRecipients = (id, params) => api.get(`/campaigns/${id}/recipients`, { params });

export default api;
