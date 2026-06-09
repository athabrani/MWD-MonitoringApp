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
export type SurveyExcelExportResult = {
    buffer: Buffer;
    fileName: string;
};
export declare const buildSurveyExcelExport: (rows: SurveyExportRow[], fileName: string) => Promise<SurveyExcelExportResult>;
export {};
//# sourceMappingURL=survey-excel-export.service.d.ts.map