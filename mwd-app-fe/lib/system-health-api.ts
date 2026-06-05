import { apiRequest } from "@/lib/api-client";

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

export async function getSystemHealth(token: string): Promise<BackendSystemHealth> {
  const response = await apiRequest<unknown>("/api/health", {
    method: "GET",
    token,
  });
  const record = unwrapSingle(response);

  if (!record) {
    throw new Error("Backend returned empty system health.");
  }

  return {
    status: readString(record, ["status", "state", "health"]),
    uptimeSeconds: readNumber(record, ["uptimeSeconds", "uptime_seconds", "uptime"]),
    version: readString(record, ["version", "appVersion", "app_version"]),
    databaseStatus: readString(record, ["databaseStatus", "database_status", "dbStatus", "db_status"]),
    dependencies: normalizeDependencies(record.dependencies ?? record.services),
    checkedAt: readString(record, ["checkedAt", "checked_at", "timestamp", "time"]),
    raw: record,
  };
}
