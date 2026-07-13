import { collectImportSources, type ImportSourceBatch, type NormalizedImportSource } from "@/lib/import-sources";
import { formatConfiguredWitsId } from "@/lib/wits-config-store";
import type { MwdDataInput } from "@/lib/mwd-data-api";
import type { PolarisWitsId } from "@/types/polaris";

type CsvParseResult = {
  headers: string[];
  rows: Record<string, string>[];
};

export type LogDataImportValue = {
  value: number;
  rawValue: string;
  depth?: number;
  timestamp?: string;
  sourceRow: number;
};

export type LogDataImportTarget = {
  witsId: string;
  label: string;
  mappedField?: string;
  unit?: string;
  lasMnemonic?: string;
  reason: string;
};

export type LogDataImportMappedFile = {
  source: NormalizedImportSource;
  target: LogDataImportTarget;
  headers: string[];
  valueColumn: string;
  depthColumn?: string;
  timestampColumn?: string;
  values: LogDataImportValue[];
  invalidRows: Array<{ row: number; reason: string }>;
};

export type LogDataImportUnmappedFile = {
  source: NormalizedImportSource;
  headers: string[];
  reason: string;
};

export type LogDataImportBatch = {
  sourceBatch: ImportSourceBatch;
  mappedFiles: LogDataImportMappedFile[];
  unmappedFiles: LogDataImportUnmappedFile[];
  totalParsedRows: number;
  totalImportableValues: number;
  totalInvalidRows: number;
};

export type LogDataImportBatchOptions = {
  preferredWitsId?: string;
};

export type LogDataImportRequestEntry = {
  file: LogDataImportMappedFile;
  value: LogDataImportValue;
};

export type LogDataImportRequest = {
  key: string;
  entries: LogDataImportRequestEntry[];
  payload: MwdDataInput;
};

const LEADING_WITS_ID_PATTERN = /^(\d{4})(?=[\s_-]|$)/;
const VALUE_KEYS = ["value", "reading", "measurement", "data", "val"];
const DEPTH_KEYS = ["depth", "md", "measureddepth", "measureddepthmd", "bitdepth", "holedepth", "depthmd"];
const TIME_KEYS = ["time", "timestamp", "datetime", "date", "measuredat", "recordedat"];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/^\d{4}[\s_-]*/, "")
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function parseCsv(content: string): CsvParseResult {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (!quoted && (char === "," || char === "\t" || char === ";")) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  if (row.some((value) => value.trim())) rows.push(row);

  const headers = rows[0]?.map((header, index) => header.trim() || `Column ${index + 1}`) ?? [];
  const dataRows = rows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = cells[index]?.trim() ?? "";
    });
    return record;
  });

  return { headers, rows: dataRows };
}

function parseNumber(value: string | undefined) {
  if (!value) return undefined;
  const cleaned = value.trim().replace(/,/g, "");
  if (!cleaned) return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed !== -9999 ? parsed : undefined;
}

