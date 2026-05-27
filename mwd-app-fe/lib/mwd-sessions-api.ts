import { apiRequest } from "@/lib/api-client";
import { PolarisWellInformation } from "@/types/polaris";

type BackendMwdSession = Record<string, unknown>;

type BackendMwdSessionsResponse = {
  value?: BackendMwdSession[];
  data?: BackendMwdSession[];
  items?: BackendMwdSession[];
  Count?: number;
  count?: number;
};

export type MwdSessionStatus = "active" | "paused" | "completed" | "unknown" | string;

export type MwdSessionListItem = {
  id: string;
  name: string;
  sessionCode?: string;
  wellName?: string;
  rigName?: string;
  company?: string;
  jobNumber?: string;
  jobName?: string;
  runNumber?: string;
  status: MwdSessionStatus;
  startTime?: string;
  endTime?: string;
  operator?: string;
  createdAt?: string;
  updatedAt?: string;
  raw: BackendMwdSession;
};

export type MwdSessionInput = Record<string, unknown>;
export type WellJobSessionPayload = Pick<
  PolarisWellInformation,
  | "companyName"
  | "surveyCompany"
  | "siteName"
  | "wellName"
  | "jobName"
  | "jobNumber"
  | "operator"
  | "rigName"
  | "rigId"
  | "fieldName"
  | "apiOrUwi"
  | "afe"
  | "location"
  | "stateOrProvince"
  | "countyOrParish"
  | "country"
  | "startDate"
  | "endDate"
  | "startDepth"
  | "endDepth"
  | "drillingStatus"
  | "backupDatabaseToDashboard"
  | "dashboardContactName"
  | "dashboardContactEmail"
  | "dashboardContactSecondary"
  | "dashboardContactPhone"
  | "dashboardCoordinator"
  | "notes"
>;

function readString(record: BackendMwdSession, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return undefined;
}

function normalizeBackendMwdSession(session: BackendMwdSession): MwdSessionListItem | null {
  const id = readString(session, ["id", "_id", "sessionId", "mwdSessionId"]);

  if (!id) return null;

  const wellName = readString(session, ["wellName", "well", "well_name"]);
  const sessionCode = readString(session, ["sessionCode", "session_code", "code"]);
  const rigName = readString(session, ["rigName", "rig_name", "rig"]);
  const company = readString(session, ["company", "companyName", "company_name", "client"]);
  const jobNumber = readString(session, ["jobNumber", "job_number", "jobNo", "job_no"]);
  const jobName = readString(session, ["jobName", "job", "job_name"]);
  const runNumber = readString(session, ["runNumber", "runNo", "run", "run_number"]);
  const fallbackName = [sessionCode, wellName, rigName, company, jobNumber]
    .filter(Boolean)
    .join(" / ");

  return {
    id,
    name:
      readString(session, ["name", "sessionName", "title", "session_name"]) ||
      fallbackName ||
      `MWD Session ${id}`,
    sessionCode,
    wellName,
    rigName,
    company,
    jobNumber,
    jobName,
    runNumber,
    status: readString(session, ["status", "state"]) || "unknown",
    startTime: readString(session, ["startTime", "startedAt", "startDate", "started_at"]),
    endTime: readString(session, ["endTime", "endedAt", "endDate", "ended_at"]),
    operator: readString(session, ["operator", "operatorName", "company", "client"]),
    createdAt: readString(session, ["createdAt", "created_at"]),
    updatedAt: readString(session, ["updatedAt", "updated_at"]),
    raw: session,
  };
}

function readNumber(record: BackendMwdSession, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return undefined;
}

function readBoolean(record: BackendMwdSession, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const lower = value.toLowerCase();
      if (lower === "true") return true;
      if (lower === "false") return false;
    }
  }

  return undefined;
}

