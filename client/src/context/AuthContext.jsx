import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  getMyProfile,
  loginUser as apiLogin,
  logoutUser as apiLogout,
  registerUser as apiRegister,
  updateMyProfile,
} from '../services/api.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('mailflow_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('mailflow_token'));
  const [loading, setLoading] = useState(true);

  // Sync state and check profile validity on mount
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('mailflow_token');
      if (storedToken) {
        try {
          const res = await getMyProfile();
          if (res?.data) {
            setUser(res.data);
            localStorage.setItem('mailflow_user', JSON.stringify(res.data));
          }
        } catch (err) {
          console.warn('Session verification check:', err.message);
          // Handled by axios refresh interceptor
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    const res = await apiLogin({ email, password });
    const { user: userData, accessToken, refreshToken } = res.data;
    
    setUser(userData);
    setToken(accessToken);
    localStorage.setItem('mailflow_user', JSON.stringify(userData));
    localStorage.setItem('mailflow_token', accessToken);
    if (refreshToken) {
      localStorage.setItem('mailflow_refresh_token', refreshToken);
    }
    return userData;
  };

  const register = async (name, email, password, termsAccepted) => {
    const res = await apiRegister({ name, email, password, termsAccepted });
    return res;
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('mailflow_refresh_token');
      await apiLogout({ refreshToken });
    } catch (e) {
      // Ignore network errors during logout
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('mailflow_user');
      localStorage.removeItem('mailflow_token');
      localStorage.removeItem('mailflow_refresh_token');
    }
  };

  const updateUserProfile = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('mailflow_user', JSON.stringify(updatedUser));
  };

  const restartOnboarding = async () => {
    try {
      const res = await updateMyProfile({
        onboardingStep: 0,
        onboardingCompleted: false,
        onboardingSkipped: false,
      });
      if (res?.data) {
        updateUserProfile(res.data);
      }
    } catch (e) {
      console.error('Failed to restart onboarding:', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!user && !!token,
        login,
        register,
        logout,
        updateUserProfile,
        restartOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

