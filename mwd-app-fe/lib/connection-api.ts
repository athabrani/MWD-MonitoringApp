import { apiRequest } from "@/lib/api-client";
import { ConnectionState, ConnectionStatus, DataSource, Event, EventSeverity } from "@/types";

type BackendRecord = Record<string, unknown>;

type BackendListResponse = {
  value?: unknown;
  data?: unknown;
  items?: unknown;
  results?: unknown;
  statuses?: unknown;
  events?: unknown;
};

export type ConnectionStatusQuery = {
  sessionId?: string;
  limit?: number;
};

export type FailoverEventsQuery = {
  sessionId?: string;
  limit?: number;
};

export type ConnectionStatusRecord = {
  id: string;
  status: ConnectionStatus;
  latency: number;
  packetLoss: number;
  lastReceived: Date;
  dataSource: DataSource;
  message?: string;
  raw: BackendRecord;
};

export type FailoverEventRecord = {
  id: string;
  timestamp: Date;
  severity: EventSeverity;
  message: string;
  source?: DataSource;
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

function readDate(record: BackendRecord, keys: string[]) {
  const value = readString(record, keys);
  if (!value) return new Date();

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function toQueryString(params: Record<string, unknown>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    searchParams.set(key, String(value));
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

function unwrapList(response: unknown, keys: Array<keyof BackendListResponse>) {
  if (Array.isArray(response)) return response.filter(isRecord);
  if (!isRecord(response)) return [];

  for (const key of keys) {
    const list = (response as BackendListResponse)[key];
    if (Array.isArray(list)) return list.filter(isRecord);
    if (isRecord(list)) return [list];
  }

  return [response];
}

function unwrapSingle(response: unknown) {
  if (!isRecord(response)) return null;

  const nested = response.data ?? response.value ?? response.status ?? response.event;
  if (isRecord(nested)) return nested;

  return response;
}

function normalizeStatus(value?: string): ConnectionStatus {
  const normalized = value?.toLowerCase();
  if (normalized === "offline" || normalized === "down" || normalized === "disconnected") return "offline";
  if (normalized === "degraded" || normalized === "warning" || normalized === "failover") return "degraded";
  return "connected";
}

function normalizeDataSource(value?: string): DataSource {
  const normalized = value?.toLowerCase();
  return normalized === "backup" || normalized === "secondary" || normalized === "lora" ? "backup" : "primary";
}

function normalizeSeverity(value?: string): EventSeverity {
  const normalized = value?.toLowerCase();
  if (normalized === "critical" || normalized === "error") return "critical";
  if (normalized === "warning" || normalized === "warn" || normalized === "degraded") return "warning";
  return "info";
}

function normalizeConnectionStatus(record: BackendRecord, index = 0): ConnectionStatusRecord {
  const status = normalizeStatus(readString(record, ["status", "state", "connectionStatus", "connection_status"]));
  const dataSource = normalizeDataSource(readString(record, ["dataSource", "data_source", "source", "activeSource", "active_source"]));

  return {
    id: readString(record, ["id", "_id", "statusId", "status_id"]) ?? `connection-status-${index}`,
    status,
    latency: readNumber(record, ["latency", "latencyMs", "latency_ms", "rttMs", "rtt_ms"]) ?? 0,
    packetLoss: readNumber(record, ["packetLoss", "packet_loss", "packetLossPercent", "packet_loss_percent"]) ?? 0,
    lastReceived: readDate(record, ["lastReceived", "last_received", "timestamp", "time", "updatedAt", "updated_at", "createdAt", "created_at"]),
    dataSource,
    message: readString(record, ["message", "summary", "description", "note"]),
    raw: record,
  };
}

function normalizeFailoverEvent(record: BackendRecord, index = 0): FailoverEventRecord {
  const source = readString(record, ["source", "fromSource", "from_source", "activeSource", "active_source"]);
  const target = readString(record, ["target", "toSource", "to_source", "fallbackSource", "fallback_source"]);
  const routeMessage = [source, target].filter(Boolean).join(" to ");
  const message =
    readString(record, ["message", "summary", "description", "reason"]) ??
    (routeMessage || "Failover event recorded.");

  return {
    id: readString(record, ["id", "_id", "eventId", "event_id", "failoverEventId", "failover_event_id"]) ?? `failover-event-${index}`,
    timestamp: readDate(record, ["timestamp", "time", "createdAt", "created_at", "updatedAt", "updated_at"]),
    severity: normalizeSeverity(readString(record, ["severity", "level", "status", "state"])),
    message,
    source: normalizeDataSource(target ?? source),
    raw: record,
  };
}

function latestStatus(records: ConnectionStatusRecord[]) {
  return [...records].sort((left, right) => right.lastReceived.getTime() - left.lastReceived.getTime())[0] ?? null;
}

export function connectionStatusToState(record: ConnectionStatusRecord): ConnectionState {
  return {
    status: record.status,
    latency: record.latency,
    packetLoss: record.packetLoss,
    lastReceived: record.lastReceived,
    dataSource: record.dataSource,
  };
}

export function failoverRecordToEvent(record: FailoverEventRecord): Event {
  return {
    id: `failover-${record.id}`,
    timestamp: record.timestamp,
    severity: record.severity,
    type: "failover",
    message: record.message,
    source: record.source,
  };
}

export async function getConnectionStatus(
  token: string,
  query: ConnectionStatusQuery = {}
): Promise<ConnectionStatusRecord[]> {
  const response = await apiRequest<unknown>(`/api/connection-status${toQueryString(query)}`, {
    method: "GET",
    token,
  });

  return unwrapList(response, ["statuses", "items", "data", "value", "results"]).map(normalizeConnectionStatus);
}

export const getConnectionStatuses = getConnectionStatus;

export async function getCurrentConnectionStatus(
  token: string,
  query: ConnectionStatusQuery = {}
): Promise<ConnectionStatusRecord | null> {
  return latestStatus(await getConnectionStatus(token, query));
}

export async function getConnectionStatusById(token: string, id: string): Promise<ConnectionStatusRecord | null> {
  const response = await apiRequest<unknown>(`/api/connection-status/${id}`, {
    method: "GET",
    token,
  });
  const record = unwrapSingle(response);

  return record ? normalizeConnectionStatus(record) : null;
}

export async function getFailoverEvents(
  token: string,
  query: FailoverEventsQuery = {}
): Promise<FailoverEventRecord[]> {
  const response = await apiRequest<unknown>(`/api/failover-events${toQueryString(query)}`, {
    method: "GET",
    token,
  });

  return unwrapList(response, ["events", "items", "data", "value", "results"]).map(normalizeFailoverEvent);
}

export async function getFailoverEventById(token: string, id: string): Promise<FailoverEventRecord | null> {
  const response = await apiRequest<unknown>(`/api/failover-events/${id}`, {
    method: "GET",
    token,
  });
  const record = unwrapSingle(response);

  return record ? normalizeFailoverEvent(record) : null;
}
