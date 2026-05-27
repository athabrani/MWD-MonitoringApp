import { apiRequest } from "@/lib/api-client";
import { ChartDataPoint } from "@/types";

type BackendMwdDataRecord = Record<string, unknown>;

type BackendMwdDataResponse = {
  value?: BackendMwdDataRecord[] | BackendMwdDataRecord;
  data?: BackendMwdDataRecord[] | BackendMwdDataRecord;
  items?: BackendMwdDataRecord[] | BackendMwdDataRecord;
  Count?: number;
  count?: number;
};

export type MwdDataRecord = {
  id?: string;
  sessionId?: string;
  timestamp: Date;
  depth?: number;
  status?: string;
  metrics: Record<string, number>;
  raw: BackendMwdDataRecord;
};

export type MwdDataInput = Record<string, unknown>;

export type GetMwdDataOptions = {
  sessionId?: string | number;
  limit?: number;
  depthMin?: number;
  depthMax?: number;
};

export type GetHistoricalDataOptions = GetMwdDataOptions & {
  measuredFrom?: string;
  measuredTo?: string;
};

const timestampKeys = [
  "timestamp",
  "time",
  "dateTime",
  "datetime",
  "recordedAt",
  "recorded_at",
  "createdAt",
  "created_at",
];
const depthKeys = ["depth", "depthMd", "depth_md", "md", "measuredDepth", "measured_depth", "holeDepth", "hole_depth"];
const sessionKeys = ["sessionId", "session_id", "mwdSessionId", "mwd_session_id"];
const idKeys = ["id", "_id", "dataId", "mwdDataId"];
const statusKeys = ["status", "state"];

const metricAliases: Record<string, string> = {
  rateofpenetration: "rop",
  rop: "rop",
  weightonbit: "wob",
  weight_on_bit: "wob",
  wob: "wob",
  rotaryspeed: "rpm",
  rotary_speed: "rpm",
  rotationspeed: "rpm",
  rotation_speed: "rpm",
  downholerpm: "rpm",
  downhole_rpm: "rpm",
  rpm: "rpm",
  temperature: "temp",
  temp: "temp",
  standpipepressure: "spp",
  standpipe_pressure: "spp",
  spp: "spp",
  pumppressure: "spp",
  pump_pressure: "spp",
  pressure: "spp",
  flowrate: "flowrate",
  flow_rate: "flowrate",
  flowin: "flowIn",
  flow_in: "flowIn",
  flowout: "flowOut",
  flow_out: "flowOut",
  gamma: "gamma",
  gammaray: "gamma",
  gamma_ray: "gamma",
  gammacorrected: "gamma",
  inclination: "inc",
  inc: "inc",
  azimuth: "azi",
  azi: "azi",
  mudweight: "mudWeight",
  mud_weight: "mudWeight",
  toolface: "toolface",
  gravitytoolface: "gtf",
  gravity_toolface: "gtf",
  gtf: "gtf",
  magnetictoolface: "mtf",
  magnetic_toolface: "mtf",
  mtf: "mtf",
  bitdepth: "bitDepth",
  bit_depth: "bitDepth",
  depthmd: "depthMd",
  depth_md: "depthMd",
  measureddepth: "depthMd",
  measured_depth: "depthMd",
  holedpth: "holeDepth",
  holedepth: "holeDepth",
  hole_depth: "holeDepth",
  decoderpressure: "decoderPressure",
  decoder_pressure: "decoderPressure",
  mwdpressure: "mwdPressure",
  mwd_pressure: "mwdPressure",
  annularpressure: "annularPressure",
  annular_pressure: "annularPressure",
  battery: "batteryVoltage",
  batteryvoltage: "batteryVoltage",
  battery_voltage: "batteryVoltage",
  hookload: "hookLoad",
  hook_load: "hookLoad",
  ecd: "ecd",
  shock: "shock",
  vibration: "vibration",
};

function isRecord(value: unknown): value is BackendMwdDataRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unwrapRecordList(response: BackendMwdDataResponse | BackendMwdDataRecord[]) {
  if (Array.isArray(response)) return response;
  const list = response.value ?? response.data ?? response.items;

  if (Array.isArray(list)) return list;
  if (isRecord(list)) return [list];

  return [];
}

function unwrapSingleRecord(response: BackendMwdDataResponse | BackendMwdDataRecord) {
  const list = unwrapRecordList(response);
  if (list[0]) return list[0];
  return isRecord(response) ? response : null;
}

function readString(record: BackendMwdDataRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return undefined;
}

