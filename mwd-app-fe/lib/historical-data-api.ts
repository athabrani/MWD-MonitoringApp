import { apiRequest } from "@/lib/api-client";
import { logSecurityDebug } from "@/lib/security/errors";
import {
  normalizeMwdDataRecord,
  type GetHistoricalDataOptions,
  type MwdDataRecord,
} from "@/lib/mwd-data-api";
import type { WitsDataValue } from "@/lib/api/wits";

type BackendHistoricalRecord = Record<string, unknown>;

type BackendHistoricalResponse = {
  value?: BackendHistoricalRecord[] | BackendHistoricalRecord;
  data?: BackendHistoricalRecord[] | BackendHistoricalRecord;
  items?: BackendHistoricalRecord[] | BackendHistoricalRecord;
  results?: BackendHistoricalRecord[] | BackendHistoricalRecord;
  records?: BackendHistoricalRecord[] | BackendHistoricalRecord;
  rows?: BackendHistoricalRecord[] | BackendHistoricalRecord;
  Count?: number;
  count?: number;
};

export type HistoricalDataQuery = GetHistoricalDataOptions & {
  witsId?: string;
  limit?: number;
};

export type HistoricalRecordSource = "/api/historical-data" | "/api/wits-data-values";

export type HistoricalRecord = {
  id: string;
  sourceEndpoint: HistoricalRecordSource;
  sessionId?: string;
  timestamp: Date;
  depth?: number;
  parameterKey: string;
  parameterLabel: string;
  witsId?: string;
  mappedField?: string;
  value: number;
  unit?: string;
  source?: string;
  status?: string;
  raw: Record<string, unknown>;
};

const timestampKeys = [
  "timestamp",
  "timeStamp",
  "time",
  "dateTime",
  "datetime",
  "measuredAt",
  "measured_at",
  "measurementTime",
  "measurement_time",
  "recordedAt",
  "recorded_at",
  "receivedAt",
  "received_at",
  "serverTimestamp",
  "server_timestamp",
  "createdAt",
  "created_at",
];
const depthKeys = ["depth", "depthMd", "depth_md", "md", "measuredDepth", "measured_depth", "holeDepth", "hole_depth"];
const sessionKeys = ["sessionId", "session_id", "mwdSessionId", "mwd_session_id"];
const idKeys = ["id", "_id", "dataId", "mwdDataId", "historicalDataId", "historical_data_id"];
const statusKeys = ["status", "state", "quality", "qualityStatus", "quality_status"];
const sourceKeys = ["source", "dataSource", "data_source", "origin", "port"];
const parameterKeys = [
  "parameter",
  "parameterKey",
  "parameter_key",
  "parameterName",
  "parameter_name",
  "metric",
  "metricKey",
  "metric_key",
  "mappedField",
  "mapped_field",
  "field",
  "fieldName",
  "field_name",
  "name",
  "label",
  "mnemonic",
];
const valueKeys = ["value", "currentValue", "current_value", "parsedValue", "parsed_value", "rawValue", "raw_value"];
const witsIdKeys = ["witsId", "wits_id", "numericId", "numeric_id", "channel", "channelId"];
const unitKeys = ["unit", "units"];

const reservedWideKeys = new Set([
  ...timestampKeys,
  ...depthKeys,
  ...sessionKeys,
  ...idKeys,
  ...statusKeys,
  ...sourceKeys,
  ...parameterKeys,
  ...valueKeys,
  ...witsIdKeys,
  ...unitKeys,
]);

function isRecord(value: unknown): value is BackendHistoricalRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapRecordList(response: BackendHistoricalResponse | BackendHistoricalRecord[]) {
  if (Array.isArray(response)) return response;
  const list = response.value ?? response.data ?? response.items ?? response.results ?? response.records ?? response.rows;

  if (Array.isArray(list)) return list;
  if (isRecord(list)) return [list];

  return [];
}

function readString(record: BackendHistoricalRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return undefined;
}

