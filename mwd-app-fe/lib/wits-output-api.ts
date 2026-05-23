import { apiRequest } from "@/lib/api-client";

type BackendRecord = Record<string, unknown>;

type BackendListResponse = {
  value?: unknown;
  data?: unknown;
  items?: unknown;
  queue?: unknown;
  results?: unknown;
};

export type WitsOutputQueueQuery = {
  sessionId?: string;
  targetPort?: string;
  status?: WitsOutputQueueStatus;
  witsId?: string;
  limit?: number;
};

export type WitsOutputQueueStatus = "queued" | "sent" | "failed" | "skipped";

export type WitsOutputQueueItem = {
  id: string;
  status?: WitsOutputQueueStatus;
  timestamp?: string;
  updatedAt?: string;
  source?: string;
  targetPort?: string;
  rawPacket: string;
  witsId?: string;
  rawValue?: string;
  parsedValue?: string;
  label?: string;
  reason?: string;
  message?: string;
  raw: BackendRecord;
};

export type GenerateLatestWitsOutputPayload = {
  sessionId: string | number;
};

export type UpdateWitsOutputStatusPayload = {
  status: WitsOutputQueueStatus;
  reason?: string;
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

function normalizeStatus(value?: string): WitsOutputQueueStatus | undefined {
  const normalized = value?.toLowerCase();

  if (
    normalized === "queued" ||
    normalized === "sent" ||
    normalized === "failed" ||
    normalized === "skipped"
  ) {
    return normalized;
  }

  return undefined;
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

function unwrapList(response: unknown) {
  if (Array.isArray(response)) return response.filter(isRecord);
  if (!isRecord(response)) return [];

  for (const key of ["queue", "items", "data", "value", "results"] satisfies Array<keyof BackendListResponse>) {
    const list = (response as BackendListResponse)[key];
    if (Array.isArray(list)) return list.filter(isRecord);
    if (isRecord(list)) return [list];
  }

  return [];
}

function normalizeQueueItem(record: BackendRecord, index: number): WitsOutputQueueItem {
  const rawPacket =
    readString(record, ["rawPacket", "raw_packet", "packet", "payload", "message", "witsPacket", "wits_packet"]) ??
    "";

  return {
    id: readString(record, ["id", "_id", "queueId", "queue_id", "outputId", "output_id"]) ?? `wits-output-${index}`,
    status: normalizeStatus(readString(record, ["status", "state", "queueStatus", "queue_status"])),
    timestamp: readString(record, ["timestamp", "time", "createdAt", "created_at", "updatedAt", "updated_at", "sentAt", "sent_at"]),
    updatedAt: readString(record, ["updatedAt", "updated_at", "sentAt", "sent_at"]),
    source: readString(record, ["source", "sourceName", "source_name"]),
    targetPort: readString(record, ["targetPort", "target_port", "port", "target", "destination", "outputPort", "output_port"]),
    rawPacket,
    witsId: readString(record, ["witsId", "wits_id", "mnemonic", "channel"]),
    rawValue: readString(record, ["rawValue", "raw_value", "value"]),
    parsedValue: readString(record, ["parsedValue", "parsed_value", "displayValue", "display_value"]),
    label: readString(record, ["label", "name", "parameter"]),
    reason: readString(record, ["reason", "failureReason", "failure_reason", "note"]),
    message: readString(record, ["message", "description", "summary"]),
    raw: record,
  };
}

export async function getWitsOutputQueue(
  token: string,
  query: WitsOutputQueueQuery = {}
): Promise<WitsOutputQueueItem[]> {
  const response = await apiRequest<unknown>(`/api/wits-output/queue${toQueryString(query)}`, {
    method: "GET",
    token,
  });

  return unwrapList(response).map(normalizeQueueItem);
}

export async function generateWitsOutputFromLatest(
  token: string,
  payload: GenerateLatestWitsOutputPayload
) {
  return apiRequest<unknown>("/api/wits-output/generate-from-latest", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function updateWitsOutputStatus(
  token: string,
  id: string,
  payload: UpdateWitsOutputStatusPayload
) {
  return apiRequest<unknown>(`/api/wits-output/${id}/status`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  });
}
