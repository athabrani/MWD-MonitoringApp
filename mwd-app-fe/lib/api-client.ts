export class ApiClientError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

type ApiRequestOptions = RequestInit & {
  token?: string;
};

function getApiBaseUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_API_BASE_URL. Set it in the frontend environment before calling the backend API."
    );
  }

  return baseUrl.replace(/\/$/, "");
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

export async function apiRequest<T>(
  path: string,
  { token, headers, body, ...options }: ApiRequestOptions = {}
): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const requestHeaders = new Headers(headers);
  const isFormDataBody = typeof FormData !== "undefined" && body instanceof FormData;

  if (!requestHeaders.has("Content-Type") && !isFormDataBody) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${getApiBaseUrl()}${normalizedPath}`, {
    ...options,
    body,
    headers: requestHeaders,
  });

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    throw new ApiClientError(getErrorMessage(payload), response.status);
  }

  return payload as T;
}

export async function apiFetch(
  path: string,
  { token, headers, body, ...options }: ApiRequestOptions = {}
): Promise<Response> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const requestHeaders = new Headers(headers);
  const isFormDataBody = typeof FormData !== "undefined" && body instanceof FormData;

  if (!requestHeaders.has("Content-Type") && !isFormDataBody) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${getApiBaseUrl()}${normalizedPath}`, {
    ...options,
    body,
    headers: requestHeaders,
  });

  if (!response.ok) {
    const text = await response.text();
    let payload: unknown = null;

    try {
      payload = text ? (JSON.parse(text) as unknown) : null;
    } catch {
      payload = { message: text || "Backend request failed." };
    }

    throw new ApiClientError(getErrorMessage(payload), response.status);
  }

  return response;
}
