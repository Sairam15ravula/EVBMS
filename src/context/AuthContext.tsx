import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { AuthState, User, UserRole } from '../types';

interface AuthContextType extends AuthState {
  login: (accessToken: string, refreshToken: string, user: User) => void;
  register: (accessToken: string, refreshToken: string, user: User) => void;
  logout: () => void;
  refreshAccessToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACCESS_TOKEN_KEY = 'evbms_access_token';
const REFRESH_TOKEN_KEY = 'evbms_refresh_token';
const USER_KEY = 'evbms_user';
const TOKEN_EXPIRY_KEY = 'evbms_token_expiry';

// Refresh token 5 minutes before expiry
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    accessToken: null,
    role: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRefreshingRef = useRef(false);
  const requestQueueRef = useRef<Array<{
    resolve: (value: boolean) => void;
    reject: (reason: unknown) => void;
  }>>([]);

  /**
   * Persists auth state to localStorage.
   */
  const persistAuthState = useCallback((token: string, refreshToken: string, user: User, expiry?: number) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    if (expiry) {
      localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiry));
    }
  }, []);

  /**
   * Clears all auth data from localStorage.
   */
  const clearAuthState = useCallback(() => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  }, []);

  /**
   * Decodes a JWT token to get its expiry timestamp.
   */
  const getTokenExpiry = (token: string): number | null => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp ? payload.exp * 1000 : null;
    } catch {
      return null;
    }
  };

  /**
   * Attempts to refresh the access token.
   */
  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    if (isRefreshingRef.current) {
      // Wait for the ongoing refresh to complete
      return new Promise((resolve, reject) => {
        requestQueueRef.current.push({ resolve, reject });
      });
    }

    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return false;

    isRefreshingRef.current = true;

    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        // Refresh failed — clear auth state
        clearAuthState();
        setAuthState({
          user: null,
          accessToken: null,
          role: null,
          isAuthenticated: false,
          isLoading: false,
        });
        return false;
      }

      const data = await response.json();
      if (data.accessToken) {
        const userRaw = localStorage.getItem(USER_KEY);
        const user: User = userRaw ? JSON.parse(userRaw) : null;
        const expiry = getTokenExpiry(data.accessToken);

        localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
        if (data.refreshToken) {
          localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
        }
        if (expiry) {
          localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiry));
        }

        setAuthState(prev => ({
          ...prev,
          accessToken: data.accessToken,
          isAuthenticated: true,
        }));

        // Resolve all queued requests
        requestQueueRef.current.forEach(({ resolve }) => resolve(true));
        requestQueueRef.current = [];

        // Schedule next refresh
        if (expiry) {
          scheduleRefresh(data.accessToken);
        }

        return true;
      }
      return false;
    } catch (err) {
      console.error('Token refresh failed:', err);
      requestQueueRef.current.forEach(({ reject }) => reject(err));
      requestQueueRef.current = [];
      return false;
    } finally {
      isRefreshingRef.current = false;
    }
  }, [clearAuthState]);

  /**
   * Schedules automatic token refresh before expiry.
   */
  const scheduleRefresh = useCallback((token: string) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    const expiry = getTokenExpiry(token);
    if (!expiry) return;

    const refreshTime = expiry - Date.now() - REFRESH_BUFFER_MS;
    if (refreshTime <= 0) {
      // Token is already near expiry, refresh immediately
      refreshAccessToken();
      return;
    }

    refreshTimerRef.current = setTimeout(() => {
      refreshAccessToken();
    }, refreshTime);
  }, [refreshAccessToken]);

  useEffect(() => {
    // Restore session from localStorage on app load
    try {
      const storedToken = localStorage.getItem(ACCESS_TOKEN_KEY);
      const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      const storedUserRaw = localStorage.getItem(USER_KEY);

      if (storedToken && storedRefreshToken && storedUserRaw) {
        const user: User = JSON.parse(storedUserRaw);
        const expiry = getTokenExpiry(storedToken);

        // Check if token is still valid
        if (expiry && expiry > Date.now()) {
          setAuthState({
            user,
            accessToken: storedToken,
            role: user.role,
            isAuthenticated: true,
            isLoading: false,
          });
          // Schedule automatic refresh
          scheduleRefresh(storedToken);
        } else {
          // Token expired, try to refresh
          refreshAccessToken().then((success) => {
            if (!success) {
              clearAuthState();
              setAuthState(prev => ({ ...prev, isLoading: false }));
            }
          });
        }
      } else {
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (err) {
      console.error('Failed to restore auth session:', err);
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  const login = (accessToken: string, refreshToken: string, user: User) => {
    const expiry = getTokenExpiry(accessToken);
    persistAuthState(accessToken, refreshToken, user, expiry || undefined);

    setAuthState({
      user,
      accessToken,
      role: user.role,
      isAuthenticated: true,
      isLoading: false,
    });

    // Schedule automatic refresh
    scheduleRefresh(accessToken);
  };

  const register = (accessToken: string, refreshToken: string, user: User) => {
    login(accessToken, refreshToken, user);
  };

  const logout = () => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    clearAuthState();

    setAuthState({
      user: null,
      accessToken: null,
      role: null,
      isAuthenticated: false,
      isLoading: false,
    });
  };

  return (
    <AuthContext.Provider value={{ ...authState, login, register, logout, refreshAccessToken }}>
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
