import type { NormalizedImportSource, SkippedImportSource } from "@/lib/import-sources";

export type SurveyCsvClassificationKind =
  | "survey-compatible"
  | "derived-survey-input"
  | "non-survey"
  | "invalid-survey";

export type SurveyCsvClassification = {
  source: NormalizedImportSource;
  kind: SurveyCsvClassificationKind;
  reason: string;
  rowCount: number;
  matchedHeaders: {
    measuredDepth?: string;
    inclination?: string;
    azimuth?: string;
  };
};

export type SurveyCsvClassificationSummary = {
  surveySources: NormalizedImportSource[];
  classifications: SurveyCsvClassification[];
  skippedSources: SkippedImportSource[];
  surveyFileCount: number;
  derivedSurveyFileCount: number;
  derivedSurveyRowCount: number;
  nonSurveyFileCount: number;
  invalidSurveyFileCount: number;
};

const requiredSurveyHeaderAliases = {
  measuredDepth: [
    "md",
    "measureddepth",
    "measureddepthmd",
    "depthmd",
    "depth",
    "surveydepth",
    "surveydepthmd",
    "measdepth",
    "mdepth",
  ],
  inclination: [
    "inc",
    "incl",
    "inclination",
    "inclinationdeg",
    "inclinationdegree",
    "surveyinc",
    "surveyinclination",
  ],
  azimuth: [
    "azm",
    "azi",
    "az",
    "azimuth",
    "azimuthdeg",
    "azimuthdegree",
    "surveyazm",
    "surveyazi",
    "surveyazimuth",
  ],
} as const;

const nonSurveyMetricHints = new Set([
  "mudweight",
  "rop",
  "bitdepth",
  "holedepth",
  "hookpos",
  "hookposition",
  "slideindicator",
  "gamma",
  "gammaray",
  "temperature",
  "pressure",
  "standpipepressure",
  "flow",
  "flowrate",
]);

type SurveyFieldKey =
  | "measuredDepth"
  | "inclination"
  | "azimuth"
  | "tvd"
  | "northing"
  | "easting"
  | "verticalSection"
  | "doglegSeverity";

type ParsedCsvSource = {
  source: NormalizedImportSource;
  lines: string[];
  delimiter: string;
  rawHeaders: string[];
  headers: string[];
  rows: Record<string, string>[];
};

type PartialSurveyChannel = {
  source: NormalizedImportSource;
  field: Exclude<SurveyFieldKey, "measuredDepth">;
  depthHeader: string;
  valueHeader: string;
  rows: Array<{ measuredDepth: number; value: number }>;
};

const derivedSurveyFieldAliases: Record<SurveyFieldKey, readonly string[]> = {
  measuredDepth: requiredSurveyHeaderAliases.measuredDepth,
  inclination: requiredSurveyHeaderAliases.inclination,
  azimuth: requiredSurveyHeaderAliases.azimuth,
  tvd: ["tvd", "trueverticaldepth"],
  northing: ["north", "northing", "ns", "northsouth"],
  easting: ["east", "easting", "ew", "eastwest"],
  verticalSection: ["vs", "verticalsection"],
  doglegSeverity: ["dls", "dogleg", "doglegseverity"],
};

const derivedSurveyFieldByNameHint: Array<{
  field: Exclude<SurveyFieldKey, "measuredDepth">;
  patterns: RegExp[];
}> = [
  { field: "inclination", patterns: [/\binc\b/i, /incl/i, /inclination/i] },
  { field: "azimuth", patterns: [/\bazm\b/i, /\bazi\b/i, /azimuth/i] },
  { field: "tvd", patterns: [/\btvd\b/i, /true[\s_-]*vertical[\s_-]*depth/i] },
  { field: "northing", patterns: [/\bns\b/i, /north[\s_-]*south/i, /northing/i] },
  { field: "easting", patterns: [/\bew\b/i, /east[\s_-]*west/i, /easting/i] },
  { field: "verticalSection", patterns: [/\bvs\b/i, /vertical[\s_-]*section/i] },
  { field: "doglegSeverity", patterns: [/\bdls\b/i, /dog[\s_-]*leg/i] },
];

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function splitDelimitedLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && nextCharacter === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === delimiter && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
}

function detectDelimiter(line: string) {
  const candidates = [",", ";", "\t"];
  return candidates
    .map((delimiter) => ({
      delimiter,
      count: splitDelimitedLine(line, delimiter).length,
    }))
    .sort((left, right) => right.count - left.count)[0]?.delimiter ?? ",";
}

function getCsvLines(content: string) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

function toFiniteNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value.trim().replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseCsvSource(source: NormalizedImportSource): ParsedCsvSource {
  const lines = getCsvLines(source.content);
  const delimiter = detectDelimiter(lines[0] ?? "");
  const rawHeaders = splitDelimitedLine(lines[0] ?? "", delimiter);
  const headers = rawHeaders.map(normalizeHeader);
  const rows = lines.slice(1).map((line) => {
    const values = splitDelimitedLine(line, delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });

  return {
    source,
    lines,
    delimiter,
    rawHeaders,
    headers,
    rows,
  };
}

function findHeader(headers: string[], aliases: readonly string[]) {
  return headers.find((header) => aliases.includes(header));
}

function findRawHeader(parsed: ParsedCsvSource, normalizedHeader?: string) {
  if (!normalizedHeader) return undefined;
  const index = parsed.headers.indexOf(normalizedHeader);
  return index >= 0 ? parsed.rawHeaders[index] : normalizedHeader;
}

function findSurveyFieldHeader(parsed: ParsedCsvSource, field: SurveyFieldKey) {
  return findHeader(parsed.headers, derivedSurveyFieldAliases[field]);
}

function detectSingleChannelField(parsed: ParsedCsvSource) {
  const sourceLabel = `${parsed.source.fileName} ${parsed.source.sourcePath}`;
  const byName = derivedSurveyFieldByNameHint.find((entry) =>
    entry.patterns.some((pattern) => pattern.test(sourceLabel)),
  )?.field;

  if (byName) return byName;

  return derivedSurveyFieldByNameHint.find((entry) =>
    parsed.headers.some((header) =>
      entry.patterns.some((pattern) => pattern.test(header)),
    ),
  )?.field;
}

function detectValueHeader(
  parsed: ParsedCsvSource,
  field: Exclude<SurveyFieldKey, "measuredDepth">,
  depthHeader: string,
) {
  const directHeader = findSurveyFieldHeader(parsed, field);

  if (directHeader && directHeader !== depthHeader) {
    return directHeader;
  }

  const genericValueHeader = findHeader(parsed.headers, [
    "value",
    "rawvalue",
    "parsedvalue",
    "data",
    "measurement",
  ]);

  if (genericValueHeader && genericValueHeader !== depthHeader) {
    return genericValueHeader;
  }

  return parsed.headers.find((header) => {
    if (header === depthHeader) return false;
    return parsed.rows.some((row) => toFiniteNumber(row[header]) !== null);
  });
}

function detectPartialSurveyChannel(parsed: ParsedCsvSource): PartialSurveyChannel | null {
  const field = detectSingleChannelField(parsed);
  const depthHeader = findSurveyFieldHeader(parsed, "measuredDepth");

  if (!field || !depthHeader) return null;

  const valueHeader = detectValueHeader(parsed, field, depthHeader);

  if (!valueHeader) return null;

  const rows = parsed.rows
    .map((row) => ({
      measuredDepth: toFiniteNumber(row[depthHeader]),
      value: toFiniteNumber(row[valueHeader]),
    }))
    .filter(
      (row): row is { measuredDepth: number; value: number } =>
        row.measuredDepth !== null && row.value !== null,
    );

  if (rows.length === 0) return null;

  return {
    source: parsed.source,
    field,
    depthHeader,
    valueHeader,
    rows,
  };
}

function formatCsvValue(value?: number) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function buildDerivedSurveySource(channels: PartialSurveyChannel[]): {
  source: NormalizedImportSource;
  contributorIds: Set<string>;
  rowCount: number;
} | null {
  const contributorIds = new Set(channels.map((channel) => channel.source.id));
  const rowsByDepth = new Map<string, Record<string, number>>();

  for (const channel of channels) {
    for (const row of channel.rows) {
      const depthKey = row.measuredDepth.toFixed(4);
      const current = rowsByDepth.get(depthKey) ?? {
        measuredDepth: Number(depthKey),
      };
      current[channel.field] = row.value;
      rowsByDepth.set(depthKey, current);
    }
  }

  const rows = Array.from(rowsByDepth.values())
    .filter(
      (row) =>
        Number.isFinite(row.measuredDepth) &&
        Number.isFinite(row.inclination) &&
        Number.isFinite(row.azimuth),
    )
    .sort((left, right) => left.measuredDepth - right.measuredDepth);

  if (rows.length === 0) return null;

  const header = ["MD", "Inc", "Azm", "TVD", "NS", "EW", "VS", "DLS"];
  const content = [
    header.join(","),
    ...rows.map((row) =>
      [
        formatCsvValue(row.measuredDepth),
        formatCsvValue(row.inclination),
        formatCsvValue(row.azimuth),
        formatCsvValue(row.tvd),
        formatCsvValue(row.northing),
        formatCsvValue(row.easting),
        formatCsvValue(row.verticalSection),
        formatCsvValue(row.doglegSeverity),
      ].join(","),
    ),
  ].join("\n");

  return {
    source: {
      id: `derived-survey-${Date.now()}`,
      fileName: "derived-survey-from-imported-channels.csv",
      sourcePath: "derived/survey-from-imported-channels.csv",
      sourceKind: "csv-file",
      size: content.length,
      content,
    },
    contributorIds,
    rowCount: rows.length,
  };
}

function hasSurveyNameHint(source: NormalizedImportSource) {
  return /survey|trajectory|well[\s_-]*plan|directional/i.test(
    `${source.fileName} ${source.sourcePath}`,
  );
}

function classifySurveyCsv(source: NormalizedImportSource): SurveyCsvClassification {
  const parsed = parseCsvSource(source);
  const lines = parsed.lines;

  if (lines.length === 0) {
    return {
      source,
      kind: "invalid-survey",
      reason: "CSV kosong.",
      rowCount: 0,
      matchedHeaders: {},
    };
  }

  const matchedHeaders = {
    measuredDepth: findRawHeader(parsed, findHeader(parsed.headers, requiredSurveyHeaderAliases.measuredDepth)),
    inclination: findRawHeader(parsed, findHeader(parsed.headers, requiredSurveyHeaderAliases.inclination)),
    azimuth: findRawHeader(parsed, findHeader(parsed.headers, requiredSurveyHeaderAliases.azimuth)),
  };
  const missing = [
    matchedHeaders.measuredDepth ? null : "MD/measured depth",
    matchedHeaders.inclination ? null : "inclination",
    matchedHeaders.azimuth ? null : "azimuth",
  ].filter((value): value is string => Boolean(value));
  const rowCount = Math.max(0, lines.length - 1);
  const hasRequiredHeaders = missing.length === 0;
  const matchedRequiredCount = Object.values(matchedHeaders).filter(Boolean).length;
  const hasSurveyHints = hasSurveyNameHint(source) || matchedRequiredCount >= 2;
  const hasNonSurveyHints = parsed.headers.some((header) => nonSurveyMetricHints.has(header));

  if (hasRequiredHeaders) {
    return {
      source,
      kind: rowCount > 0 ? "survey-compatible" : "invalid-survey",
      reason: rowCount > 0 ? "Survey-compatible CSV." : "Survey headers found, but no data rows exist.",
      rowCount,
      matchedHeaders,
    };
  }

  if (hasSurveyHints && !hasNonSurveyHints) {
    return {
      source,
      kind: "invalid-survey",
      reason: `Looks like a survey CSV but missing required header(s): ${missing.join(", ")}.`,
      rowCount,
      matchedHeaders,
    };
  }

  return {
    source,
    kind: "non-survey",
    reason: `Skipped non-survey CSV. Missing survey header(s): ${missing.join(", ")}.`,
    rowCount,
    matchedHeaders,
  };
}

export function classifySurveyCsvSources(
  sources: NormalizedImportSource[],
  initialSkippedSources: SkippedImportSource[] = [],
): SurveyCsvClassificationSummary {
  const parsedSources = sources.map(parseCsvSource);
  const partialChannels = parsedSources
    .map(detectPartialSurveyChannel)
    .filter((channel): channel is PartialSurveyChannel => Boolean(channel));
  const derivedSurvey = buildDerivedSurveySource(partialChannels);
  const contributorIds = derivedSurvey?.contributorIds ?? new Set<string>();
  const baseClassifications = sources.map(classifySurveyCsv);
  const classifications = baseClassifications.map((classification) =>
    contributorIds.has(classification.source.id) &&
    classification.kind !== "survey-compatible"
      ? {
          ...classification,
          kind: "derived-survey-input" as const,
          reason: "Used with other imported channels to derive valid survey rows.",
        }
      : classification,
  );
  const surveySources = classifications
    .filter((classification) => classification.kind === "survey-compatible")
    .map((classification) => classification.source);
  if (derivedSurvey) {
    surveySources.push(derivedSurvey.source);
  }
  const derivedSkippedSources: SkippedImportSource[] = classifications
    .filter(
      (classification) =>
        classification.kind !== "survey-compatible" &&
        classification.kind !== "derived-survey-input",
    )
    .map((classification) => ({
      fileName: classification.source.fileName,
      sourcePath: classification.source.sourcePath,
      sourceKind:
        classification.source.sourceKind === "zip-entry" ? "zip-entry" : "selected-file",
      reason: classification.reason,
    }));

  return {
    surveySources,
    classifications,
    skippedSources: [...initialSkippedSources, ...derivedSkippedSources],
    surveyFileCount: surveySources.length,
    derivedSurveyFileCount: derivedSurvey ? 1 : 0,
    derivedSurveyRowCount: derivedSurvey?.rowCount ?? 0,
    nonSurveyFileCount: classifications.filter((item) => item.kind === "non-survey").length,
    invalidSurveyFileCount: classifications.filter((item) => item.kind === "invalid-survey").length,
  };
}
