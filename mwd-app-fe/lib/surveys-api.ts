import { apiRequest } from "@/lib/api-client";
import { SurveyRecord } from "@/types/monitoring";

type BackendSurveyRecord = Record<string, unknown>;

type BackendSurveyResponse = {
  value?: BackendSurveyRecord[] | BackendSurveyRecord;
  data?: BackendSurveyRecord[] | BackendSurveyRecord;
  items?: BackendSurveyRecord[] | BackendSurveyRecord;
  results?: BackendSurveyRecord[] | BackendSurveyRecord;
  count?: number;
  Count?: number;
  importedCount?: number;
  skippedCount?: number;
  errors?: unknown;
};

export type SurveyInput = Record<string, unknown>;
export type SurveysQuery = {
  sessionId?: string | number;
  stationType?: "actual" | "plan";
};
export type GenerateSurveyFromMwdDataInput = {
  sessionId: string | number;
  stationType?: "actual" | "plan";
};

export type ImportSurveysCsvInput = {
  content: string;
  sessionId?: string | number;
  stationType?: "actual" | "plan";
  replace?: boolean;
  verticalSectionAzimuth?: number;
};

export type ImportSurveysCsvResult = {
  records: SurveyRecord[];
  importedCount: number;
  skippedCount: number;
  errors: string[];
};

function isRecord(value: unknown): value is BackendSurveyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapRecordList(response: BackendSurveyResponse | BackendSurveyRecord[]) {
  if (Array.isArray(response)) return response;
  const list = response.value ?? response.data ?? response.items ?? response.results;

  if (Array.isArray(list)) return list;
  if (isRecord(list)) return [list];

  return [];
}

function unwrapSingleRecord(response: BackendSurveyResponse | BackendSurveyRecord) {
  const list = unwrapRecordList(response);
  if (list[0]) return list[0];
  return isRecord(response) ? response : null;
}

function readString(record: BackendSurveyRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return undefined;
}

function readNumber(record: BackendSurveyRecord, keys: string[]) {
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

function readBoolean(record: BackendSurveyRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const lower = value.toLowerCase();
      if (lower === "true") return true;
      if (lower === "false") return false;
    }
  }

  return undefined;
}

