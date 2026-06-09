export type SurveyConfigInput = {
    sessionId: number;
    wellName?: string | null;
    rigName?: string | null;
    companyName?: string | null;
    fieldName?: string | null;
    location?: string | null;
    units?: string | null;
    proposedAzimuth?: number | null;
    surveyDepthOffset?: number | null;
    northReference?: string | null;
    declination?: number | null;
    latitude?: number | null;
    longitude?: number | null;
    northingOrigin?: number | null;
    eastingOrigin?: number | null;
    elevationKb?: number | null;
    elevationDf?: number | null;
    elevationGl?: number | null;
    sectionType?: string | null;
    plotTemplateId?: number | null;
};
export declare const getSurveyConfigBySessionId: (sessionId: number) => Promise<unknown>;
export declare const upsertSurveyConfig: (input: SurveyConfigInput) => Promise<unknown>;
export declare const deleteSurveyConfig: (sessionId: number) => Promise<unknown>;
//# sourceMappingURL=survey-config.service.d.ts.map