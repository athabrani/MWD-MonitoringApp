import { MWD_MEASUREMENT_FIELDS, } from "../utils/mwd-measurements.js";
const toPlainValue = (value) => {
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
const escapeCsv = (value) => {
    const plain = toPlainValue(value);
    if (plain === null) {
        return "";
    }
    const text = String(plain);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
export const buildExportFileName = (sessionCode, format) => {
    const safeSessionCode = sessionCode.replace(/[^a-zA-Z0-9_-]/g, "_");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `${safeSessionCode}_historical_${timestamp}.${format}`;
};
export const buildSurveyExportFileName = (sessionCode, stationType) => {
    const safeSessionCode = sessionCode.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeStationType = stationType.replace(/[^a-zA-Z0-9_-]/g, "_");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `${safeSessionCode}_survey_${safeStationType}_${timestamp}.csv`;
};
export const buildWitsExportFileName = (sessionCode, witsId, label) => {
    const safeSessionCode = sessionCode.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, "_");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `${safeSessionCode}_${witsId}_${safeLabel}_${timestamp}.csv`;
};
export const serializeHistoricalDataAsJson = (rows) => {
    return JSON.stringify(rows.map((row) => {
        const serializedRow = {
            id: toPlainValue(row.id),
            sessionId: row.sessionId,
            measuredAt: toPlainValue(row.measuredAt),
        };
        for (const fieldName of MWD_MEASUREMENT_FIELDS) {
            serializedRow[fieldName] = toPlainValue(row[fieldName]);
        }
        serializedRow.createdAt = toPlainValue(row.createdAt);
        return serializedRow;
    }), null, 2);
};
export const serializeHistoricalDataAsCsv = (rows) => {
    const header = ["id", "sessionId", "measuredAt", ...MWD_MEASUREMENT_FIELDS, "createdAt"];
    const lines = rows.map((row) => [
        row.id,
        row.sessionId,
        row.measuredAt,
        ...MWD_MEASUREMENT_FIELDS.map((fieldName) => row[fieldName]),
        row.createdAt,
    ]
        .map(escapeCsv)
        .join(","));
    return [header.join(","), ...lines].join("\n");
};
export const serializeSurveyStationsAsCsv = (rows) => {
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
    const lines = rows.map((row) => [
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
        .join(","));
    return [header.join(","), ...lines].join("\n");
};
const formatCsvDateTime = (date) => {
    return date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
};
export const serializeWitsValuesAsCsv = (rows, valueHeader) => {
    const header = ["Time", "Depth", valueHeader];
    const lines = rows.map((row) => [
        formatCsvDateTime(row.measuredAt),
        row.depthMd,
        row.value ?? row.rawValue,
    ]
        .map(escapeCsv)
        .join(","));
    return [header.join(","), ...lines].join("\n");
};
//# sourceMappingURL=export.service.js.map