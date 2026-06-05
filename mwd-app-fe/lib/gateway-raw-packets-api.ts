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
  packet?: string;
  source?: string;
  receivedAt?: string;
  status?: string;
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
  const packet = readString(record, ["packet", "rawPacket", "raw_packet", "raw", "line", "payload"]);
  const receivedAt = readString(record, ["receivedAt", "received_at", "timestamp", "time", "createdAt", "created_at"]);
  const id = readString(record, ["id", "_id", "packetId", "packet_id"]) ?? `${receivedAt ?? "packet"}-${index}`;

  return {
    id,
    packet,
    receivedAt,
    source: readString(record, ["source", "gateway", "port"]),
    status: readString(record, ["status", "state"]),
    raw: record,
  };
}

export async function getGatewayRawPackets(token: string, limit = 1): Promise<GatewayRawPacket[]> {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(limit));

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
