import { apiRequest } from "@/lib/api-client";

type BackendRecord = Record<string, unknown>;

type BackendListResponse = {
  value?: unknown;
  data?: unknown;
  items?: unknown;
  ports?: unknown;
  results?: unknown;
};

export type SerialPortInfo = {
  path: string;
  label: string;
  manufacturer?: string;
  serialNumber?: string;
  raw: BackendRecord;
};

export type SerialConnectPayload = {
  sessionId: string | number;
  port: string;
  baudRate?: number;
};

export type SerialStatus = {
  connected: boolean;
  status: "connected" | "connecting" | "disconnected" | "error" | string;
  port?: string;
  lastReceivedAt?: string;
  message?: string;
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
      if (normalized === "true" || normalized === "connected") return true;
      if (normalized === "false" || normalized === "disconnected") return false;
    }
  }

  return undefined;
}

function unwrapList(response: unknown, keys: Array<keyof BackendListResponse>) {
  if (Array.isArray(response)) return response.filter(isRecord);
  if (!isRecord(response)) return [];

  for (const key of keys) {
    const value = (response as BackendListResponse)[key];
    if (Array.isArray(value)) return value.filter(isRecord);
    if (isRecord(value)) return [value];
  }

  return [];
}

function unwrapSingle(response: unknown) {
  if (!isRecord(response)) return null;

  const nested = response.data ?? response.value ?? response.status;
  return isRecord(nested) ? nested : response;
}

function normalizeSerialPort(record: BackendRecord, index = 0): SerialPortInfo | null {
  const path = readString(record, ["path", "port", "name", "comName", "com_name", "device"]);
  if (!path) return null;

  const manufacturer = readString(record, ["manufacturer", "vendor", "vendorName", "vendor_name"]);
  const serialNumber = readString(record, ["serialNumber", "serial_number", "serialNo", "serial_no"]);
  const label = [path, manufacturer, serialNumber].filter(Boolean).join(" - ") || `Serial Port ${index + 1}`;

  return {
    path,
    label,
    manufacturer,
    serialNumber,
    raw: record,
  };
}

function normalizeSerialStatus(record: BackendRecord): SerialStatus {
  const enabled = readBoolean(record, ["enabled", "isEnabled", "is_enabled"]) ?? true;
  const connected = readBoolean(record, ["connected", "isConnected", "is_connected", "status", "state"]) ?? false;
  const reconnecting = readBoolean(record, ["reconnecting", "isReconnecting", "is_reconnecting"]) ?? false;
  const status =
    readString(record, ["status", "state", "connectionStatus", "connection_status"]) ??
    (!enabled ? "disabled" : connected ? "connected" : reconnecting ? "reconnecting" : "disconnected");

  return {
    connected,
    status,
    port: readString(record, ["port", "path", "device"]),
    lastReceivedAt: readString(record, ["lastReceivedAt", "last_received_at", "lastReceived", "last_received", "updatedAt", "updated_at"]),
    message: readString(record, ["message", "error", "reason", "description"]),
    raw: record,
  };
}

export async function getSerialPorts(token: string): Promise<SerialPortInfo[]> {
  const response = await apiRequest<unknown>("/api/serial/ports", {
    method: "GET",
    token,
  });

  return unwrapList(response, ["ports", "items", "data", "value", "results"])
    .map(normalizeSerialPort)
    .filter((port): port is SerialPortInfo => Boolean(port));
}

export async function connectSerialPort(
  token: string,
  payload: SerialConnectPayload
): Promise<SerialStatus> {
  const body = {
    sessionId: payload.sessionId,
    port: payload.port,
    ...(typeof payload.baudRate === "number" && Number.isFinite(payload.baudRate)
      ? { baudRate: payload.baudRate }
      : {}),
  };
  const response = await apiRequest<unknown>("/api/serial/connect", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
  const record = unwrapSingle(response);

  return normalizeSerialStatus(record ?? { status: "connecting", connected: true, port: payload.port });
}

export async function getSerialStatus(token: string): Promise<SerialStatus> {
  const response = await apiRequest<unknown>("/api/serial/status", {
    method: "GET",
    token,
  });
  const record = unwrapSingle(response);

  if (!record) {
    throw new Error("Backend returned empty serial status.");
  }

  return normalizeSerialStatus(record);
}
