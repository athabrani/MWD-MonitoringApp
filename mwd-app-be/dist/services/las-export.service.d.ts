type LasExportInput = {
    sessionId: number;
    sessionCode: string;
    wellName?: string | null;
    rigName?: string | null;
    measuredFrom?: Date;
    measuredTo?: Date;
    depthMin?: number;
    depthMax?: number;
    includeWits?: boolean;
    includeSurvey?: boolean;
    surveyStationType?: string;
    nullValue?: number;
    depthUnit?: string;
    stepDepth?: number;
    depthPrecision?: number;
    maxGap?: number;
    stopAtLastSurveyDepth?: boolean;
    dateTimeInFirstColumn?: boolean;
    correctDepthColumnForTvd?: boolean;
    interpolateSurvey?: boolean;
    includeSurveysInOtherSection?: boolean;
    columns?: LasColumnSelection[];
    wellInfo?: LasWellInfoItem[];
};
type LasColumnSelection = string | {
    key?: string;
    witsId?: string;
    mnemonic?: string;
    enabled?: boolean;
};
type LasWellInfoItem = {
    name: string;
    units?: string;
    data?: string | number | null;
    description?: string;
};
export declare const buildLasFileName: (sessionCode: string) => string;
export declare const buildLasExport: (input: LasExportInput) => Promise<{
    fileName: string;
    rowCount: number;
    content: string;
}>;
export {};
//# sourceMappingURL=las-export.service.d.ts.map