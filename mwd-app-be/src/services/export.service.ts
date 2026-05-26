import {
  MWD_MEASUREMENT_FIELDS,
  type MWDMeasurementInput,
} from "../utils/mwd-measurements.js";

type ExportRow = {
  id: bigint;
  sessionId: number;
  measuredAt: Date;
  createdAt: Date;
} & {
  [Field in keyof MWDMeasurementInput]: unknown;
};

const toPlainValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object" && value !== null && "toString" in value) {
    return String(value);
  }

  return value;
};

const escapeCsv = (value: unknown) => {
  const plain = toPlainValue(value);

  if (plain === null) {
    return "";
  }

  const text = String(plain);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

type SurveyExportRow = {
  id: bigint;
  sessionId: number;
  stationType: string;
  measuredDepth: unknown;
  inclination: unknown;
  azimuth: unknown;
  tvd: unknown;
  northing: unknown;
  easting: unknown;
  verticalSection: unknown;
  doglegSeverity: unknown;
  buildRate: unknown;
  turnRate: unknown;
  closureDistance: unknown;
  closureAzimuth: unknown;
  courseLength: unknown;
  verticalSectionAzimuth: unknown;
  source: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export const buildExportFileName = (
  sessionCode: string,
  format: "json" | "csv",
) => {
  const safeSessionCode = sessionCode.replace(/[^a-zA-Z0-9_-]/g, "_");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${safeSessionCode}_historical_${timestamp}.${format}`;
};

export const buildSurveyExportFileName = (
  sessionCode: string,
  stationType: string,
) => {
  const safeSessionCode = sessionCode.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeStationType = stationType.replace(/[^a-zA-Z0-9_-]/g, "_");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${safeSessionCode}_survey_${safeStationType}_${timestamp}.csv`;
};

export const serializeHistoricalDataAsJson = (rows: ExportRow[]) => {
  return JSON.stringify(
    rows.map((row) => {
      const serializedRow: Record<string, unknown> = {
        id: toPlainValue(row.id),
        sessionId: row.sessionId,
        measuredAt: toPlainValue(row.measuredAt),
      };

      for (const fieldName of MWD_MEASUREMENT_FIELDS) {
        serializedRow[fieldName] = toPlainValue(row[fieldName]);
      }

      serializedRow.createdAt = toPlainValue(row.createdAt);

      return serializedRow;
    }),
    null,
    2,
  );
};

export const serializeHistoricalDataAsCsv = (rows: ExportRow[]) => {
  const header = ["id", "sessionId", "measuredAt", ...MWD_MEASUREMENT_FIELDS, "createdAt"];

  const lines = rows.map((row) =>
    [
      row.id,
      row.sessionId,
      row.measuredAt,
      ...MWD_MEASUREMENT_FIELDS.map((fieldName) => row[fieldName]),
      row.createdAt,
    ]
      .map(escapeCsv)
      .join(","),
  );

  return [header.join(","), ...lines].join("\n");
};

export const serializeSurveyStationsAsCsv = (rows: SurveyExportRow[]) => {
  const header = [
    "id",
    "sessionId",
    "stationType",
    "measuredDepth",
    "inclination",
    "azimuth",
    "tvd",
    "northing",
    "easting",
    "verticalSection",
    "doglegSeverity",
    "buildRate",
    "turnRate",
    "closureDistance",
    "closureAzimuth",
    "courseLength",
    "verticalSectionAzimuth",
    "source",
    "notes",
    "createdAt",
    "updatedAt",
  ];
  const lines = rows.map((row) =>
    [
      row.id,
      row.sessionId,
      row.stationType,
      row.measuredDepth,
      row.inclination,
      row.azimuth,
      row.tvd,
      row.northing,
      row.easting,
      row.verticalSection,
      row.doglegSeverity,
      row.buildRate,
      row.turnRate,
      row.closureDistance,
      row.closureAzimuth,
      row.courseLength,
      row.verticalSectionAzimuth,
      row.source,
      row.notes,
      row.createdAt,
      row.updatedAt,
    ]
      .map(escapeCsv)
      .join(","),
  );

  return [header.join(","), ...lines].join("\n");
};
