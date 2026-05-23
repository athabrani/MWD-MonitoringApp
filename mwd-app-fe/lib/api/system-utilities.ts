import { apiRequest } from "@/lib/api-client";

type BackendRecord = Record<string, unknown>;

type TargetsResponse = {
  data?: unknown;
  value?: unknown;
  items?: unknown;
  targets?: unknown;
};

export type ClearDataPayload = {
  sessionId: string;
  startDepth: number;
  endDepth: number;
  targets: string[];
};

export type ClearDataPreviewResponse = {
  message?: string;
  requiredConfirm: string;
  counts: Record<string, number>;
  raw: unknown;
};

export type BackupResponse = {
  message?: string;
  counts?: Record<string, number>;
  backup: BackendRecord;
  raw: unknown;
};

export type ClearDataApplyPayload = ClearDataPayload & {
  confirm: string;
};

export type RestoreSessionPayload = {
  sessionId: string;
  replaceExisting: boolean;
  targets: string[];
  backup: BackendRecord;
  confirm: string;
};

export type ConfigBackupPayload = {
  targets: string[];
};

export type ConfigRestorePayload = ConfigBackupPayload & {
  backup: BackendRecord;
  confirm: "RESTORE_CONFIGURATION";
};

function isRecord(value: unknown): value is BackendRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unwrapTargets(response: unknown) {
  if (Array.isArray(response)) return response.filter((item): item is string => typeof item === "string");
  if (!isRecord(response)) return [];

  const list =
    (response as TargetsResponse).data ??
    (response as TargetsResponse).targets ??
    (response as TargetsResponse).items ??
    (response as TargetsResponse).value;

  if (!Array.isArray(list)) return [];
  return list.filter((item): item is string => typeof item === "string");
}

function unwrapBackupResponse(response: unknown): BackupResponse {
  const record = isRecord(response) ? response : {};
  const backup = record.backup;

  if (!isRecord(backup) || Object.keys(backup).length === 0) {
    throw new Error("Backend did not return a non-empty backup object.");
  }

  return {
    message: typeof record.message === "string" ? record.message : undefined,
    counts: isRecord(record.counts) ? (record.counts as Record<string, number>) : undefined,
    backup,
    raw: response,
  };
}

export async function getClearDataTargets(token: string): Promise<string[]> {
  const response = await apiRequest<unknown>("/api/system-utilities/clear-data/targets", {
    method: "GET",
    token,
  });

  return unwrapTargets(response);
}

export async function previewClearData(
  token: string,
  payload: ClearDataPayload
): Promise<ClearDataPreviewResponse> {
  const response = await apiRequest<unknown>("/api/system-utilities/clear-data/preview", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
  const record = isRecord(response) ? response : {};
  const requiredConfirm = typeof record.requiredConfirm === "string" ? record.requiredConfirm : "";

  if (!requiredConfirm) {
    throw new Error("Backend did not return requiredConfirm for clear data.");
  }

  return {
    message: typeof record.message === "string" ? record.message : undefined,
    requiredConfirm,
    counts: isRecord(record.counts) ? (record.counts as Record<string, number>) : {},
    raw: response,
  };
}

export async function backupSession(
  token: string,
  payload: ClearDataPayload
): Promise<BackupResponse> {
  const response = await apiRequest<unknown>("/api/system-utilities/backup-session", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

  return unwrapBackupResponse(response);
}

export async function clearData(token: string, payload: ClearDataApplyPayload): Promise<BackupResponse | { raw: unknown }> {
  const response = await apiRequest<unknown>("/api/system-utilities/clear-data", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

  if (isRecord(response) && isRecord(response.backup)) {
    return unwrapBackupResponse(response);
  }

  return { raw: response };
}

export async function restoreSession(token: string, payload: RestoreSessionPayload): Promise<unknown> {
  return apiRequest<unknown>("/api/system-utilities/restore-session", {
    method: "POST",
    token,
    body: JSON.stringify(payload.backup),
  });
}

export async function getConfigBackupTargets(token: string): Promise<string[]> {
  const response = await apiRequest<unknown>("/api/system-utilities/config-backup/targets", {
    method: "GET",
    token,
  });

  return unwrapTargets(response);
}

export async function backupConfiguration(
  token: string,
  payload: ConfigBackupPayload
): Promise<BackupResponse> {
  const response = await apiRequest<unknown>("/api/system-utilities/config-backup", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

  return unwrapBackupResponse(response);
}

export async function restoreConfiguration(
  token: string,
  payload: ConfigRestorePayload
): Promise<unknown> {
  return apiRequest<unknown>("/api/system-utilities/config-restore", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}
