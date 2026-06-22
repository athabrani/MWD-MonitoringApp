"use client";

import type { User } from "@/types";

export const USER_STORAGE_KEY = "mwd_user";
export const TOKEN_STORAGE_KEY = "mwd_auth_token";
export const ACTIVE_SESSION_STORAGE_KEY = "mwd_active_session_id";
export const ACTIVE_PLOT_CONFIG_STORAGE_KEY = "mwd_active_plot_config_id";
export const SETTINGS_STORAGE_KEY = "mwd_settings";

const sessionScopedKeys = [
  USER_STORAGE_KEY,
  TOKEN_STORAGE_KEY,
  ACTIVE_SESSION_STORAGE_KEY,
  ACTIVE_PLOT_CONFIG_STORAGE_KEY,
];

function isBrowser() {
  return typeof window !== "undefined";
}

function safeGet(storage: Storage, key: string) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {
    // Storage may be blocked; auth should still work in memory for the current render.
  }
}

function safeRemove(storage: Storage, key: string) {
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage cleanup failures caused by browser privacy settings.
  }
}

function sanitizeStoredUser(user: User): User {
  return {
    id: String(user.id),
    username: user.username,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
  };
}

function isStoredUser(value: unknown): value is User {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.username === "string" &&
    typeof record.email === "string" &&
    typeof record.fullName === "string" &&
    (record.role === "operator" || record.role === "engineer" || record.role === "admin")
  );
}

export function readStoredValue(key: string) {
  if (!isBrowser()) return null;
  return safeGet(window.localStorage, key) ?? safeGet(window.sessionStorage, key);
}

export function readStoredToken() {
  const token = readStoredValue(TOKEN_STORAGE_KEY);
  return token?.trim() || null;
}

export function readStoredUser() {
  const persistedUser = readStoredValue(USER_STORAGE_KEY);
  if (!persistedUser) return null;

  try {
    const parsed = JSON.parse(persistedUser) as unknown;
    return isStoredUser(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearStoredSession() {
  if (!isBrowser()) return;

  for (const key of sessionScopedKeys) {
    safeRemove(window.localStorage, key);
    safeRemove(window.sessionStorage, key);
  }
}

export function writeStoredSession(user: User, token: string, rememberMe: boolean) {
  if (!isBrowser()) return;

  const activeSessionId = readStoredValue(ACTIVE_SESSION_STORAGE_KEY);
  const activePlotConfigId = readStoredValue(ACTIVE_PLOT_CONFIG_STORAGE_KEY);

  clearStoredSession();
  const storage = rememberMe ? window.localStorage : window.sessionStorage;
  safeSet(storage, TOKEN_STORAGE_KEY, token);

  if (activeSessionId) {
    safeSet(window.localStorage, ACTIVE_SESSION_STORAGE_KEY, activeSessionId);
  }

  if (activePlotConfigId) {
    safeSet(window.localStorage, ACTIVE_PLOT_CONFIG_STORAGE_KEY, activePlotConfigId);
  }
}

export function bootstrapStoredSession() {
  if (!isBrowser()) return { token: null, user: null };

  const token = readStoredToken();

  if (!token) {
    clearStoredSession();
    return { token: null, user: null };
  }

  safeRemove(window.localStorage, USER_STORAGE_KEY);
  safeRemove(window.sessionStorage, USER_STORAGE_KEY);

  return { token, user: null };
}

export function isRememberedToken(token: string) {
  if (!isBrowser()) return false;
  return safeGet(window.localStorage, TOKEN_STORAGE_KEY) === token;
}

export function clearSessionScopedUiState() {
  if (!isBrowser()) return;

  for (const key of [ACTIVE_SESSION_STORAGE_KEY, ACTIVE_PLOT_CONFIG_STORAGE_KEY]) {
    safeRemove(window.localStorage, key);
    safeRemove(window.sessionStorage, key);
  }
}
