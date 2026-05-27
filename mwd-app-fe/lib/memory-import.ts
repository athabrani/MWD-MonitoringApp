import {
  CorrelationSettings,
  GapFillRequest,
  ImportedMemoryDataset,
  ImportedMemorySample,
  MemoryImportFile,
  MemoryImportRow,
  MemoryImportSegment,
  MemoryStorageChannel,
} from "@/types/memory-import";
import { LogDataRecord } from "@/types/monitoring";

const existingReservedWitsIds = new Set(["0110", "0113", "0121", "0130", "0713", "0714", "0716", "0717", "0823", "0824", "0836", "0921"]);
const badMemoryIdExamples = new Set(["0126", "0166", "0855"]);
let localIdCounter = 0;

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  localIdCounter += 1;
  return `${prefix}-${Date.now()}-${localIdCounter}`;
}

export function validateMemoryWitsId(witsId: string, channels: MemoryStorageChannel[]): string | null {
  const trimmed = witsId.trim();
  if (!/^\d{4}$/.test(trimmed)) {
    return "WITS ID must be exactly four digits.";
  }

  if (trimmed.startsWith("0") || badMemoryIdExamples.has(trimmed)) {
    return "Use a non-conflicting memory storage range. Avoid examples like 0126, 0166, and 0855.";
  }

  if (existingReservedWitsIds.has(trimmed) || channels.some((channel) => channel.witsId === trimmed)) {
    return "This WITS ID conflicts with an existing local WITS channel.";
  }

  return null;
}

