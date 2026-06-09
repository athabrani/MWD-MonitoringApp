export type SurveyStationInput = {
    measuredDepth: number;
    inclination: number;
    azimuth: number;
    tvd?: number | null;
    northing?: number | null;
    easting?: number | null;
};
export type ProjectedSurveyStation = SurveyStationInput & {
    tvd: number;
    northing: number;
    easting: number;
    verticalSection: number;
    doglegSeverity: number | null;
    buildRate: number | null;
    turnRate: number | null;
    closureDistance: number;
    closureAzimuth: number;
    courseLength: number | null;
    verticalSectionAzimuth: number;
};
export type SurveyProjectionOptions = {
    verticalSectionAzimuth?: number;
};
export declare const projectSurveyStations: (stations: SurveyStationInput[], options?: SurveyProjectionOptions) => ProjectedSurveyStation[];
//# sourceMappingURL=survey-projection.d.ts.map