'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '../types';
import { ApiClientError } from '@/lib/api-client';
import { fetchCurrentUser, loginWithPassword } from '@/lib/auth-api';
import { toast } from 'sonner';
import {
  bootstrapStoredSession,
  clearSessionScopedUiState,
  clearStoredSession,
  isRememberedToken,
  writeStoredSession,
} from '@/lib/security/storage';
import {
  resetAuthSessionInvalidNotification,
  subscribeAuthSessionInvalid,
  type AuthSessionInvalidDetail,
} from '@/lib/security/session-events';
import { normalizeIdentifierInput } from '@/lib/security/input';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const [initialSession] = useState(() => bootstrapStoredSession());
  const [token, setToken] = useState<string | null>(() => initialSession.token);
  const [user, setUser] = useState<User | null>(() => initialSession.user);
  const [isLoading, setIsLoading] = useState(() => Boolean(initialSession.token));

  const clearAuthSession = () => {
    setUser(null);
    setToken(null);
    setIsLoading(false);
    clearStoredSession();
    clearSessionScopedUiState();
  };

  const logout = () => {
    resetAuthSessionInvalidNotification();
    clearAuthSession();
  };

  useEffect(
    () =>
      subscribeAuthSessionInvalid((detail: AuthSessionInvalidDetail) => {
        clearAuthSession();
        toast.warning(detail.message ?? "Session expired. Please sign in again.");
        router.replace("/login");
      }),
    [router]
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    fetchCurrentUser(token)
      .then((currentUser) => {
        if (cancelled) return;
        setUser(currentUser);
        const remembered = isRememberedToken(token);
        writeStoredSession(currentUser, token, remembered);
      })
      .catch(() => {
        if (cancelled) return;
        clearAuthSession();
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
      const session = await loginWithPassword(normalizeIdentifierInput(username), password);
      resetAuthSessionInvalidNotification();
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