function readNumber(record: BackendHistoricalRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    const parsed = toNumber(value);
    if (parsed !== undefined) return parsed;
  }

  return undefined;
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return undefined;
}

function readDate(record: BackendHistoricalRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    const date = toDate(value);
    if (date) return date;
  }

  return undefined;
}

function toDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const timestampMs = Math.abs(value) < 1_000_000_000_000 ? value * 1000 : value;
    const date = new Date(timestampMs);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return toDate(numeric);

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  return undefined;
}

function normalizeWitsId(value?: string) {
  if (!value) return undefined;
  return /^\d+$/.test(value) ? value.padStart(4, "0") : value;
}

export function getHistoricalParameterKey(input: { witsId?: string; mappedField?: string; parameter?: string }) {
  const witsId = normalizeWitsId(input.witsId);
  if (witsId) return `wits_${witsId}`;

  const source = input.mappedField ?? input.parameter ?? "value";
  return source.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "value";
}

function buildRecordId(input: {
  sourceEndpoint: HistoricalRecordSource;
  id?: string;
  timestamp: Date;
  depth?: number;
  parameterKey: string;
  value: number;
}) {
  if (input.id) return `${input.sourceEndpoint}:${input.id}:${input.parameterKey}`;
  const depth = typeof input.depth === "number" ? input.depth : "";
  return `${input.sourceEndpoint}:${input.timestamp.toISOString()}:${depth}:${input.parameterKey}:${input.value}`;
}

function normalizeNarrowHistoricalRecord(
  record: BackendHistoricalRecord,
  sourceEndpoint: HistoricalRecordSource
): HistoricalRecord | null {
  const timestamp = readDate(record, timestampKeys);
  const value = readNumber(record, valueKeys);

  if (!timestamp || value === undefined) return null;

  const witsId = normalizeWitsId(readString(record, witsIdKeys));
  const mappedField = readString(record, ["mappedField", "mapped_field"]);
  const parameter = readString(record, parameterKeys);
  const parameterKey = getHistoricalParameterKey({ witsId, mappedField, parameter });
  const parameterLabel = parameter ?? mappedField ?? witsId ?? parameterKey;
  const depth = readNumber(record, depthKeys);

  return {
    id: buildRecordId({
      sourceEndpoint,
      id: readString(record, idKeys),
      timestamp,
      depth,
      parameterKey,
      value,
    }),
    sourceEndpoint,
    sessionId: readString(record, sessionKeys),
    timestamp,
    depth,
    parameterKey,
    parameterLabel,
    witsId,
    mappedField,
    value,
    unit: readString(record, unitKeys),
    source: readString(record, sourceKeys),
    status: readString(record, statusKeys),
    raw: record,
  };
}

function mwdRecordToHistoricalRecords(record: MwdDataRecord, sourceEndpoint: HistoricalRecordSource): HistoricalRecord[] {
  return Object.entries(record.metrics).map(([metricKey, value]) => {
    const parameterKey = getHistoricalParameterKey({ parameter: metricKey });

    return {
      id: buildRecordId({
        sourceEndpoint,
        id: record.id,
        timestamp: record.timestamp,
        depth: record.depth,
        parameterKey,
        value,
      }),
      sourceEndpoint,
      sessionId: record.sessionId,
      timestamp: record.timestamp,
      depth: record.depth,
      parameterKey,
      parameterLabel: metricKey,
      mappedField: metricKey,
      value,
      source: readString(record.raw, sourceKeys),
      status: record.status,
      raw: record.raw,
    };
  });
}

