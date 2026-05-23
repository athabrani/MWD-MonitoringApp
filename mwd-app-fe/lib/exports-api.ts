import { apiFetch, apiRequest } from "@/lib/api-client";

type BackendExportRecord = Record<string, unknown>;

type BackendExportRecordsResponse = {
  value?: BackendExportRecord[];
  data?: BackendExportRecord[];
  items?: BackendExportRecord[];
  Count?: number;
  count?: number;
};

export type ExportFormat = "csv" | "json";

export type ExportBlob = Blob & {
  fileName?: string;
};

export type HistoricalExportPayload = {
  sessionId: string;
  format: ExportFormat;
  depthMin?: number;
  depthMax?: number;
};

export type LasExportColumnPayload = {
  field: string;
  mnemonic: string;
  unit: string;
  description: string;
};

export type LasWellInfoItem = {
  name: string;
  unit: string;
  data: string;
  description: string;
};

export type LasExportPayload = {
  sessionId: string;
  startDepth: number;
  endDepth: number;
  stepDepth: number;
  depthPrecision: number;
  maxGap: number;
  nullValue: number;
  includeWits: boolean;
  includeSurvey: boolean;
  includeProjectedSurvey: boolean;
  includeSurveysInOtherSection: boolean;
  stopAtLastSurveyDepth: boolean;
  dateTimeInFirstColumn: boolean;
  correctDepthColumnForTvd: boolean;
  interpolateSurvey: boolean;
  surveyStationType: "actual" | "projected" | string;
  depthUnit: string;
  columns: LasExportColumnPayload[];
  wellInfo: LasWellInfoItem[];
};

export type PdfPlotExportPayload =
  | {
      sessionId: string;
      templateId: string;
      depthMin: number;
      depthMax: number;
    }
  | {
      sessionId: string;
      depthMin: number;
      depthMax: number;
      template: Record<string, unknown>;
    };

export type ExportRecord = {
  id: string;
  type?: string;
  status?: string;
  fileName?: string;
  downloadUrl?: string;
  createdAt?: string;
  completedAt?: string;
  raw: BackendExportRecord;
};

function isRecord(value: unknown): value is BackendExportRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(record: BackendExportRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return undefined;
}

function unwrapRecordList(response: BackendExportRecordsResponse | BackendExportRecord[]) {
  if (Array.isArray(response)) return response;
  return response.value ?? response.data ?? response.items ?? [];
}

function getFilenameFromContentDisposition(value: string | null) {
  if (!value) return undefined;

  const encodedMatch = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) {
    return decodeURIComponent(encodedMatch[1].replace(/"/g, ""));
  }

  const match = value.match(/filename="?([^";]+)"?/i);
  return match?.[1];
}

function normalizeExportRecord(record: BackendExportRecord): ExportRecord | null {
  const id = readString(record, ["id", "_id", "exportId", "export_id"]);
  if (!id) return null;

  return {
    id,
    type: readString(record, ["type", "exportType", "export_type"]),
    status: readString(record, ["status", "state"]),
    fileName: readString(record, ["fileName", "file_name", "filename", "name"]),
    downloadUrl: readString(record, ["downloadUrl", "download_url", "url", "fileUrl", "file_url"]),
    createdAt: readString(record, ["createdAt", "created_at", "timestamp"]),
    completedAt: readString(record, ["completedAt", "completed_at"]),
    raw: record,
  };
}

async function requestExportBlob(
  token: string,
  path: string,
  payload: Record<string, unknown>
): Promise<ExportBlob> {
  const response = await apiFetch(path, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
  const blob = (await response.blob()) as ExportBlob;
  const fileName = getFilenameFromContentDisposition(response.headers.get("content-disposition"));

  if (fileName) {
    Object.defineProperty(blob, "fileName", {
      configurable: true,
      enumerable: false,
      value: fileName,
    });
  }

  return blob;
}

export function downloadBlob(blob: ExportBlob, fallbackFileName: string) {
  if (typeof window === "undefined") return;

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = blob.fileName ?? fallbackFileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function exportHistorical(
  token: string,
  payload: HistoricalExportPayload
): Promise<ExportBlob> {
  return requestExportBlob(token, "/api/exports/historical", payload);
}

export async function exportLas(token: string, payload: LasExportPayload): Promise<ExportBlob> {
  return requestExportBlob(token, "/api/exports/las", payload);
}

export async function exportPdfPlot(token: string, payload: PdfPlotExportPayload): Promise<ExportBlob> {
  return requestExportBlob(token, "/api/exports/pdf-plot", payload);
}

export async function getExportRecords(token: string): Promise<ExportRecord[]> {
  const response = await apiRequest<BackendExportRecordsResponse | BackendExportRecord[]>(
    "/api/exports/records",
    {
      method: "GET",
      token,
    }
  );

  return unwrapRecordList(response)
    .map(normalizeExportRecord)
    .filter((record): record is ExportRecord => Boolean(record));
}
