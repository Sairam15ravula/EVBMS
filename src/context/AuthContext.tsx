import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthState, User, UserRole } from '../types';

interface AuthContextType extends AuthState {
  login: (accessToken: string, refreshToken: string, user: User) => void;
  register: (accessToken: string, refreshToken: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACCESS_TOKEN_KEY = 'evbms_access_token';
const REFRESH_TOKEN_KEY = 'evbms_refresh_token';
const USER_KEY = 'evbms_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    accessToken: null,
    role: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    // Restore session from localStorage on app load
    try {
      const storedToken = localStorage.getItem(ACCESS_TOKEN_KEY);
      const storedUserRaw = localStorage.getItem(USER_KEY);

      if (storedToken && storedUserRaw) {
        const user: User = JSON.parse(storedUserRaw);
        setAuthState({
          user,
          accessToken: storedToken,
          role: user.role,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (err) {
      console.error('Failed to restore auth session:', err);
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const login = (accessToken: string, refreshToken: string, user: User) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));

    setAuthState({
      user,
      accessToken,
      role: user.role,
      isAuthenticated: true,
      isLoading: false,
    });
  };

  const register = (accessToken: string, refreshToken: string, user: User) => {
    login(accessToken, refreshToken, user);
  };

  const logout = () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    setAuthState({
      user: null,
      accessToken: null,
      role: null,
      isAuthenticated: false,
      isLoading: false,
    });
  };

  return (
    <AuthContext.Provider value={{ ...authState, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
