import { ApiClientError, apiRequest } from "@/lib/api-client";
import { BACKEND_REACHABILITY_PROBE_PATH } from "@/lib/admin-backend-health-api";

type BackendRecord = Record<string, unknown>;
type BackendHealthDependency = {
  name: string;
  status?: string;
  message?: string;
};

const SYSTEM_HEALTH_PATH = "/api/health";

export type BackendSystemHealth = {
  status?: string;
  uptimeSeconds?: number;
  version?: string;
  databaseStatus?: string;
  message?: string;
  sourcePath: string;
  dependencies: BackendHealthDependency[];
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

function readBoolean(record: BackendRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["1", "true", "yes", "ok", "healthy", "online"].includes(normalized)) return true;
      if (["0", "false", "no", "error", "offline", "unhealthy"].includes(normalized)) return false;
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
  process.env.NEXT_PUBLIC_SYSTEM_HEALTH_PATH?.trim() || SYSTEM_HEALTH_PATH;

function toRawRecord(response: unknown): BackendRecord {
  return isRecord(response) ? response : { response };
}

function buildProbeHealth(response: unknown, path: string): BackendSystemHealth {
  const record = unwrapSingle(response);
  const raw = record ?? toRawRecord(response);
  const database = isRecord(raw.database) ? raw.database : {};
  const api = isRecord(raw.api) ? raw.api : {};
  const websocket = isRecord(raw.websocket) ? raw.websocket : {};
  const gateways = isRecord(raw.gateways) ? raw.gateways : {};
  const serialGateway = isRecord(gateways.serial) ? gateways.serial : {};
  const espGateway = isRecord(gateways.espWebSocket) ? gateways.espWebSocket : {};
  const explicitStatus = readString(raw, ["status", "state", "health"]);
  const booleanHealth = readBoolean(raw, ["ok", "healthy", "success"]);
  const status = explicitStatus ?? (booleanHealth === true ? "ok" : booleanHealth === false ? "error" : "unknown");
  const normalizedDependencies = normalizeDependencies(raw.dependencies ?? raw.services);
  const structuredDependencies: BackendHealthDependency[] = [];
  const apiStatus = readString(api, ["status"]);
  const databaseStatus = readString(database, ["status"]);
  const websocketStatus = readString(websocket, ["status"]);
  const serialStatus = readString(serialGateway, ["status"]);
  const espStatus = readString(espGateway, ["status"]);

  if (apiStatus) {
    structuredDependencies.push({
      name: "Backend API",
      status: apiStatus,
    });
  }

  if (databaseStatus) {
    structuredDependencies.push({
      name: "Database",
      status: databaseStatus,
      message: readString(database, ["message", "error"]),
    });
  }

  if (websocketStatus) {
    structuredDependencies.push({
      name: "Realtime WebSocket",
      status: websocketStatus,
      message: readString(websocket, ["path"]),
    });
  }

  if (serialStatus) {
    structuredDependencies.push({
      name: "Serial Gateway",
      status: serialStatus,
      message: readString(serialGateway, ["lastError", "message", "port"]),
    });
  }

  if (espStatus) {
    structuredDependencies.push({
      name: "ESP WebSocket",
      status: espStatus,
      message: readString(espGateway, ["lastError", "message", "url"]),
    });
  }
  const dependencies = normalizedDependencies.length ? normalizedDependencies : structuredDependencies;
  const hasRecognizedHealthShape =
    explicitStatus !== undefined ||
    booleanHealth !== undefined ||
    dependencies.length > 0 ||
    isRecord(raw.database) ||
    isRecord(raw.api);

  return {
    status,
    uptimeSeconds: readNumber(raw, ["uptimeSeconds", "uptime_seconds", "uptime"]),
    version: readString(raw, ["version", "appVersion", "app_version"]),
    databaseStatus:
      readString(raw, ["databaseStatus", "database_status", "dbStatus", "db_status"]) ??
      readString(database, ["status"]),
    message: hasRecognizedHealthShape
      ? undefined
      : `Reachable but health payload from ${path} is incomplete.`,
    sourcePath: path,
    dependencies: dependencies.length
      ? dependencies
      : [
          {
            name: "Backend API",
            status: path === BACKEND_REACHABILITY_PROBE_PATH ? "online" : "unknown",
            message:
              path === BACKEND_REACHABILITY_PROBE_PATH
                ? `Health endpoint unavailable, API reachable via ${path}.`
                : `Reachable but health payload from ${path} is incomplete.`,
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
