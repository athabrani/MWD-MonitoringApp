import { apiRequest } from "@/lib/api-client";

type BackendRecord = Record<string, unknown>;

type BackendListResponse = {
  value?: unknown;
  data?: unknown;
  items?: unknown;
  files?: unknown;
  points?: unknown;
  correlations?: unknown;
  results?: unknown;
};

export type MemoryFilesQuery = {
  sessionId?: string;
};

export type MemoryFileRecord = {
  id: string;
  fileName: string;
  status?: string;
  uploadedAt?: string;
  pointCount?: number;
  fieldName?: string;
  raw: BackendRecord;
};

export type MemoryFilePoint = {
  id: string;
  timestamp?: string;
  depth?: number;
  value?: number;
  fieldName?: string;
  raw: BackendRecord;
};

export type MemoryFileCorrelation = {
  id: string;
  fileId?: string;
  status?: string;
  createdAt?: string;
  summary: string;
  matchedCount?: number;
  unmatchedCount?: number;
  updatedCount?: number;
  affectedRows?: number;
  previewRows: BackendRecord[];
  raw: BackendRecord;
};

export type MemoryFileImportPayload = {
  sessionId?: string | number;
  fileName: string;
  source?: string;
  content?: string;
  delimiter?: string;
  hasHeader?: boolean;
  depthField?: string;
  fieldMappings?: Record<string, string>;
  rows?: Array<Record<string, unknown>>;
};

export type MemoryFileFieldMapping = {
  source: string;
  target: string;
};

