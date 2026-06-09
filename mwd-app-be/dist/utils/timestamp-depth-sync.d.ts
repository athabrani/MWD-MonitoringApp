import type { Prisma, PrismaClient } from "@prisma/client";
type PrismaDbClient = PrismaClient | Prisma.TransactionClient;
type SyncTimestampAndDepthInput = {
    sessionId: number;
    measuredAt?: Date | null;
    depthMd?: unknown;
    excludeId?: bigint;
};
export declare const syncTimestampAndDepth: (input: SyncTimestampAndDepthInput, db?: PrismaDbClient) => Promise<{
    measuredAt: Date;
    syncInfo: {
        adjusted: boolean;
        reason: string | null;
        originalMeasuredAt: Date | null;
        latestMeasuredAt: Date | null;
        latestDepthMd: number | null;
        currentDepthMd: number | null;
    };
}>;
export {};
//# sourceMappingURL=timestamp-depth-sync.d.ts.map