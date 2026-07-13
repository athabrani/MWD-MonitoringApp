import { apiRequest } from "@/lib/api-client";

type BackendRecord = Record<string, unknown>;

export type EspWsStatus = {
  connected: boolean;
  status: "connected" | "connecting" | "disconnected" | "error" | string;
  reconnecting?: boolean;
  lastReceivedAt?: string;
  lastError?: string | null;
  clientCount?: number;
  message?: string;
  lastRawMessage?: string;
  lastPayload?: string;
  lastLine?: string;
  rawPacket?: string;
  signal?: {
    rssi?: number;
    snr?: number;
    sequence?: string;
    quality?: string;
  };
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
      const normalized = value.toLowerCase();
      if (normalized === "true" || normalized === "connected" || normalized === "open") return true;
      if (normalized === "false" || normalized === "disconnected" || normalized === "closed") return false;
    }
  }

  return undefined;
}

function unwrapSingle(response: unknown) {
  if (!isRecord(response)) return null;

  const nested = response.data ?? response.value ?? response.status;
  return isRecord(nested) ? nested : response;
}

function normalizeEspWsStatus(record: BackendRecord): EspWsStatus {
  const enabled = readBoolean(record, ["enabled", "isEnabled", "is_enabled"]) ?? true;
  const connected = readBoolean(record, ["connected", "isConnected", "is_connected", "status", "state"]) ?? false;
  const reconnecting = readBoolean(record, ["reconnecting", "isReconnecting", "is_reconnecting"]) ?? false;
  const status =
    readString(record, ["status", "state", "connectionStatus", "connection_status"]) ??
    (!enabled ? "disabled" : connected ? "connected" : reconnecting ? "reconnecting" : "disconnected");
  const signal = isRecord(record.signal) ? record.signal : {};

  return {
    connected,
    reconnecting,
    status,
    lastReceivedAt: readString(record, ["lastReceivedAt", "last_received_at", "lastReceived", "last_received", "updatedAt", "updated_at"]),
    clientCount: readNumber(record, ["clientCount", "client_count", "clients", "connections"]),
    message: readString(record, ["message", "error", "reason", "description"]),
    lastRawMessage: readString(record, ["lastRawMessage", "last_raw_message"]),
    lastPayload: readString(record, ["lastPayload", "last_payload", "payload"]),
    lastLine: readString(record, ["lastLine", "last_line", "line"]),
    rawPacket: readString(record, ["rawPacket", "raw_packet", "packet", "raw"]),
    signal: {
      rssi: readNumber(signal, ["rssi"]),
      snr: readNumber(signal, ["snr"]),
      sequence: readString(signal, ["sequence", "seq"]),
      quality: readString(signal, ["quality"]),
    },
    raw: record,
  };
}

export async function getEspWsStatus(token: string): Promise<EspWsStatus> {
  const response = await apiRequest<unknown>("/api/esp-ws/status", {
    method: "GET",
    token,
  });
  const record = unwrapSingle(response);

  if (!record) {
    throw new Error("Backend returned empty ESP websocket status.");
  }

  return normalizeEspWsStatus(record);
}