function toDateInputValue(value?: string) {
  if (!value) return undefined;
  const dateOnly = value.split("T")[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(dateOnly) ? dateOnly : value;
}

export function mwdSessionToWellJobInfo(
  session: MwdSessionListItem,
  fallback: PolarisWellInformation
): PolarisWellInformation {
  const raw = session.raw;
  const drillingStatus = readString(raw, ["drillingStatus", "drilling_status", "status"]);

  return {
    ...fallback,
    companyName: readString(raw, ["companyName", "company_name", "company"]) ?? fallback.companyName,
    surveyCompany: readString(raw, ["surveyCompany", "survey_company"]) ?? fallback.surveyCompany,
    siteName: readString(raw, ["siteName", "site_name", "site"]) ?? fallback.siteName,
    wellName: session.wellName ?? readString(raw, ["wellName", "well_name", "well"]) ?? fallback.wellName,
    jobName: session.jobName ?? readString(raw, ["jobName", "job_name", "job"]) ?? fallback.jobName,
    jobNumber: readString(raw, ["jobNumber", "job_number", "jobNo", "job_no"]) ?? fallback.jobNumber,
    operator: session.operator ?? readString(raw, ["operator", "operatorName", "operator_name"]) ?? fallback.operator,
    rigName: readString(raw, ["rigName", "rig_name", "rig"]) ?? fallback.rigName,
    rigId: readString(raw, ["rigId", "rig_id"]) ?? fallback.rigId,
    fieldName: readString(raw, ["fieldName", "field_name", "field"]) ?? fallback.fieldName,
    apiOrUwi: readString(raw, ["apiOrUwi", "api_or_uwi", "api", "uwi"]) ?? fallback.apiOrUwi,
    afe: readString(raw, ["afe", "afeNumber", "afe_number"]) ?? fallback.afe,
    location: readString(raw, ["location"]) ?? fallback.location,
    stateOrProvince:
      readString(raw, ["stateOrProvince", "state_or_province", "state", "province"]) ??
      fallback.stateOrProvince,
    countyOrParish:
      readString(raw, ["countyOrParish", "county_or_parish", "county", "parish"]) ??
      fallback.countyOrParish,
    country: readString(raw, ["country"]) ?? fallback.country,
    startDate:
      toDateInputValue(session.startTime) ??
      toDateInputValue(readString(raw, ["startDate", "start_date"])) ??
      fallback.startDate,
    endDate:
      toDateInputValue(session.endTime) ??
      toDateInputValue(readString(raw, ["endDate", "end_date"])) ??
      fallback.endDate,
    startDepth: readNumber(raw, ["startDepth", "start_depth"]) ?? fallback.startDepth,
    endDepth: readNumber(raw, ["endDepth", "end_depth"]) ?? fallback.endDepth,
    drillingStatus:
      drillingStatus === "Drilling" ||
      drillingStatus === "Circulating" ||
      drillingStatus === "Tripping" ||
      drillingStatus === "Surveying" ||
      drillingStatus === "Standby"
        ? drillingStatus
        : fallback.drillingStatus,
    backupDatabaseToDashboard:
      readBoolean(raw, ["backupDatabaseToDashboard", "backup_database_to_dashboard"]) ??
      fallback.backupDatabaseToDashboard,
    dashboardContactName:
      readString(raw, ["dashboardContactName", "dashboard_contact_name"]) ??
      fallback.dashboardContactName,
    dashboardContactEmail:
      readString(raw, ["dashboardContactEmail", "dashboard_contact_email"]) ??
      fallback.dashboardContactEmail,
    dashboardContactSecondary:
      readString(raw, ["dashboardContactSecondary", "dashboard_contact_secondary"]) ??
      fallback.dashboardContactSecondary,
    dashboardContactPhone:
      readString(raw, ["dashboardContactPhone", "dashboard_contact_phone"]) ??
      fallback.dashboardContactPhone,
    dashboardCoordinator:
      readString(raw, ["dashboardCoordinator", "dashboard_coordinator"]) ??
      fallback.dashboardCoordinator,
    notes: readString(raw, ["notes", "description"]) ?? fallback.notes,
  };
}

export function wellJobInfoToMwdSessionPayload(wellInfo: PolarisWellInformation): WellJobSessionPayload {
  return {
    companyName: wellInfo.companyName.trim(),
    surveyCompany: wellInfo.surveyCompany.trim(),
    siteName: wellInfo.siteName.trim(),
    wellName: wellInfo.wellName.trim(),
    jobName: wellInfo.jobName.trim(),
    jobNumber: wellInfo.jobNumber.trim(),
    operator: wellInfo.operator.trim(),
    rigName: wellInfo.rigName.trim(),
    rigId: wellInfo.rigId.trim(),
    fieldName: wellInfo.fieldName.trim(),
    apiOrUwi: wellInfo.apiOrUwi.trim(),
    afe: wellInfo.afe.trim(),
    location: wellInfo.location.trim(),
    stateOrProvince: wellInfo.stateOrProvince.trim(),
    countyOrParish: wellInfo.countyOrParish.trim(),
    country: wellInfo.country.trim(),
    startDate: wellInfo.startDate,
    endDate: wellInfo.endDate,
    startDepth: wellInfo.startDepth,
    endDepth: wellInfo.endDepth,
    drillingStatus: wellInfo.drillingStatus,
    backupDatabaseToDashboard: wellInfo.backupDatabaseToDashboard,
    dashboardContactName: wellInfo.dashboardContactName.trim(),
    dashboardContactEmail: wellInfo.dashboardContactEmail.trim(),
    dashboardContactSecondary: wellInfo.dashboardContactSecondary.trim(),
    dashboardContactPhone: wellInfo.dashboardContactPhone.trim(),
    dashboardCoordinator: wellInfo.dashboardCoordinator.trim(),
    notes: wellInfo.notes.trim(),
  };
}

function unwrapSessionList(response: BackendMwdSessionsResponse | BackendMwdSession[]) {
  if (Array.isArray(response)) return response;
  return response.value ?? response.data ?? response.items ?? [];
}

export async function getMwdSessions(token: string): Promise<MwdSessionListItem[]> {
  const response = await apiRequest<BackendMwdSessionsResponse | BackendMwdSession[]>("/api/mwd-sessions", {
    method: "GET",
    token,
  });

  return unwrapSessionList(response)
    .map(normalizeBackendMwdSession)
    .filter((session): session is MwdSessionListItem => Boolean(session));
}

export async function getMwdSessionById(
  token: string,
  sessionId: string
): Promise<MwdSessionListItem> {
  const response = await apiRequest<BackendMwdSession>(`/api/mwd-sessions/${sessionId}`, {
    method: "GET",
    token,
  });
  const session = normalizeBackendMwdSession(response);

  if (!session) {
    throw new Error("Backend returned an MWD session without a usable id.");
  }

  return session;
}

export async function createMwdSession(
  token: string,
  input: MwdSessionInput
): Promise<MwdSessionListItem> {
  const response = await apiRequest<BackendMwdSession>("/api/mwd-sessions", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
  const session = normalizeBackendMwdSession(response);

  if (!session) {
    throw new Error("Backend returned an MWD session without a usable id.");
  }

  return session;
}

export async function updateMwdSession(
  token: string,
  sessionId: string,
  input: MwdSessionInput
): Promise<MwdSessionListItem> {
  const response = await apiRequest<BackendMwdSession>(`/api/mwd-sessions/${sessionId}`, {
    method: "PUT",
    token,
    body: JSON.stringify(input),
  });
  const session = normalizeBackendMwdSession(response);

  if (!session) {
    throw new Error("Backend returned an MWD session without a usable id.");
  }

  return session;
}

export async function deleteMwdSession(token: string, sessionId: string): Promise<void> {
  await apiRequest<unknown>(`/api/mwd-sessions/${sessionId}`, {
    method: "DELETE",
    token,
  });
}
