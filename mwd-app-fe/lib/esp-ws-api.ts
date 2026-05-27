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
  const status = readString(record, ["status", "state", "connectionStatus", "connection_status"]) ?? "disconnected";
  const connected = readBoolean(record, ["connected", "isConnected", "is_connected", "status", "state"]) ?? status === "connected";

  return {
    connected,
    status,
    lastReceivedAt: readString(record, ["lastReceivedAt", "last_received_at", "lastReceived", "last_received", "updatedAt", "updated_at"]),
    clientCount: readNumber(record, ["clientCount", "client_count", "clients", "connections"]),
    message: readString(record, ["message", "error", "reason", "description"]),
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
