import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getCurrentWorkspace, updateCurrentWorkspace as apiUpdateWorkspace } from '../services/api';
import { useAuth } from './AuthContext';

const WorkspaceContext = createContext(null);

export const WorkspaceProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [workspace, setWorkspace] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCurrentWorkspace = useCallback(async () => {
    if (!isAuthenticated) {
      setWorkspace(null);
      setUserRole(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await getCurrentWorkspace();
      const wsData = response.data?.workspace || null;
      const roleData = response.data?.currentUserRole || null;

      setWorkspace(wsData);
      setUserRole(roleData);

      if (wsData?._id || wsData?.id) {
        localStorage.setItem('mailflow_workspace_id', wsData._id || wsData.id);
      }
    } catch (err) {
      console.error('Error fetching workspace:', err);
      localStorage.removeItem('mailflow_workspace_id');
      setError(err.message || 'Failed to load workspace');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchCurrentWorkspace();
  }, [fetchCurrentWorkspace]);

  const updateWorkspace = async (updateData) => {
    try {
      const response = await apiUpdateWorkspace(updateData);
      const updated = response.data?.workspace;
      if (updated) {
        setWorkspace(updated);
      }
      return { success: true, workspace: updated };
    } catch (err) {
      return {
        success: false,
        error: err.message || 'Failed to update workspace',
      };
    }
  };

  const isSuperAdmin = userRole === 'Super Admin';
  const isAdmin = userRole === 'Admin' || isSuperAdmin;
  const isCampaignManager = userRole === 'Campaign Manager' || isAdmin;

  const value = {
    workspace,
    userRole,
    isLoading,
    error,
    refreshWorkspace: fetchCurrentWorkspace,
    updateWorkspace,
    isSuperAdmin,
    isAdmin,
    isCampaignManager,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};

