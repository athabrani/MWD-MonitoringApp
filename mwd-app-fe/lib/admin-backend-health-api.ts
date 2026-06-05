import { ApiClientError, apiRequest } from "@/lib/api-client";

export type BackendReachabilityStatus =
  | "checking"
  | "online"
  | "offline"
  | "unsupported"
  | "auth-error"
  | "error";

export type BackendReachability = {
  status: BackendReachabilityStatus;
  latencyMs?: number;
  lastCheckedAt?: string;
  errorMessage?: string;
};

export const BACKEND_REACHABILITY_PROBE_PATH = "/api/mwd-sessions";

function getNowMs() {
  return performance.now();
}

function isNetworkError(error: unknown) {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("networkerror") ||
    message.includes("load failed") ||
    message.includes("unable to connect") ||
    message.includes("remote server")
  );
}

export async function checkBackendReachability(token: string, path = "/api/health"): Promise<BackendReachability> {
  const startedAt = getNowMs();

  try {
    await apiRequest<unknown>(path, {
      method: "GET",
      token,
    });

    return {
      status: "online",
      latencyMs: Math.round(getNowMs() - startedAt),
      lastCheckedAt: new Date().toISOString(),
    };
  } catch (error) {
    const latencyMs = Math.round(getNowMs() - startedAt);
    const lastCheckedAt = new Date().toISOString();

    if (error instanceof ApiClientError) {
      if (error.status === 401 || error.status === 403) {
        return {
          status: "auth-error",
          latencyMs,
          lastCheckedAt,
          errorMessage: "Backend reachable, but authentication failed.",
        };
      }

      if (error.status === 404) {
        return {
          status: "unsupported",
          latencyMs,
          lastCheckedAt,
          errorMessage: `Backend reachable, but ${path} is not implemented.`,
        };
      }

      return {
        status: "error",
        latencyMs,
        lastCheckedAt,
        errorMessage: error.message,
      };
    }

    if (isNetworkError(error)) {
      return {
        status: "offline",
        latencyMs,
        lastCheckedAt,
        errorMessage: "Backend API unreachable.",
      };
    }

    return {
      status: "error",
      latencyMs,
      lastCheckedAt,
      errorMessage: error instanceof Error ? error.message : "Backend health check failed.",
    };
  }
}
