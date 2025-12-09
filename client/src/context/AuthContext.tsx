import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

interface User {
  id: number;
  email: string;
  name: string | null;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (accessToken: string, user: User) => void;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Helper to restore auth state synchronously from localStorage.
 */
const getInitialAuthState = () => {
  const token = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');

  if (token && storedUser) {
    try {
      const user = JSON.parse(storedUser);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      return { token, user };
    } catch {
      // Invalid stored user, clear it
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    }
  }

  return { token: null, user: null };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState] = useState(getInitialAuthState);
  const [user, setUser] = useState<User | null>(authState.user);
  const [token, setToken] = useState<string | null>(authState.token);
  const [isLoading] = useState(false);

  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common['Authorization'];
    }
  }, [token]);

  /**
   * Login handler - stores access token and user info.
   * Note: The refresh token is automatically stored as an httpOnly cookie by the server.
   */
  const login = useCallback((newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  }, []);

  /**
   * Logout handler - clears local state and calls server to invalidate refresh token.
   */
  const logout = useCallback(async () => {
    try {
      // Call server to invalidate refresh token
      // This also clears the httpOnly cookie
      await api.post('/auth/logout');
    } catch (error) {
      // Even if the server call fails, we still want to clear local state
      console.error('Logout API call failed:', error);
    } finally {
      // Clear local state
      setToken(null);
      setUser(null);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      delete api.defaults.headers.common['Authorization'];
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAuthenticated: !!token && !!user,
        isLoading,
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
