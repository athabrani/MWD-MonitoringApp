import { getSafeErrorMessage } from "@/lib/security/errors";
import { notifyAuthSessionInvalid } from "@/lib/security/session-events";

export class ApiClientError extends Error {
  status: number;
  payload?: unknown;
  responseBody?: string;

  constructor(message: string, status: number, payload?: unknown, responseBody?: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.payload = payload;
    this.responseBody = responseBody;
  }
}

type ApiRequestOptions = RequestInit & {
  token?: string;
};

export function getApiBaseUrl() {
  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim();

  if (!baseUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_API_BASE_URL. Set it in the frontend environment before calling the backend API."
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_API_BASE_URL must be an absolute http(s) URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_API_BASE_URL must use http or https.");
  }

  if (typeof window !== "undefined") {
    const frontendHost = window.location.hostname;
    const envUsesLoopback = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    const frontendUsesNetworkHost = frontendHost !== "localhost" && frontendHost !== "127.0.0.1";

    if (envUsesLoopback && frontendUsesNetworkHost) {
      parsed.hostname = frontendHost;
    }
  }

  return parsed.toString().replace(/\/$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorMessage(payload: unknown) {
  if (!isRecord(payload)) return "Backend request failed.";

  const message = payload.message ?? payload.error;
  if (typeof message === "string") return message;
  if (Array.isArray(message)) return message.filter(Boolean).join(", ");

  return "Backend request failed.";
}

function normalizeApiPath(path: string) {
  if (/^https?:\/\//i.test(path)) {
    throw new Error("API requests must use a relative backend path.");
  }

  return path.startsWith("/") ? path : `/${path}`;
}

function prepareRequestHeaders(headers: HeadersInit | undefined, body: BodyInit | null | undefined, token?: string) {
  const requestHeaders = new Headers(headers);
  const isFormDataBody = typeof FormData !== "undefined" && body instanceof FormData;

  if (!requestHeaders.has("Accept")) {
    requestHeaders.set("Accept", "application/json");
  }

  if (!requestHeaders.has("Content-Type") && body !== undefined && body !== null && !isFormDataBody) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (token?.trim()) {
    requestHeaders.set("Authorization", `Bearer ${token.trim()}`);
  }

  return requestHeaders;
}

function isAuthInvalidMessage(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("invalid or expired token") ||
    normalized.includes("expired token") ||
    normalized.includes("token expired") ||
    normalized.includes("jwt expired") ||
    normalized.includes("invalid token") ||
    normalized.includes("malformed token") ||
    normalized.includes("session expired") ||
    normalized.includes("invalid session") ||
    normalized.includes("unauthenticated")
  );
}

function handleAuthFailure(status: number, message: string, token?: string) {
  if (!token) return;

  if (status === 401) {
    notifyAuthSessionInvalid({
      reason: isAuthInvalidMessage(message) ? "expired" : "unauthorized",
      message: "Session expired. Please sign in again.",
    });
    return;
  }

  if (status === 403 && isAuthInvalidMessage(message)) {
    notifyAuthSessionInvalid({
      reason: "forbidden-auth",
      message: "Session expired. Please sign in again.",
    });
    return;
  }

  if (isAuthInvalidMessage(message)) {
    notifyAuthSessionInvalid({
      reason: "invalid-token",
      message: "Session expired. Please sign in again.",
    });
  }
}

export async function apiRequest<T>(
  path: string,
  { token, headers, body, ...options }: ApiRequestOptions = {}
): Promise<T> {
  const normalizedPath = normalizeApiPath(path);
  const requestHeaders = prepareRequestHeaders(headers, body, token);

  const response = await fetch(`${getApiBaseUrl()}${normalizedPath}`, {
    ...options,
    body,
    headers: requestHeaders,
    cache: options.cache ?? "no-store",
  });

  const text = await response.text();
  let payload: unknown = null;

  try {
    payload = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    payload = text ? { message: text } : null;
  }

  if (!response.ok) {
    const backendMessage = getErrorMessage(payload);
    handleAuthFailure(response.status, backendMessage, token);
    throw new ApiClientError(getSafeErrorMessage({ status: response.status, message: backendMessage }), response.status, payload, text);
  }

  return payload as T;
}

export async function apiFetch(
  path: string,
  { token, headers, body, ...options }: ApiRequestOptions = {}
): Promise<Response> {
  const normalizedPath = normalizeApiPath(path);
  const requestHeaders = prepareRequestHeaders(headers, body, token);

  const response = await fetch(`${getApiBaseUrl()}${normalizedPath}`, {
    ...options,
    body,
    headers: requestHeaders,
    cache: options.cache ?? "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    let payload: unknown = null;

    try {
      payload = text ? (JSON.parse(text) as unknown) : null;
    } catch {
      payload = { message: text || "Backend request failed." };
    }

    const backendMessage = getErrorMessage(payload);
    handleAuthFailure(response.status, backendMessage, token);
    throw new ApiClientError(getSafeErrorMessage({ status: response.status, message: backendMessage }), response.status, payload, text);
  }

  return response;
}