function normalizeWideHistoricalRecord(
  record: BackendHistoricalRecord,
  sourceEndpoint: HistoricalRecordSource
): HistoricalRecord[] {
  const normalized = normalizeMwdDataRecord(record);
  if (normalized) {
    const records = mwdRecordToHistoricalRecords(normalized, sourceEndpoint);
    if (records.length > 0) return records;
  }

  const timestamp = readDate(record, timestampKeys);
  if (!timestamp) return [];

  const depth = readNumber(record, depthKeys);
  const sessionId = readString(record, sessionKeys);
  const status = readString(record, statusKeys);
  const source = readString(record, sourceKeys);

  const records: HistoricalRecord[] = [];

  for (const [key, rawValue] of Object.entries(record)) {
    if (reservedWideKeys.has(key)) continue;
    const value = toNumber(rawValue);
    if (value === undefined) continue;

    const parameterKey = getHistoricalParameterKey({ parameter: key });

    records.push({
      id: buildRecordId({
        sourceEndpoint,
        id: readString(record, idKeys),
        timestamp,
        depth,
        parameterKey,
        value,
      }),
      sourceEndpoint,
      sessionId,
      timestamp,
      depth,
      parameterKey,
      parameterLabel: key,
      mappedField: key,
      value,
      source,
      status,
      raw: record,
    });
  }

  return records;
}

export function normalizeHistoricalBackendRecord(
  record: BackendHistoricalRecord,
  sourceEndpoint: HistoricalRecordSource = "/api/historical-data"
) {
  const narrowRecord = normalizeNarrowHistoricalRecord(record, sourceEndpoint);
  if (narrowRecord) return [narrowRecord];

  return normalizeWideHistoricalRecord(record, sourceEndpoint);
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

export async function getHistoricalData(
  token: string,
  options: HistoricalDataQuery = {}
): Promise<HistoricalRecord[]> {
  const response = await apiRequest<BackendHistoricalResponse | BackendHistoricalRecord[]>(
    `/api/historical-data${toQueryString(options)}`,
    {
      method: "GET",
      token,
    }
  );

  const rawRecords = unwrapRecordList(response);
  const normalizedRecords = rawRecords.flatMap((record) =>
    normalizeHistoricalBackendRecord(record, "/api/historical-data")
  );
  const sampleRecord = rawRecords[0];

  logSecurityDebug("[Historical Data] GET /api/historical-data", {
    options,
    rawCount: rawRecords.length,
    normalizedCount: normalizedRecords.length,
    sampleKeys: sampleRecord ? Object.keys(sampleRecord).slice(0, 30) : [],
    normalizedSample: normalizedRecords[0]
      ? {
          sessionId: normalizedRecords[0].sessionId,
          timestamp: normalizedRecords[0].timestamp.toISOString(),
          depth: normalizedRecords[0].depth,
          parameterKey: normalizedRecords[0].parameterKey,
          witsId: normalizedRecords[0].witsId,
          value: normalizedRecords[0].value,
          unit: normalizedRecords[0].unit,
        }
      : null,
  });

  return normalizedRecords;
}

export function witsDataValueToHistoricalRecord(value: WitsDataValue): HistoricalRecord | null {
  if (!value.timestamp) return null;

  const witsId = normalizeWitsId(value.witsId);
  const parameterKey = getHistoricalParameterKey({
    witsId,
    mappedField: value.mappedField,
    parameter: value.label,
  });
  const parameterLabel = value.label ?? value.mappedField ?? witsId ?? parameterKey;

  return {
    id: buildRecordId({
      sourceEndpoint: "/api/wits-data-values",
      id: value.id,
      timestamp: value.timestamp,
      depth: value.depth,
      parameterKey,
      value: value.value,
    }),
    sourceEndpoint: "/api/wits-data-values",
    sessionId: value.sessionId,
    timestamp: value.timestamp,
    depth: value.depth,
    parameterKey,
    parameterLabel,
    witsId,
    mappedField: value.mappedField,
    value: value.value,
    unit: value.unit,
    source: value.source,
    raw: value.raw,
  };
}

export function witsDataValuesToHistoricalRecords(values: WitsDataValue[]) {
  return values
    .map(witsDataValueToHistoricalRecord)
    .filter((record): record is HistoricalRecord => Boolean(record));
}
