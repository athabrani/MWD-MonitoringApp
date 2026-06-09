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
export type SurveyPdfExportResult = {
    buffer: Buffer;
    fileName: string;
};
export declare const buildSurveyPdfExport: (rows: SurveyExportRow[], fileName: string, sessionInfo?: {
    wellName?: string;
    rigName?: string;
}) => Promise<SurveyPdfExportResult>;
export {};
//# sourceMappingURL=survey-pdf-export.service.d.ts.map