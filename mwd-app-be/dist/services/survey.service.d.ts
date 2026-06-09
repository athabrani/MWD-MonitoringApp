import type { Prisma, PrismaClient } from "@prisma/client";
type PrismaDbClient = PrismaClient | Prisma.TransactionClient;
export type SurveyStationInputData = {
    sessionId: number;
    stationType?: string;
    measuredDepth: number | string;
    inclination: number | string;
    azimuth: number | string;
    tvd?: number | string | null;
    northing?: number | string | null;
    easting?: number | string | null;
    verticalSectionAzimuth?: number | string | null;
    source?: string;
    notes?: string | null;
};
export type SurveyStationUpdateData = Partial<Omit<SurveyStationInputData, "sessionId">> & {
    sessionId?: number;
};
export type SurveyStationFilters = {
    sessionId?: number;
    ownerUserId?: number;
    stationType?: string;
};
export type WellPlanImportResult = {
    importedCount: number;
    skippedCount: number;
    errors: string[];
    data: unknown[];
};
export type SurveyTrajectoryPoint = {
    id: string;
    stationType: string;
    measuredDepth: number;
    inclination: number;
    azimuth: number;
    tvd: number | null;
    northing: number | null;
    easting: number | null;
    verticalSection: number | null;
};
export declare const getTrajectoryPlotData: (input: {
    sessionId: number;
    depthMin?: number;
    depthMax?: number;
    actualStationType?: string;
    planStationType?: string;
}) => Promise<{
    sessionId: number;
    actual: SurveyTrajectoryPoint[];
    planned: SurveyTrajectoryPoint[];
    planView: {
        actual: {
            md: number;
            x: number | null;
            y: number | null;
            tvd: number | null;
            verticalSection: number | null;
        }[];
        planned: {
            md: number;
            x: number | null;
            y: number | null;
            tvd: number | null;
            verticalSection: number | null;
        }[];
    };
    verticalSection: {
        actual: {
            md: number;
            x: number | null;
            y: number | null;
        }[];
        planned: {
            md: number;
            x: number | null;
            y: number | null;
        }[];
    };
}>;
export declare const recalculateSurveyStations: (sessionId: number, stationType?: string, verticalSectionAzimuth?: number, db?: PrismaDbClient) => Promise<unknown[]>;
export declare const createSurveyStation: (input: SurveyStationInputData, db?: PrismaDbClient) => Promise<unknown>;
export declare const getSurveyStations: (filters: SurveyStationFilters, db?: PrismaDbClient) => Promise<unknown[]>;
export declare const getSurveyStationById: (id: bigint, db?: PrismaDbClient) => Promise<unknown>;
export declare const updateSurveyStation: (id: bigint, input: SurveyStationUpdateData, db?: PrismaDbClient) => Promise<unknown>;
export declare const deleteSurveyStation: (id: bigint, db?: PrismaDbClient) => Promise<unknown>;
export declare const importSurveyFromMwdData: (input: {
    sessionId: number;
    stationType?: string;
    replace?: boolean;
    verticalSectionAzimuth?: number;
}, db?: PrismaDbClient) => Promise<{
    importedCount: number;
    data: unknown[];
}>;
export declare const parseWellPlanCsv: (csv: string) => {
    stations: SurveyStationInputData[];
    errors: string[];
};
export declare const importWellPlanCsv: (input: {
    sessionId: number;
    csv: string;
    replace?: boolean;
    stationType?: string;
    verticalSectionAzimuth?: number;
}, db?: PrismaDbClient) => Promise<WellPlanImportResult>;
export {};
//# sourceMappingURL=survey.service.d.ts.map