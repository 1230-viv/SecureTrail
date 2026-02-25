import React, { createContext, useContext, useState, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

const _parseUser = () => {
  try { return JSON.parse(localStorage.getItem('github_user')) || null; }
  catch { return null; }
};

export const AuthProvider = ({ children }) => {
  const [user,  setUser]  = useState(_parseUser);
  const [token, setToken] = useState(() => localStorage.getItem('github_token') || null);

  const isAuthenticated = !!(token && user);

  /** Called by oauth-callback after GitHub redirects back */
  const login = useCallback((userData, accessToken) => {
    localStorage.setItem('github_token', accessToken);
    localStorage.setItem('github_user', JSON.stringify(userData));
    setToken(accessToken);
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    try { await authAPI.logout(); } catch { /* ignore */ }
    localStorage.removeItem('github_token');
    localStorage.removeItem('github_user');
    setToken(null);
    setUser(null);
  }, []);

  /** Redirect to GitHub OAuth */
  const loginWithGitHub = useCallback(async () => {
    try {
      const { data } = await authAPI.getGitHubLoginUrl();
      window.location.href = data.auth_url;
    } catch (err) {
      console.error('GitHub login redirect failed:', err);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, login, logout, loginWithGitHub }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
