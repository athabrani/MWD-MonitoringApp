import { ApiClientError, apiRequest } from "@/lib/api-client";
import { BACKEND_REACHABILITY_PROBE_PATH } from "@/lib/admin-backend-health-api";

type BackendRecord = Record<string, unknown>;

export type BackendSystemHealth = {
  status?: string;
  uptimeSeconds?: number;
  version?: string;
  databaseStatus?: string;
  dependencies: Array<{
    name: string;
    status?: string;
    message?: string;
  }>;
  checkedAt?: string;
  raw: BackendRecord;
};

function isRecord(value: unknown): value is BackendRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(record: BackendRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return undefined;
}

function readNumber(record: BackendRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return undefined;
}

function unwrapSingle(response: unknown) {
  if (!isRecord(response)) return null;

  const nested = response.data ?? response.value ?? response.health;
  return isRecord(nested) ? nested : response;
}

function normalizeDependencies(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.filter(isRecord).map((dependency) => ({
    name: readString(dependency, ["name", "service", "key"]) ?? "unknown",
    status: readString(dependency, ["status", "state", "health"]),
    message: readString(dependency, ["message", "description", "error"]),
  }));
}

const DEFAULT_SYSTEM_HEALTH_PROBE_PATH =
  process.env.NEXT_PUBLIC_SYSTEM_HEALTH_PATH?.trim() || BACKEND_REACHABILITY_PROBE_PATH;

function toRawRecord(response: unknown): BackendRecord {
  return isRecord(response) ? response : { response };
}

function buildProbeHealth(response: unknown, path: string): BackendSystemHealth {
  const record = unwrapSingle(response);
  const raw = record ?? toRawRecord(response);
  const status = readString(raw, ["status", "state", "health"]) ?? "online";
  const dependencies = normalizeDependencies(raw.dependencies ?? raw.services);

  return {
    status,
    uptimeSeconds: readNumber(raw, ["uptimeSeconds", "uptime_seconds", "uptime"]),
    version: readString(raw, ["version", "appVersion", "app_version"]),
    databaseStatus: readString(raw, ["databaseStatus", "database_status", "dbStatus", "db_status"]),
    dependencies: dependencies.length
      ? dependencies
      : [
          {
            name: "Backend API",
            status: "online",
            message: `Probe ${path} responded successfully.`,
          },
        ],
    checkedAt: readString(raw, ["checkedAt", "checked_at", "timestamp", "time"]) ?? new Date().toISOString(),
    raw,
  };
}

export async function getSystemHealth(token: string): Promise<BackendSystemHealth> {
  const path = DEFAULT_SYSTEM_HEALTH_PROBE_PATH;

  try {
    const response = await apiRequest<unknown>(path, {
      method: "GET",
      token,
    });

    return buildProbeHealth(response, path);
  } catch (error) {
    if (
      error instanceof ApiClientError &&
      error.status === 404 &&
      path !== BACKEND_REACHABILITY_PROBE_PATH
    ) {
      const response = await apiRequest<unknown>(BACKEND_REACHABILITY_PROBE_PATH, {
        method: "GET",
        token,
      });

      return buildProbeHealth(response, BACKEND_REACHABILITY_PROBE_PATH);
    }

    throw error;
  }
}
