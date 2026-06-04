"use client";

export const authSessionInvalidEvent = "mwd-auth-session-invalid";

export type AuthSessionInvalidReason =
  | "unauthorized"
  | "expired"
  | "invalid-token"
  | "forbidden-auth";

export type AuthSessionInvalidDetail = {
  reason: AuthSessionInvalidReason;
  message?: string;
};

let invalidSessionEventDispatched = false;

export function notifyAuthSessionInvalid(detail: AuthSessionInvalidDetail) {
  if (typeof window === "undefined") return false;
  if (invalidSessionEventDispatched) return false;

  invalidSessionEventDispatched = true;
  window.dispatchEvent(new CustomEvent<AuthSessionInvalidDetail>(authSessionInvalidEvent, { detail }));
  return true;
}

export function resetAuthSessionInvalidNotification() {
  invalidSessionEventDispatched = false;
}

export function subscribeAuthSessionInvalid(listener: (detail: AuthSessionInvalidDetail) => void) {
  if (typeof window === "undefined") return () => {};

  const handleInvalidSession = (event: Event) => {
    listener((event as CustomEvent<AuthSessionInvalidDetail>).detail);
  };

  window.addEventListener(authSessionInvalidEvent, handleInvalidSession);
  return () => window.removeEventListener(authSessionInvalidEvent, handleInvalidSession);
}