function readDateString(record: BackendSurveyRecord, keys: string[]) {
  const value = readString(record, keys);
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function requireNumber(record: BackendSurveyRecord, keys: string[]) {
  const value = readNumber(record, keys);
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
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

export function normalizeSurveyRecord(record: BackendSurveyRecord): SurveyRecord | null {
  const id = readString(record, ["id", "_id", "surveyId", "survey_id"]);
  const md = readNumber(record, ["md", "measuredDepth", "measured_depth"]);
  const inc = readNumber(record, ["inc", "inclination"]);
  const azm = readNumber(record, ["azm", "azi", "azimuth"]);

  if (!id || md === undefined || inc === undefined || azm === undefined) {
    return null;
  }

  return {
    id,
    md,
    inc,
    azm,
    tvd: requireNumber(record, ["tvd", "trueVerticalDepth", "true_vertical_depth"]),
    ns: requireNumber(record, ["ns", "northing", "northSouth", "north_south"]),
    ew: requireNumber(record, ["ew", "easting", "eastWest", "east_west"]),
    dls: requireNumber(record, ["dls", "doglegSeverity", "dogleg_severity"]),
    vs: requireNumber(record, ["vs", "verticalSection", "vertical_section"]),
    buildRate: readNumber(record, ["buildRate", "build_rate", "build"]),
    turnRate: readNumber(record, ["turnRate", "turn_rate", "turn"]),
    closureDistance: readNumber(record, ["closureDistance", "closure_distance", "cl"]),
    closureAzimuth: readNumber(record, ["closureAzimuth", "closure_azimuth", "closureAzm"]),
    run: readNumber(record, ["run", "runNumber", "run_number"]),
    toolfaceMode: readString(record, ["toolfaceMode", "toolface_mode", "toolface"]) ?? "Unknown",
    timestamp:
      readDateString(record, ["timestamp", "time", "capturedAt", "captured_at", "createdAt", "created_at"]) ??
      new Date().toISOString(),
    isProjection: readBoolean(record, ["isProjection", "is_projection", "projection"]) ?? false,
    projectionMethod: readString(record, ["projectionMethod", "projection_method"]) as SurveyRecord["projectionMethod"],
  };
}

export function surveyRecordToPayload(
  record: SurveyRecord,
  sessionId?: string | number,
  stationType: "actual" | "plan" = "actual"
): SurveyInput {
  return {
    ...(sessionId ? { sessionId } : {}),
    stationType,
    md: record.md,
    measuredDepth: record.md,
    tvd: record.tvd,
    inclination: record.inc,
    azimuth: record.azm,
    northing: record.ns,
    easting: record.ew,
    doglegSeverity: record.dls,
    verticalSection: record.vs,
    buildRate: record.buildRate,
    turnRate: record.turnRate,
    closureDistance: record.closureDistance,
    closureAzimuth: record.closureAzimuth,
    run: record.run,
    toolfaceMode: record.toolfaceMode,
    timestamp: record.timestamp,
    isProjection: record.isProjection,
    projectionMethod: record.projectionMethod ?? null,
  };
}

export async function getSurveys(token: string, query: SurveysQuery = {}): Promise<SurveyRecord[]> {
  const response = await apiRequest<BackendSurveyResponse | BackendSurveyRecord[]>(`/api/surveys${toQueryString(query)}`, {
    method: "GET",
    token,
  });

  return unwrapRecordList(response)
    .map(normalizeSurveyRecord)
    .filter((record): record is SurveyRecord => Boolean(record));
}

export async function getSurveyById(token: string, surveyId: string): Promise<SurveyRecord> {
  const response = await apiRequest<BackendSurveyResponse | BackendSurveyRecord>(`/api/surveys/${surveyId}`, {
    method: "GET",
    token,
  });
  const rawRecord = unwrapSingleRecord(response);
  const record = rawRecord ? normalizeSurveyRecord(rawRecord) : null;

  if (!record) throw new Error("Backend returned survey without required MD/inc/azimuth fields.");
  return record;
}

export async function createSurvey(token: string, input: SurveyInput): Promise<SurveyRecord> {
  const response = await apiRequest<BackendSurveyResponse | BackendSurveyRecord>("/api/surveys", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
  const rawRecord = unwrapSingleRecord(response);
  const record = rawRecord ? normalizeSurveyRecord(rawRecord) : null;

  if (!record) throw new Error("Backend returned survey without required MD/inc/azimuth fields.");
  return record;
}

export async function updateSurvey(token: string, surveyId: string, input: SurveyInput): Promise<SurveyRecord> {
  const response = await apiRequest<BackendSurveyResponse | BackendSurveyRecord>(`/api/surveys/${surveyId}`, {
    method: "PUT",
    token,
    body: JSON.stringify(input),
  });
  const rawRecord = unwrapSingleRecord(response);
  const record = rawRecord ? normalizeSurveyRecord(rawRecord) : null;

  if (!record) throw new Error("Backend returned survey without required MD/inc/azimuth fields.");
  return record;
}

export async function deleteSurvey(token: string, surveyId: string): Promise<void> {
  await apiRequest<unknown>(`/api/surveys/${surveyId}`, {
    method: "DELETE",
    token,
  });
}

export async function createSurveysFromMwdData(
  token: string,
  input: GenerateSurveyFromMwdDataInput
): Promise<SurveyRecord[]> {
  const response = await apiRequest<BackendSurveyResponse | BackendSurveyRecord[]>("/api/surveys/from-mwd-data", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });

  return unwrapRecordList(response)
    .map(normalizeSurveyRecord)
    .filter((record): record is SurveyRecord => Boolean(record));
}

export async function recalculateSurveys(token: string, input: SurveyInput): Promise<SurveyRecord[]> {
  const response = await apiRequest<BackendSurveyResponse | BackendSurveyRecord[]>("/api/surveys/recalculate", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });

  return unwrapRecordList(response)
    .map(normalizeSurveyRecord)
    .filter((record): record is SurveyRecord => Boolean(record));
}

export async function importSurveysCsv(token: string, input: ImportSurveysCsvInput): Promise<SurveyRecord[]> {
  return (await importSurveysCsvDetailed(token, input)).records;
}

export async function importSurveysCsvDetailed(token: string, input: ImportSurveysCsvInput): Promise<ImportSurveysCsvResult> {
  const { content, ...query } = input;
  const response = await apiRequest<BackendSurveyResponse | BackendSurveyRecord[]>(
    `/api/surveys/well-plan/import-csv${toQueryString(query)}`,
    {
      method: "POST",
      token,
      headers: {
        "Content-Type": "text/plain",
      },
      body: content,
    }
  );

  const records = unwrapRecordList(response)
    .map(normalizeSurveyRecord)
    .filter((record): record is SurveyRecord => Boolean(record));

  return {
    records,
    importedCount: !Array.isArray(response) && typeof response.importedCount === "number" ? response.importedCount : records.length,
    skippedCount: !Array.isArray(response) && typeof response.skippedCount === "number" ? response.skippedCount : 0,
    errors:
      !Array.isArray(response) && Array.isArray(response.errors)
        ? response.errors.map((error) => String(error))
        : [],
  };
}
