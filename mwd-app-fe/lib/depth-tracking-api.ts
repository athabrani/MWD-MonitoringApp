import { apiRequest } from "@/lib/api-client";

type BackendRecord = Record<string, unknown>;

type BackendListResponse = {
  value?: unknown;
  data?: unknown;
  items?: unknown;
  samples?: unknown;
  results?: unknown;
};

export type DepthTrackingQuery = {
  sessionId?: string;
  measuredFrom?: string;
  measuredTo?: string;
  limit?: number;
};

export type DepthTrackingState = {
  sessionId?: string;
  status?: string;
  mode?: string;
  currentDepth?: number;
  bitDepth?: number;
  holeDepth?: number;
  blockDepth?: number;
  rop?: number;
  currentTime?: string;
  source?: string;
  updatedAt?: string;
  raw: BackendRecord;
};

export type DepthTrackingSample = {
  id: string;
  sessionId?: string;
  depth?: number;
  bitDepth?: number;
  holeDepth?: number;
  blockDepth?: number;
  rop?: number;
  measuredAt?: string;
  mode?: string;
  status?: string;
  source?: string;
  raw: BackendRecord;
};

export type DepthTrackingUpdatePayload = {
  sessionId: string | number;
  measuredAt: string;
  bitDepth?: number;
  holeDepth?: number;
  blockDepth?: number;
  rop?: number;
  mode?: string;
  status?: string;
  source: "manual";
  settings?: {
    note?: string;
  } & Record<string, unknown>;
};

export type DepthTrackingRecalculatePayload = {
  sessionId: string | number;
};

export type DepthTrackingMutationResult = {
  raw: unknown;
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

function toQueryString(params: Record<string, unknown>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    searchParams.set(key, String(value));
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

function unwrapSingle(response: unknown) {
  if (!isRecord(response)) return null;

  const nested = response.state ?? response.data ?? response.value;
  if (isRecord(nested)) return nested;

  return response;
}

function unwrapList(response: unknown) {
  if (Array.isArray(response)) return response.filter(isRecord);
  if (!isRecord(response)) return [];

  for (const key of ["samples", "items", "data", "value", "results"] satisfies Array<keyof BackendListResponse>) {
    const list = (response as BackendListResponse)[key];
    if (Array.isArray(list)) return list.filter(isRecord);
    if (isRecord(list)) return [list];
  }

  return [];
}

function normalizeState(record: BackendRecord): DepthTrackingState {
  const bitDepth = readNumber(record, ["bitDepth", "bit_depth"]);
  const holeDepth = readNumber(record, ["holeDepth", "hole_depth"]);
  const blockDepth = readNumber(record, ["blockDepth", "block_depth"]);

  return {
    sessionId: readString(record, ["sessionId", "session_id", "mwdSessionId", "mwd_session_id"]),
    status: readString(record, ["status", "state", "trackingStatus", "tracking_status"]),
    mode: readString(record, ["mode", "trackingMode", "tracking_mode", "sourceMode", "source_mode"]),
    currentDepth: readNumber(record, ["currentDepth", "current_depth", "depth"]) ?? bitDepth ?? holeDepth ?? blockDepth,
    bitDepth,
    holeDepth,
    blockDepth,
    rop: readNumber(record, ["rop", "rateOfPenetration", "rate_of_penetration"]),
    currentTime: readString(record, ["currentTime", "current_time", "measuredAt", "measured_at", "timestamp", "time"]),
    source: readString(record, ["source", "sourceName", "source_name", "provider"]),
    updatedAt: readString(record, ["updatedAt", "updated_at", "createdAt", "created_at"]),
    raw: record,
  };
}

function normalizeSample(record: BackendRecord, index: number): DepthTrackingSample {
  return {
    id: readString(record, ["id", "_id", "sampleId", "sample_id"]) ?? `depth-tracking-sample-${index}`,
    sessionId: readString(record, ["sessionId", "session_id", "mwdSessionId", "mwd_session_id"]),
    depth: readNumber(record, ["depth", "currentDepth", "current_depth", "measuredDepth", "measured_depth"]),
    bitDepth: readNumber(record, ["bitDepth", "bit_depth"]),
    holeDepth: readNumber(record, ["holeDepth", "hole_depth"]),
    blockDepth: readNumber(record, ["blockDepth", "block_depth"]),
    rop: readNumber(record, ["rop", "rateOfPenetration", "rate_of_penetration"]),
    measuredAt: readString(record, ["measuredAt", "measured_at", "timestamp", "time", "createdAt", "created_at"]),
    mode: readString(record, ["mode", "trackingMode", "tracking_mode"]),
    status: readString(record, ["status", "state", "trackingStatus", "tracking_status"]),
    source: readString(record, ["source", "sourceName", "source_name", "provider"]),
    raw: record,
  };
}

export async function getDepthTrackingState(
  token: string,
  query: DepthTrackingQuery = {}
): Promise<DepthTrackingState | null> {
  const response = await apiRequest<unknown>(`/api/depth-tracking/state${toQueryString(query)}`, {
    method: "GET",
    token,
  });
  const state = unwrapSingle(response);

  return state ? normalizeState(state) : null;
}

export async function getDepthTrackingSamples(
  token: string,
  query: DepthTrackingQuery = {}
): Promise<DepthTrackingSample[]> {
  const response = await apiRequest<unknown>(`/api/depth-tracking/samples${toQueryString(query)}`, {
    method: "GET",
    token,
  });

  return unwrapList(response).map(normalizeSample);
}

export async function updateDepthTracking(
  token: string,
  payload: DepthTrackingUpdatePayload
): Promise<DepthTrackingMutationResult> {
  const raw = await apiRequest<unknown>("/api/depth-tracking/update", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

  return { raw };
}

export async function recalculateDepthTracking(
  token: string,
  payload: DepthTrackingRecalculatePayload
): Promise<DepthTrackingMutationResult> {
  const raw = await apiRequest<unknown>("/api/depth-tracking/recalculate", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

  return { raw };
}
