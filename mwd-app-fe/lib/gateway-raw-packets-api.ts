import { apiRequest } from "@/lib/api-client";

type BackendRecord = Record<string, unknown>;

type BackendListResponse = {
  value?: unknown;
  data?: unknown;
  items?: unknown;
  packets?: unknown;
  results?: unknown;
};

export type GatewayRawPacket = {
  id: string;
  sessionId?: string;
  packet?: string;
  source?: string;
  transmitterId?: string;
  receivedAt?: string;
  status?: string;
  rssi?: number;
  snr?: number;
  sequence?: string;
  parseStatus?: string;
  error?: string;
  raw: BackendRecord;
};

function isRecord(value: unknown): value is BackendRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(record: BackendRecord, keys: string[]) {
  for (const key of keys) {
    const value = readValue(record, key);
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return undefined;
}

function readNumber(record: BackendRecord, keys: string[]) {
  for (const key of keys) {
    const value = readValue(record, key);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return undefined;
}

function readValue(record: BackendRecord, key: string) {
  if (!key.includes(".")) return record[key];

  return key.split(".").reduce<unknown>((current, part) => {
    if (!isRecord(current)) return undefined;
    return current[part];
  }, record);
}

function unwrapList(response: unknown) {
  if (Array.isArray(response)) return response.filter(isRecord);
  if (!isRecord(response)) return [];

  for (const key of ["packets", "items", "data", "value", "results"] satisfies Array<keyof BackendListResponse>) {
    const value = (response as BackendListResponse)[key];
    if (Array.isArray(value)) return value.filter(isRecord);
    if (isRecord(value)) return [value];
  }

  return [];
}

function unwrapSingle(response: unknown) {
  const list = unwrapList(response);
  if (list[0]) return list[0];
  return isRecord(response) ? response : null;
}

function normalizePacket(record: BackendRecord, index: number): GatewayRawPacket {
  const packet = readString(record, ["packet", "rawPacket", "raw_packet", "raw", "line", "lastLine", "last_line", "payload", "lastPayload", "last_payload", "message", "lastRawMessage", "last_raw_message"]);
  const receivedAt = readString(record, ["receivedAt", "received_at", "timestamp", "time", "createdAt", "created_at"]);
  const id = readString(record, ["id", "_id", "packetId", "packet_id"]) ?? `${receivedAt ?? "packet"}-${index}`;

  return {
    id,
    sessionId: readString(record, ["sessionId", "session_id", "mwdSessionId", "mwd_session_id"]),
    packet,
    receivedAt,
    source: readString(record, ["source", "gateway", "port", "device", "deviceId", "device_id"]),
    transmitterId: readString(record, ["transmitterId", "transmitter_id", "txId", "tx_id", "deviceId", "device_id"]),
    status: readString(record, ["status", "state"]),
    rssi: readNumber(record, ["rssi", "signal.rssi", "signalRssi", "signal_rssi"]),
    snr: readNumber(record, ["snr", "signal.snr", "signalSnr", "signal_snr"]),
    sequence: readString(record, ["sequence", "seq", "signal.sequence", "signal.seq"]),
    parseStatus: readString(record, ["parseStatus", "parse_status", "parsedStatus", "decodeStatus", "decode_status"]),
    error: readString(record, ["error", "lastError", "last_error", "parseError", "parse_error"]),
    raw: record,
  };
}

export type GatewayRawPacketQuery = {
  limit?: number;
  sessionId?: string | number;
};

export async function getGatewayRawPackets(
  token: string,
  query: number | GatewayRawPacketQuery = 1
): Promise<GatewayRawPacket[]> {
  const options = typeof query === "number" ? { limit: query } : query;
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(options.limit ?? 1));
  if (options.sessionId !== undefined && options.sessionId !== null && String(options.sessionId).trim()) {
    searchParams.set("sessionId", String(options.sessionId));
  }

  const response = await apiRequest<unknown>(`/api/gateway-raw-packets?${searchParams.toString()}`, {
    method: "GET",
    token,
  });

  return unwrapList(response).map(normalizePacket);
}

export async function getGatewayRawPacketById(token: string, id: string): Promise<GatewayRawPacket> {
  const response = await apiRequest<unknown>(`/api/gateway-raw-packets/${encodeURIComponent(id)}`, {
    method: "GET",
    token,
  });
  const record = unwrapSingle(response);

  if (!record) {
    throw new Error("Backend returned an empty gateway raw packet detail response.");
  }

  return normalizePacket(record, 0);
}
