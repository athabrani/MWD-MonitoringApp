import { type MWDMeasurementInput } from "../utils/mwd-measurements.js";
type ExportRow = {
    id: bigint;
    sessionId: number;
    measuredAt: Date;
    createdAt: Date;
} & {
    [Field in keyof MWDMeasurementInput]: unknown;
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
type WitsValueExportRow = {
    measuredAt: Date;
    depthMd: unknown;
    value: unknown;
    rawValue: unknown;
};
export declare const buildExportFileName: (sessionCode: string, format: "json" | "csv") => string;
export declare const buildSurveyExportFileName: (sessionCode: string, stationType: string) => string;
export declare const buildWitsExportFileName: (sessionCode: string, witsId: string, label: string) => string;
export declare const serializeHistoricalDataAsJson: (rows: ExportRow[]) => string;
export declare const serializeHistoricalDataAsCsv: (rows: ExportRow[]) => string;
export declare const serializeSurveyStationsAsCsv: (rows: SurveyExportRow[]) => string;
export declare const serializeWitsValuesAsCsv: (rows: WitsValueExportRow[], valueHeader: string) => string;
export {};
//# sourceMappingURL=export.service.d.ts.map