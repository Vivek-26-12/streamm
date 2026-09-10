import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/client.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if token in local storage is valid on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await authApi.validate();
        if (response.data && response.data.valid) {
          setUser(response.data.user);
        } else {
          localStorage.removeItem('token');
        }
      } catch (error) {
        console.error('Session validation failed:', error);
        localStorage.removeItem('token');
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (username, password) => {
    try {
      const response = await authApi.login(username, password);
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      setUser(user);
      return { success: true };
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Authentication failed.';
      return { success: false, error: errorMsg };
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (e) {
      // ignore logout errors, clear client anyways
    } finally {
      localStorage.removeItem('token');
      setUser(null);
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
