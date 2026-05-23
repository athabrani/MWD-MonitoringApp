import { apiRequest } from "@/lib/api-client";

type BackendRecord = Record<string, unknown>;

type BackendListResponse = {
  value?: unknown;
  data?: unknown;
  items?: unknown;
  operations?: unknown;
  results?: unknown;
};

export type MwdEditOperation = {
  id: string;
  type: string;
  status?: string;
  userName?: string;
  createdAt?: string;
  depthRange?: string;
  summary: string;
  raw: BackendRecord;
};

export type MwdEditDepthRangePayload = {
  sessionId: string;
  depthMin: number;
  depthMax: number;
  note?: string;
};

export type MwdEditOperationsOptions = {
  sessionId?: string;
};

export type MwdEditMoveDepthPreviewQuery = Pick<
  MwdEditDepthRangePayload,
  "sessionId" | "depthMin" | "depthMax"
> & {
  targetStartDepth: number;
  includeHidden?: boolean;
};

export type MwdEditMoveDepthApplyPayload = MwdEditDepthRangePayload &
  (
    | {
        targetStartDepth: number;
        depthOffset?: never;
      }
    | {
        depthOffset: number;
        targetStartDepth?: never;
      }
  );

export type MwdEditCopyDepthPayload = Pick<
  MwdEditDepthRangePayload,
  "sessionId" | "depthMin" | "depthMax"
> & {
  targetStartDepth: number;
  measuredAtOffsetMs?: number;
  includeHidden?: boolean;
};

export type MwdEditRescalePayload = MwdEditDepthRangePayload & {
  field: string;
  scaleFactor: number;
  biasOffset: number;
  includeHidden?: boolean;
};

export type MwdEditPreviewResult = {
  rows: BackendRecord[];
  raw: unknown;
};

export type MwdEditApplyResult = {
  raw: unknown;
};

function isRecord(value: unknown): value is BackendRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getString(record: BackendRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return undefined;
}

function unwrapList(response: unknown): BackendRecord[] {
  if (Array.isArray(response)) return response.filter(isRecord);
  if (!isRecord(response)) return [];

  const list =
    (response as BackendListResponse).operations ??
    (response as BackendListResponse).results ??
    (response as BackendListResponse).items ??
    (response as BackendListResponse).data ??
    (response as BackendListResponse).value;

  if (Array.isArray(list)) return list.filter(isRecord);
  if (isRecord(list)) return [list];

  return [];
}

function formatDepthRange(record: BackendRecord) {
  const startDepth = record.depthMin ?? record.depth_min ?? record.startDepth ?? record.start_depth ?? record.fromDepth ?? record.from_depth;
  const endDepth = record.depthMax ?? record.depth_max ?? record.endDepth ?? record.end_depth ?? record.toDepth ?? record.to_depth;

  if (typeof startDepth === "number" && typeof endDepth === "number") {
    return `${startDepth} - ${endDepth}`;
  }

  if (typeof startDepth === "string" && typeof endDepth === "string") {
    return `${startDepth} - ${endDepth}`;
  }

  return undefined;
}

function normalizeOperation(record: BackendRecord, index: number): MwdEditOperation {
  const type = getString(record, ["type", "operation", "operationType", "action"]) ?? "edit";
  const createdAt = getString(record, ["createdAt", "created_at", "timestamp", "time"]);
  const depthRange = formatDepthRange(record);
  const affectedRows = record.affectedRows ?? record.affected_rows ?? record.count;
  const channel = getString(record, ["channelWitsId", "witsId", "wits_id", "channel"]);
  const summaryParts = [
    channel ? `WITS ${channel}` : "",
    depthRange ? `depth ${depthRange}` : "",
    typeof affectedRows === "number" ? `${affectedRows} rows` : "",
  ].filter(Boolean);

  return {
    id: getString(record, ["id", "_id", "operationId"]) ?? `${type}-${createdAt ?? index}`,
    type,
    status: getString(record, ["status", "state"]),
    userName: getString(record, ["userName", "user", "createdBy", "created_by"]),
    createdAt,
    depthRange,
    summary: summaryParts.join(" | ") || "No operation summary returned.",
    raw: record,
  };
}

function toQueryString(params: Record<string, unknown>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, String(item)));
      continue;
    }
    searchParams.set(key, String(value));
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

function previewResult(response: unknown): MwdEditPreviewResult {
  return {
    rows: unwrapList(response),
    raw: response,
  };
}

export async function getMwdEditOperations(
  token: string,
  options: MwdEditOperationsOptions = {}
): Promise<MwdEditOperation[]> {
  const response = await apiRequest<unknown>(`/api/mwd-data/edit/operations${toQueryString(options)}`, {
    method: "GET",
    token,
  });

  return unwrapList(response).map(normalizeOperation);
}

export async function hideMwdDepthRange(
  token: string,
  payload: MwdEditDepthRangePayload
): Promise<MwdEditApplyResult> {
  const raw = await apiRequest<unknown>("/api/mwd-data/edit/hide-range", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

  return { raw };
}

export async function unhideMwdDepthRange(
  token: string,
  payload: MwdEditDepthRangePayload
): Promise<MwdEditApplyResult> {
  const raw = await apiRequest<unknown>("/api/mwd-data/edit/unhide-range", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

  return { raw };
}

export async function deleteMwdDepthRange(
  token: string,
  payload: MwdEditDepthRangePayload
): Promise<MwdEditApplyResult> {
  const raw = await apiRequest<unknown>("/api/mwd-data/edit/delete-depth-range", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

  return { raw };
}

export async function previewMoveMwdDepth(
  token: string,
  params: MwdEditMoveDepthPreviewQuery
): Promise<MwdEditPreviewResult> {
  const raw = await apiRequest<unknown>(`/api/mwd-data/edit/move-depth${toQueryString(params)}`, {
    method: "GET",
    token,
  });

  return previewResult(raw);
}

export async function applyMoveMwdDepth(
  token: string,
  payload: MwdEditMoveDepthApplyPayload
): Promise<MwdEditApplyResult> {
  const raw = await apiRequest<unknown>("/api/mwd-data/edit/move-depth", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

  return { raw };
}

export async function previewCopyMwdDepth(
  token: string,
  params: MwdEditCopyDepthPayload
): Promise<MwdEditPreviewResult> {
  const raw = await apiRequest<unknown>(`/api/mwd-data/edit/copy-depth${toQueryString(params)}`, {
    method: "GET",
    token,
  });

  return previewResult(raw);
}

export async function applyCopyMwdDepth(
  token: string,
  payload: MwdEditCopyDepthPayload
): Promise<MwdEditApplyResult> {
  const raw = await apiRequest<unknown>("/api/mwd-data/edit/copy-depth", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

  return { raw };
}

export async function previewRescaleMwdData(
  token: string,
  params: MwdEditRescalePayload
): Promise<MwdEditPreviewResult> {
  const raw = await apiRequest<unknown>(`/api/mwd-data/edit/rescale${toQueryString(params)}`, {
    method: "GET",
    token,
  });

  return previewResult(raw);
}

export async function applyRescaleMwdData(
  token: string,
  payload: MwdEditRescalePayload
): Promise<MwdEditApplyResult> {
  const raw = await apiRequest<unknown>("/api/mwd-data/edit/rescale", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

  return { raw };
}