function parseTimestamp(value: string | undefined) {
  if (!value?.trim()) return undefined;
  const trimmed = value.trim();
  const numeric = Number(trimmed);
  const date = Number.isFinite(numeric)
    ? new Date(Math.abs(numeric) < 1_000_000_000_000 ? numeric * 1000 : numeric)
    : new Date(trimmed);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function getConfigSearchTerms(config: PolarisWitsId) {
  return [
    config.name,
    config.mappedField,
    config.lasMnemonic,
    config.lasDescription,
    formatConfiguredWitsId(config.numericId),
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(normalizeText)
    .filter(Boolean);
}

function findTarget(
  source: NormalizedImportSource,
  headers: string[],
  configs: PolarisWitsId[],
  options: LogDataImportBatchOptions = {},
): LogDataImportTarget | null {
  const configByWitsId = new Map(configs.map((config) => [formatConfiguredWitsId(config.numericId), config]));
  const fileWitsId = source.fileName.match(LEADING_WITS_ID_PATTERN)?.[1];

  if (fileWitsId) {
    const config = configByWitsId.get(fileWitsId);
    if (!config) return null;
    return {
      witsId: fileWitsId,
      label: config.name || `WITS ${fileWitsId}`,
      mappedField: config.mappedField,
      unit: config.units,
      lasMnemonic: config.lasMnemonic,
      reason: `Matched explicit WITS ID ${fileWitsId} from file name/path.`,
    };
  }

  const fileKey = normalizeText(source.fileName);
  const headerKeys = headers.map(normalizeText);

  for (const config of configs) {
    const witsId = formatConfiguredWitsId(config.numericId);
    const terms = getConfigSearchTerms(config);
    const matchedTerm = terms.find((term) => term && (term === fileKey || headerKeys.includes(term)));
    if (!matchedTerm) continue;

    return {
      witsId,
      label: config.name || `WITS ${witsId}`,
      mappedField: config.mappedField,
      unit: config.units,
      lasMnemonic: config.lasMnemonic,
      reason: "Matched file/header exactly to configured WITS metadata.",
    };
  }

  if (options.preferredWitsId) {
    const preferredWitsId = options.preferredWitsId.padStart(4, "0");
    const config = configByWitsId.get(preferredWitsId);
    if (config) {
      return {
        witsId: preferredWitsId,
        label: config.name || `WITS ${preferredWitsId}`,
        mappedField: config.mappedField,
        unit: config.units,
        lasMnemonic: config.lasMnemonic,
        reason: `Matched selected WITS ID ${preferredWitsId} from the active Log Data import context.`,
      };
    }
  }

  return null;
}

function findColumn(headers: string[], keys: string[]) {
  return headers.find((header) => keys.includes(normalizeHeader(header)));
}

function findValueColumn(headers: string[], target: LogDataImportTarget, rows: Record<string, string>[]) {
  const targetKeys = [target.witsId, target.label, target.mappedField, target.lasMnemonic]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(normalizeText);
  const explicitTargetColumn = headers.find((header) => targetKeys.includes(normalizeText(header)));
  if (explicitTargetColumn) return explicitTargetColumn;

  const genericValueColumn = findColumn(headers, VALUE_KEYS);
  if (genericValueColumn) return genericValueColumn;

  const nonContextColumns = headers.filter((header) => {
    const normalized = normalizeHeader(header);
    return !DEPTH_KEYS.includes(normalized) && !TIME_KEYS.includes(normalized) && normalized !== "witsid";
  });

  return nonContextColumns.find((header) => rows.some((row) => parseNumber(row[header]) !== undefined));
}

function classifySource(
  source: NormalizedImportSource,
  configs: PolarisWitsId[],
  options: LogDataImportBatchOptions = {},
): LogDataImportMappedFile | LogDataImportUnmappedFile {
  const parsed = parseCsv(source.content);
  if (parsed.headers.length === 0 || parsed.rows.length === 0) {
    return { source, headers: parsed.headers, reason: "CSV tidak memiliki header atau data row." };
  }

  const target = findTarget(source, parsed.headers, configs, options);
  if (!target) {
    return {
      source,
      headers: parsed.headers,
      reason: "Tidak ada target WITS yang cukup jelas dari nama file/header/config.",
    };
  }

  const valueColumn = findValueColumn(parsed.headers, target, parsed.rows);
  if (!valueColumn) {
    return {
      source,
      headers: parsed.headers,
      reason: `Target ${target.witsId} terdeteksi, tetapi kolom nilai tidak ditemukan.`,
    };
  }

  const depthColumn = findColumn(parsed.headers.filter((header) => header !== valueColumn), DEPTH_KEYS);
  const timestampColumn = findColumn(parsed.headers, TIME_KEYS);
  const invalidRows: LogDataImportMappedFile["invalidRows"] = [];
  const values: LogDataImportValue[] = [];

  parsed.rows.forEach((row, index) => {
    const sourceRow = index + 2;
    const value = parseNumber(row[valueColumn]);
    if (value === undefined) {
      invalidRows.push({ row: sourceRow, reason: `Kolom ${valueColumn} bukan angka valid.` });
      return;
    }

    const depth =
      parseNumber(depthColumn ? row[depthColumn] : undefined) ??
      (target.witsId === "0108" || target.witsId === "0110" ? value : undefined);
    const timestamp = parseTimestamp(timestampColumn ? row[timestampColumn] : undefined);

    values.push({
      value,
      rawValue: row[valueColumn],
      depth,
      timestamp,
      sourceRow,
    });
  });

  if (values.length === 0) {
    return {
      source,
      headers: parsed.headers,
      reason: `Semua row gagal diparse untuk target ${target.witsId}.`,
    };
  }

  return {
    source,
    target,
    headers: parsed.headers,
    valueColumn,
    depthColumn,
    timestampColumn,
    values,
    invalidRows,
  };
}

export async function buildLogDataImportBatch(
  input: FileList | File[] | null | undefined,
  configs: PolarisWitsId[],
  options: LogDataImportBatchOptions = {},
): Promise<LogDataImportBatch> {
  const sourceBatch = await collectImportSources(input);
  const mappedFiles: LogDataImportMappedFile[] = [];
  const unmappedFiles: LogDataImportUnmappedFile[] = [];

  for (const source of sourceBatch.validSources) {
    const classified = classifySource(source, configs, options);
    if ("target" in classified) {
      mappedFiles.push(classified);
    } else {
      unmappedFiles.push(classified);
    }
  }

  return {
    sourceBatch,
    mappedFiles,
    unmappedFiles,
    totalParsedRows: mappedFiles.reduce((total, file) => total + file.values.length + file.invalidRows.length, 0),
    totalImportableValues: mappedFiles.reduce((total, file) => total + file.values.length, 0),
    totalInvalidRows: mappedFiles.reduce((total, file) => total + file.invalidRows.length, 0),
  };
}

export function buildLogDataImportPayload(
  sessionId: string,
  file: LogDataImportMappedFile,
  value: LogDataImportValue,
): MwdDataInput {
  const rawLine = `${file.target.witsId} ${value.rawValue}`;

  return {
    sessionId,
    measuredAt: value.timestamp,
    depthMd: value.depth,
    wits: [{ witsId: file.target.witsId, value: value.rawValue }],
    serialWitsLines: [{
      witsId: file.target.witsId,
      rawValue: value.rawValue,
      rawLine,
    }],
    rawWitsBlock: `&&\n${rawLine}\n!!`,
    source: "log_data_csv_import",
    importSourcePath: file.source.sourcePath,
    importSourceRow: value.sourceRow,
  };
}

function getImportRequestBaseKey(entry: LogDataImportRequestEntry) {
  if (entry.value.timestamp) return `time:${entry.value.timestamp}`;
  if (entry.value.depth !== undefined) return `depth:${entry.value.depth.toFixed(6)}`;
  return `row:${entry.value.sourceRow}`;
}

function buildGroupedPayload(sessionId: string, key: string, entries: LogDataImportRequestEntry[]): LogDataImportRequest {
  const timestamp = entries.find((entry) => entry.value.timestamp)?.value.timestamp;
  const depth = entries.find((entry) => entry.value.depth !== undefined)?.value.depth;
  const rawLines = entries.map((entry) => `${entry.file.target.witsId} ${entry.value.rawValue}`);

  return {
    key,
    entries,
    payload: {
      sessionId,
      measuredAt: timestamp,
      depthMd: depth,
      wits: entries.map((entry) => ({
        witsId: entry.file.target.witsId,
        value: entry.value.rawValue,
      })),
      serialWitsLines: entries.map((entry, index) => ({
        witsId: entry.file.target.witsId,
        rawValue: entry.value.rawValue,
        rawLine: rawLines[index],
      })),
      rawWitsBlock: `&&\n${rawLines.join("\n")}\n!!`,
      source: "log_data_csv_import",
      importSourcePath: entries.map((entry) => entry.file.source.sourcePath).join(", "),
      importSourceRow: entries.map((entry) => entry.value.sourceRow).join(", "),
      importBatchKey: key,
    },
  };
}

export function buildLogDataImportRequests(sessionId: string, batch: LogDataImportBatch): LogDataImportRequest[] {
  const grouped = new Map<string, LogDataImportRequestEntry[][]>();

  for (const file of batch.mappedFiles) {
    for (const value of file.values) {
      const entry = { file, value };
      const baseKey = getImportRequestBaseKey(entry);
      const groups = grouped.get(baseKey) ?? [];
      const availableGroup = groups.find((group) =>
        group.every((existing) => existing.file.target.witsId !== file.target.witsId)
      );

      if (availableGroup) {
        availableGroup.push(entry);
      } else {
        groups.push([entry]);
        grouped.set(baseKey, groups);
      }
    }
  }

  const requests: LogDataImportRequest[] = [];
  for (const [baseKey, groups] of grouped.entries()) {
    groups.forEach((entries, groupIndex) => {
      const key = groups.length === 1 ? baseKey : `${baseKey}:group:${groupIndex + 1}`;
      requests.push(buildGroupedPayload(sessionId, key, entries));
    });
  }

  return requests;
}