export function createMemoryStorageChannel(input: Omit<MemoryStorageChannel, "id" | "createdAt" | "source">): MemoryStorageChannel {
  return {
    ...input,
    id: makeId("memory-channel"),
    createdAt: new Date().toISOString(),
    source: "local-ui",
  };
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
      continue;
    }

    if (char === "\"") {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function firstMatchingHeader(headers: string[], candidates: string[]): string | null {
  return headers.find((header) => candidates.includes(normalizeHeader(header))) ?? null;
}

function numericValue(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function dateValue(value: string | undefined, fallbackIndex: number): string {
  const parsed = value ? new Date(value) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return new Date(Date.now() - (120 - fallbackIndex) * 60_000).toISOString();
}

function buildSegments(rows: MemoryImportRow[], fieldName: string): MemoryImportSegment[] {
  if (rows.length === 0) return [];

  const sorted = [...rows].sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
  const groups: MemoryImportRow[][] = [];

  sorted.forEach((row) => {
    const latestGroup = groups[groups.length - 1];
    const previous = latestGroup?.[latestGroup.length - 1];

    if (!previous) {
      groups.push([row]);
      return;
    }

    const minutesGap = (new Date(row.timestamp).getTime() - new Date(previous.timestamp).getTime()) / 60_000;
    if (minutesGap > 90) {
      groups.push([row]);
      return;
    }

    latestGroup.push(row);
  });

  return groups.map((group, index) => {
    const depths = group.map((row) => row.depth);
    return {
      id: makeId(`segment-${index + 1}`),
      name: `Segment ${index + 1}`,
      startTime: group[0].timestamp,
      endTime: group[group.length - 1].timestamp,
      startDepth: Math.min(...depths),
      endDepth: Math.max(...depths),
      sampleCount: group.length,
      fieldName,
      rows: group,
    };
  });
}

export function parseMemoryCsv(fileName: string, text: string): MemoryImportFile {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    const uploadedAt = new Date().toISOString();
    return {
      id: makeId("memory-file"),
      fileName,
      uploadedAt,
      detectedFields: [],
      totalRows: 0,
      detectedTimeSpan: { start: uploadedAt, end: uploadedAt },
      segments: [],
      parserMode: "csv-basic",
    };
  }

  const headers = parseCsvLine(lines[0]);
  const timeHeader = firstMatchingHeader(headers, ["time", "timestamp", "datetime", "date"]);
  const depthHeader = firstMatchingHeader(headers, ["depth", "md", "measureddepth", "holedepth"]);
  const valueHeader =
    headers.find((header) => {
      const normalized = normalizeHeader(header);
      return !["time", "timestamp", "datetime", "date", "depth", "md", "measureddepth", "holedepth"].includes(normalized);
    }) ?? headers[headers.length - 1];

  const rows = lines.slice(1).flatMap((line, rowIndex) => {
    const values = parseCsvLine(line);
    const raw = headers.reduce<Record<string, string>>((accumulator, header, index) => {
      accumulator[header] = values[index] ?? "";
      return accumulator;
    }, {});
    const depth = numericValue(depthHeader ? raw[depthHeader] : undefined);
    const value = numericValue(valueHeader ? raw[valueHeader] : undefined);

    if (depth === null || value === null) return [];

    return [
      {
        timestamp: dateValue(timeHeader ? raw[timeHeader] : undefined, rowIndex),
        depth,
        value,
        raw,
      },
    ];
  });

  const segments = buildSegments(rows, valueHeader ?? "value");

  return {
    id: makeId("memory-file"),
    fileName,
    uploadedAt: new Date().toISOString(),
    detectedFields: headers.length > 0 ? headers : ["time", "depth", "value"],
    totalRows: rows.length,
    detectedTimeSpan: {
      start: segments[0]?.startTime ?? new Date().toISOString(),
      end: segments[segments.length - 1]?.endTime ?? new Date().toISOString(),
    },
    segments,
    parserMode: "csv-basic",
  };
}

export function importMemorySegment(
  channel: MemoryStorageChannel,
  file: MemoryImportFile,
  segment: MemoryImportSegment,
  selectedFieldName = segment.fieldName
): ImportedMemoryDataset {
  const samples: ImportedMemorySample[] = segment.rows.map((row, index) => ({
    id: makeId(`memory-sample-${index}`),
    timestamp: row.timestamp,
    depth: Number(row.depth.toFixed(channel.decimalPlaces)),
    originalDepth: row.depth,
    value: Number(((numericValue(row.raw[selectedFieldName]) ?? row.value) * channel.scaleFactor).toFixed(channel.decimalPlaces)),
    originalValue: numericValue(row.raw[selectedFieldName]) ?? row.value,
  }));

  return {
    id: makeId("memory-dataset"),
    storageWitsId: channel.witsId,
    storageName: channel.name,
    fileName: file.fileName,
    segmentId: segment.id,
    segmentName: `${segment.name} / ${selectedFieldName}`,
    importedAt: new Date().toISOString(),
    samples,
    status: "imported",
  };
}

export function applyCorrelationSettings(dataset: ImportedMemoryDataset, settings: CorrelationSettings): ImportedMemoryDataset {
  return {
    ...dataset,
    status: "correlated",
    samples: dataset.samples.map((sample) => ({
      ...sample,
      timestamp: new Date(new Date(sample.timestamp).getTime() + settings.timeShiftSeconds * 1000).toISOString(),
      depth: Number((sample.originalDepth + settings.depthShift).toFixed(3)),
      value: Number((sample.originalValue * settings.scaleFactor).toFixed(3)),
    })),
  };
}

export function buildCompareRows(dataset: ImportedMemoryDataset | null, existingRecords: LogDataRecord[]) {
  if (!dataset) return [];

  return dataset.samples.slice(0, 10).map((sample) => {
    const nearest = existingRecords.reduce<LogDataRecord | null>((currentNearest, record) => {
      if (!currentNearest) return record;
      return Math.abs(record.depth - sample.depth) < Math.abs(currentNearest.depth - sample.depth) ? record : currentNearest;
    }, null);

    return {
      sampleId: sample.id,
      depth: sample.depth,
      importedValue: sample.value,
      nearestRealtimeDepth: nearest?.depth ?? null,
      nearestRealtimeValue: nearest?.value ?? null,
      delta: nearest ? Number((sample.value - nearest.value).toFixed(3)) : null,
    };
  });
}

export function createGapFillRequest(input: {
  dataset: ImportedMemoryDataset;
  targetWitsId: string;
  startDepth: number;
  endDepth: number;
  mode: GapFillRequest["mode"];
}): GapFillRequest {
  const affectedSamples = input.dataset.samples.filter(
    (sample) => sample.depth >= input.startDepth && sample.depth <= input.endDepth
  ).length;

  return {
    id: makeId("gap-fill"),
    sourceDatasetId: input.dataset.id,
    sourceWitsId: input.dataset.storageWitsId,
    targetWitsId: input.targetWitsId,
    startDepth: input.startDepth,
    endDepth: input.endDepth,
    mode: input.mode,
    createdAt: new Date().toISOString(),
    affectedSamples,
    status: "applied-local",
  };
}
