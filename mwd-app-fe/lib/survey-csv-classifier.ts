import type { NormalizedImportSource, SkippedImportSource } from "@/lib/import-sources";

export type SurveyCsvClassificationKind = "survey-compatible" | "non-survey" | "invalid-survey";

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

function findHeader(headers: string[], aliases: readonly string[]) {
  return headers.find((header) => aliases.includes(header));
}

function hasSurveyNameHint(source: NormalizedImportSource) {
  return /survey|trajectory|well[\s_-]*plan|directional/i.test(
    `${source.fileName} ${source.sourcePath}`,
  );
}

function classifySurveyCsv(source: NormalizedImportSource): SurveyCsvClassification {
  const lines = getCsvLines(source.content);

  if (lines.length === 0) {
    return {
      source,
      kind: "invalid-survey",
      reason: "CSV kosong.",
      rowCount: 0,
      matchedHeaders: {},
    };
  }

  const delimiter = detectDelimiter(lines[0] ?? "");
  const rawHeaders = splitDelimitedLine(lines[0] ?? "", delimiter);
  const headers = rawHeaders.map(normalizeHeader);
  const matchedHeaders = {
    measuredDepth: findHeader(headers, requiredSurveyHeaderAliases.measuredDepth),
    inclination: findHeader(headers, requiredSurveyHeaderAliases.inclination),
    azimuth: findHeader(headers, requiredSurveyHeaderAliases.azimuth),
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
  const hasNonSurveyHints = headers.some((header) => nonSurveyMetricHints.has(header));

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
  const classifications = sources.map(classifySurveyCsv);
  const surveySources = classifications
    .filter((classification) => classification.kind === "survey-compatible")
    .map((classification) => classification.source);
  const derivedSkippedSources: SkippedImportSource[] = classifications
    .filter((classification) => classification.kind !== "survey-compatible")
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
    nonSurveyFileCount: classifications.filter((item) => item.kind === "non-survey").length,
    invalidSurveyFileCount: classifications.filter((item) => item.kind === "invalid-survey").length,
  };
}
