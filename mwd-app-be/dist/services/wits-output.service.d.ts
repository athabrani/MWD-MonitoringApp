import type { Prisma, PrismaClient } from "@prisma/client";
type PrismaDbClient = PrismaClient | Prisma.TransactionClient;
type WitsOutputConfig = {
    id: number;
    witsId: string;
    name: string;
    mappedField: string | null;
    decimalPlaces: number;
    sendToRigWitsPort: boolean;
    doNotRepeat: boolean;
};
type QueueWitsOutputInput = {
    sessionId: number;
    measuredAt: Date;
    depthMd?: unknown;
    value: unknown;
    config: WitsOutputConfig;
    reason?: string | null;
    db?: PrismaDbClient;
};
type WitsOutputFilters = {
    sessionId?: number;
    ownerUserId?: number;
    targetPort?: string;
    status?: string;
    witsId?: string;
    limit?: number;
};
export declare const buildWitsOutputPayload: (witsId: string, value: number, decimalPlaces: number) => string;
export declare const queueWitsOutputForConfig: (input: QueueWitsOutputInput) => Promise<{
    queuedCount: number;
    skippedCount: number;
    messages: Record<string, unknown>[];
}>;
export declare const queueWitsOutputsForConfigs: (input: {
    sessionId: number;
    measuredAt: Date;
    depthMd?: unknown;
    values: Array<{
        config: WitsOutputConfig;
        value: unknown;
    }>;
    reason?: string | null;
    db?: PrismaDbClient;
}) => Promise<{
    queuedCount: number;
    skippedCount: number;
    messages: Record<string, unknown>[];
}>;
export declare const getWitsOutputMessages: (filters: WitsOutputFilters) => Promise<Record<string, unknown>[]>;
export declare const updateWitsOutputStatus: (id: bigint, status: "queued" | "sent" | "failed" | "skipped", reason?: string | null) => Promise<Record<string, unknown>>;
export declare const queueWitsOutputFromLatestMwdData: (sessionId: number) => Promise<{
    queuedCount: number;
    skippedCount: number;
    messages: never[];
    source: null;
} | {
    source: {
        mwdDataId: unknown;
        measuredAt: Date;
        depthMd: unknown;
    };
    queuedCount: number;
    skippedCount: number;
    messages: Record<string, unknown>[];
}>;
export declare const isValidTargetPort: (value: unknown) => boolean;
export declare const isValidStatus: (value: unknown) => boolean;
export {};
//# sourceMappingURL=wits-output.service.d.ts.map