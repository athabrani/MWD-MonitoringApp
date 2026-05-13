'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '../types';
import { ApiClientError } from '@/lib/api-client';
import { fetchCurrentUser, loginWithPassword } from '@/lib/auth-api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const USER_STORAGE_KEY = 'mwd_user';
const TOKEN_STORAGE_KEY = 'mwd_auth_token';

function readStoredValue(key: string) {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
}

function readStoredUser() {
  const persistedUser = readStoredValue(USER_STORAGE_KEY);
  if (!persistedUser) return null;

  try {
    return JSON.parse(persistedUser) as User;
  } catch {
    return null;
  }
}

function clearStoredSession() {
  window.localStorage.removeItem(USER_STORAGE_KEY);
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.sessionStorage.removeItem(USER_STORAGE_KEY);
  window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
}

function writeStoredSession(user: User, token: string, rememberMe: boolean) {
  clearStoredSession();
  const storage = rememberMe ? window.localStorage : window.sessionStorage;
  storage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  storage.setItem(TOKEN_STORAGE_KEY, token);
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => readStoredValue(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState<User | null>(() => readStoredUser());
  const [isLoading, setIsLoading] = useState(() => Boolean(readStoredValue(TOKEN_STORAGE_KEY)));

  const logout = () => {
    setUser(null);
    setToken(null);
    setIsLoading(false);
    clearStoredSession();
  };

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    fetchCurrentUser(token)
      .then((currentUser) => {
        if (cancelled) return;
        setUser(currentUser);
        const remembered = window.localStorage.getItem(TOKEN_STORAGE_KEY) === token;
        writeStoredSession(currentUser, token, remembered);
      })
      .catch(() => {
        if (cancelled) return;
        logout();
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = async (username: string, password: string, rememberMe = false): Promise<boolean> => {
    try {
      const session = await loginWithPassword(username, password);
      setUser(session.user);
      setToken(session.token);
      writeStoredSession(session.user, session.token, rememberMe);
      return true;
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        return false;
      }

      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      token,
      user, 
      login, 
      logout, 
      isAuthenticated: !!user && !!token,
      isLoading,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
