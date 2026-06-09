import type { Prisma, PrismaClient } from "@prisma/client";
type PrismaDbClient = PrismaClient | Prisma.TransactionClient;
type RecordConfiguredWitsValuesInput = {
    sessionId: number;
    measuredAt: Date;
    depthMd?: unknown;
    source: Record<string, unknown>;
};
export type WitsDataValueFilters = {
    sessionId?: number;
    ownerUserId?: number;
    witsId?: string;
    measuredFrom?: Date;
    measuredTo?: Date;
    depthMin?: number;
    depthMax?: number;
    limit?: number;
};
export type WitsAlarmFilters = {
    sessionId?: number;
    ownerUserId?: number;
    witsId?: string;
    acknowledged?: boolean;
    limit?: number;
};
export type WitsDataExportFilters = {
    sessionId: number;
    witsId: string;
    measuredFrom?: Date;
    measuredTo?: Date;
    depthMin?: number;
    depthMax?: number;
    sampleMode?: "all" | "first_per_depth";
};
export declare const recordConfiguredWitsValues: (input: RecordConfiguredWitsValuesInput, db?: PrismaDbClient) => Promise<{
    configuredCount: number;
    loggedCount: number;
    alarmCount: number;
    outputQueuedCount: number;
    outputSkippedCount: number;
    skippedInvalid: string[];
    values: unknown[];
    alarms: unknown[];
    outputMessages: Record<string, unknown>[];
}>;
export declare const getWitsDataValues: (filters: WitsDataValueFilters, db?: PrismaDbClient) => Promise<unknown[]>;
export declare const getWitsDataValuesForExport: (filters: WitsDataExportFilters, db?: PrismaDbClient) => Promise<{
    id: bigint;
    measuredAt: Date;
    depthMd: unknown;
    rawValue: unknown;
    value: unknown;
    witsConfig: {
        witsId: string;
        name: string;
        units: string | null;
    } | null;
}[]>;
export declare const getWitsAlarmEvents: (filters: WitsAlarmFilters, db?: PrismaDbClient) => Promise<unknown[]>;
export declare const acknowledgeWitsAlarm: (id: bigint, acknowledgedById: number, db?: PrismaDbClient) => Promise<unknown>;
export declare const resolveWitsAlarm: (id: bigint, db?: PrismaDbClient) => Promise<unknown>;
export {};
//# sourceMappingURL=wits-data.service.d.ts.map