function readNumber(record: BackendMwdDataRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    const numericValue = toNumber(value);
    if (numericValue !== undefined) return numericValue;
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

function toTimestamp(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  return undefined;
}

function normalizeMetricKey(key: string) {
  const compactKey = key.replace(/[\s_-]/g, "").toLowerCase();
  return metricAliases[compactKey] ?? metricAliases[key] ?? key;
}

function isReservedKey(key: string) {
  return [...timestampKeys, ...depthKeys, ...sessionKeys, ...idKeys, ...statusKeys].includes(key);
}

export function normalizeMwdDataRecord(record: BackendMwdDataRecord): MwdDataRecord | null {
  const timestamp = timestampKeys.map((key) => toTimestamp(record[key])).find(Boolean);
  const metrics: Record<string, number> = {};

  if (!timestamp) {
    return null;
  }

  for (const [key, value] of Object.entries(record)) {
    if (isReservedKey(key)) continue;

    const numericValue = toNumber(value);
    if (numericValue !== undefined) {
      metrics[normalizeMetricKey(key)] = numericValue;
    }
  }

  if (Object.keys(metrics).length === 0 && readNumber(record, depthKeys) === undefined) {
    return null;
  }

  return {
    id: readString(record, idKeys),
    sessionId: readString(record, sessionKeys),
    timestamp,
    depth: readNumber(record, depthKeys),
    status: readString(record, statusKeys),
    metrics,
    raw: record,
  };
}

export function getLatestMwdDataRecord(records: MwdDataRecord[]) {
  return records.reduce<MwdDataRecord | null>((latest, record) => {
    if (!latest) return record;
    return record.timestamp.getTime() > latest.timestamp.getTime() ? record : latest;
  }, null);
}

export function mwdDataRecordsToChartData(records: MwdDataRecord[]): ChartDataPoint[] {
  return records
    .map((record) => ({
      timestamp: record.timestamp,
      depth: record.depth,
      ...record.metrics,
    }))
    .sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
}

export function filterMwdDataForSession(records: MwdDataRecord[], sessionId?: string | number) {
  if (!sessionId) return records;
  const requestedSessionId = String(sessionId);
  const recordsWithSession = records.filter((record) => record.sessionId);
  if (recordsWithSession.length === 0) return records;
  const sessionScoped = records.filter((record) => String(record.sessionId) === requestedSessionId);
  return sessionScoped;
}

export function filterMwdDataByDateRange(
  records: MwdDataRecord[],
  startDate?: Date,
  endDate?: Date
) {
  if (!startDate && !endDate) return records;

  const startMs = startDate
    ? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime()
    : Number.NEGATIVE_INFINITY;
  const endMs = endDate
    ? new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999).getTime()
    : Number.POSITIVE_INFINITY;

  if (!Number.isFinite(startMs) && !Number.isFinite(endMs)) return records;

  return records.filter((record) => {
    const timestampMs = record.timestamp.getTime();
    return Number.isFinite(timestampMs) && timestampMs >= startMs && timestampMs <= endMs;
  });
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

export async function getMwdData(
  token: string,
  options: GetMwdDataOptions = {}
): Promise<MwdDataRecord[]> {
  const response = await apiRequest<BackendMwdDataResponse | BackendMwdDataRecord[]>(`/api/mwd-data${toQueryString(options)}`, {
    method: "GET",
    token,
  });

  return unwrapRecordList(response)
    .map(normalizeMwdDataRecord)
    .filter((record): record is MwdDataRecord => Boolean(record));
}

export async function getMwdDataById(token: string, dataId: string): Promise<MwdDataRecord> {
  const response = await apiRequest<BackendMwdDataResponse | BackendMwdDataRecord>(`/api/mwd-data/${dataId}`, {
    method: "GET",
    token,
  });
  const rawRecord = unwrapSingleRecord(response);
  const record = rawRecord ? normalizeMwdDataRecord(rawRecord) : null;

  if (!record) {
    throw new Error("Backend returned MWD data without timestamp/depth/metric values.");
  }

  return record;
}

export async function createMwdData(token: string, input: MwdDataInput): Promise<MwdDataRecord> {
  const response = await apiRequest<BackendMwdDataResponse | BackendMwdDataRecord>("/api/mwd-data", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
  const rawRecord = unwrapSingleRecord(response);
  const record = rawRecord ? normalizeMwdDataRecord(rawRecord) : null;

  if (!record) {
    throw new Error("Backend returned MWD data without timestamp/depth/metric values.");
  }

  return record;
}

export async function postRawMwdData(token: string, input: MwdDataInput): Promise<void> {
  await apiRequest<unknown>("/api/mwd-data", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export async function updateMwdData(
  token: string,
  dataId: string,
  input: MwdDataInput
): Promise<MwdDataRecord> {
  const response = await apiRequest<BackendMwdDataResponse | BackendMwdDataRecord>(`/api/mwd-data/${dataId}`, {
    method: "PUT",
    token,
    body: JSON.stringify(input),
  });
  const rawRecord = unwrapSingleRecord(response);
  const record = rawRecord ? normalizeMwdDataRecord(rawRecord) : null;

  if (!record) {
    throw new Error("Backend returned MWD data without timestamp/depth/metric values.");
  }

  return record;
}

export async function deleteMwdData(token: string, dataId: string): Promise<void> {
  await apiRequest<unknown>(`/api/mwd-data/${dataId}`, {
    method: "DELETE",
    token,
  });
}

export async function getHistoricalData(
  token: string,
  options: GetHistoricalDataOptions = {}
): Promise<MwdDataRecord[]> {
  const response = await apiRequest<BackendMwdDataResponse | BackendMwdDataRecord[]>(
    `/api/historical-data${toQueryString(options)}`,
    {
      method: "GET",
      token,
    }
  );

  return unwrapRecordList(response)
    .map(normalizeMwdDataRecord)
    .filter((record): record is MwdDataRecord => Boolean(record));
}