export type MemoryFileCorrelationPayload = {
  sessionId: string | number;
  mode: "depth" | "time";
  dryRun: boolean;
  fieldMappings: MemoryFileFieldMapping[];
  depthOffset?: number;
  maxDepthDifference?: number;
  measuredAtOffsetMs?: number;
  maxTimeDifferenceMs?: number;
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

function unwrapList(response: unknown, keys: Array<keyof BackendListResponse>) {
  if (Array.isArray(response)) return response.filter(isRecord);
  if (!isRecord(response)) return [];

  for (const key of keys) {
    const list = (response as BackendListResponse)[key];
    if (Array.isArray(list)) return list.filter(isRecord);
    if (isRecord(list)) return [list];
  }

  return [];
}

function unwrapSingle(response: unknown) {
  if (isRecord(response)) {
    const nested = response.data ?? response.value ?? response.file;
    if (isRecord(nested)) return nested;
    return response;
  }

  return null;
}

function unwrapCorrelationRows(response: BackendRecord) {
  const candidates = [
    response.matches,
    response.matched,
    response.preview,
    response.points,
    response.rows,
    response.items,
    response.results,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.filter(isRecord);
  }

  return [];
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

function normalizeMemoryFile(record: BackendRecord, index = 0): MemoryFileRecord {
  const id = readString(record, ["id", "_id", "fileId", "memoryFileId", "memory_file_id"]) ?? `memory-file-${index}`;
  return {
    id,
    fileName: readString(record, ["fileName", "file_name", "name", "originalName", "original_name"]) ?? id,
    status: readString(record, ["status", "state"]),
    uploadedAt: readString(record, ["uploadedAt", "uploaded_at", "createdAt", "created_at"]),
    pointCount: readNumber(record, ["pointCount", "point_count", "totalRows", "total_rows", "count"]),
    fieldName: readString(record, ["fieldName", "field_name", "field", "mappedField", "mapped_field"]),
    raw: record,
  };
}

function normalizeMemoryPoint(record: BackendRecord, index = 0): MemoryFilePoint {
  return {
    id: readString(record, ["id", "_id", "pointId", "memoryPointId"]) ?? `memory-point-${index}`,
    timestamp: readString(record, ["timestamp", "time", "measuredAt", "measured_at", "createdAt", "created_at"]),
    depth: readNumber(record, ["depth", "md", "measuredDepth", "measured_depth"]),
    value: readNumber(record, ["value", "rawValue", "raw_value"]),
    fieldName: readString(record, ["fieldName", "field_name", "field", "mappedField", "mapped_field"]),
    raw: record,
  };
}

function normalizeCorrelation(record: BackendRecord, index = 0): MemoryFileCorrelation {
  const id = readString(record, ["id", "_id", "correlationId"]) ?? `memory-correlation-${index}`;
  const fileName = readString(record, ["fileName", "file_name", "name"]);
  const fieldName = readString(record, ["fieldName", "field_name", "field"]);
  const affectedRows = readNumber(record, ["affectedRows", "affected_rows", "pointCount", "point_count", "count"]);
  const matchedCount = readNumber(record, ["matchedCount", "matched_count", "matches"]);
  const unmatchedCount = readNumber(record, ["unmatchedCount", "unmatched_count"]);
  const updatedCount = readNumber(record, ["updatedCount", "updated_count"]);
  const message = readString(record, ["message", "summary", "description"]);

  return {
    id,
    fileId: readString(record, ["fileId", "file_id", "memoryFileId", "memory_file_id"]),
    status: readString(record, ["status", "state"]),
    createdAt: readString(record, ["createdAt", "created_at", "timestamp", "time"]),
    summary: message || [fileName, fieldName, affectedRows === undefined ? "" : `${affectedRows} points`]
      .filter(Boolean)
      .join(" | ") || "No correlation summary returned.",
    matchedCount,
    unmatchedCount,
    updatedCount,
    affectedRows,
    previewRows: unwrapCorrelationRows(record),
    raw: record,
  };
}

export async function getMemoryFiles(
  token: string,
  query: MemoryFilesQuery = {}
): Promise<MemoryFileRecord[]> {
  const response = await apiRequest<unknown>(`/api/memory-files${toQueryString(query)}`, {
    method: "GET",
    token,
  });

  return unwrapList(response, ["files", "items", "data", "value", "results"]).map(normalizeMemoryFile);
}

export async function importMemoryFile(
  token: string,
  payload: MemoryFileImportPayload
): Promise<MemoryFileRecord> {
  const response = await apiRequest<unknown>("/api/memory-files/import", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
  const record = unwrapSingle(response);

  if (!record) {
    throw new Error("Backend returned memory file import without file metadata.");
  }

  return normalizeMemoryFile(record);
}

export async function getMemoryFile(token: string, id: string): Promise<MemoryFileRecord> {
  const response = await apiRequest<unknown>(`/api/memory-files/${id}`, {
    method: "GET",
    token,
  });
  const record = unwrapSingle(response);

  if (!record) {
    throw new Error("Backend returned memory file detail without file metadata.");
  }

  return normalizeMemoryFile(record);
}

export async function getMemoryFilePoints(token: string, id: string): Promise<MemoryFilePoint[]> {
  const response = await apiRequest<unknown>(`/api/memory-files/${id}/points`, {
    method: "GET",
    token,
  });

  return unwrapList(response, ["points", "items", "data", "value", "results"]).map(normalizeMemoryPoint);
}

export async function correlateMemoryFile(
  token: string,
  id: string,
  payload: MemoryFileCorrelationPayload
): Promise<MemoryFileCorrelation> {
  const response = await apiRequest<unknown>(`/api/memory-files/${id}/correlate`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
  const record = unwrapSingle(response);

  if (!record) {
    throw new Error("Backend returned memory correlation without result metadata.");
  }

  return normalizeCorrelation(record);
}

export async function getMemoryFileCorrelations(
  token: string,
  query: MemoryFilesQuery = {}
): Promise<MemoryFileCorrelation[]> {
  const response = await apiRequest<unknown>(`/api/memory-files/correlations${toQueryString(query)}`, {
    method: "GET",
    token,
  });

  return unwrapList(response, ["correlations", "items", "data", "value", "results"]).map(normalizeCorrelation);
}

export async function deleteMemoryFile(token: string, id: string): Promise<void> {
  await apiRequest<unknown>(`/api/memory-files/${id}`, {
    method: "DELETE",
    token,
  });
}
