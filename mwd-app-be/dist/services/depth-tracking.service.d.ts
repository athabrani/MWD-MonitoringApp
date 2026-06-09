import type { Prisma, PrismaClient } from "@prisma/client";
type PrismaDbClient = PrismaClient | Prisma.TransactionClient;
type DepthTrackingInput = {
    sessionId: number;
    measuredAt?: Date;
    bitDepth?: unknown;
    holeDepth?: unknown;
    blockDepth?: unknown;
    rop?: unknown;
    mode?: string | null;
    status?: string | null;
    source?: string | null;
    settings?: unknown;
    raw?: unknown;
};
type DepthTrackingFilters = {
    sessionId: number;
    measuredFrom?: Date;
    measuredTo?: Date;
    limit?: number;
};
export declare const buildDepthTrackingInputFromMwdSource: (input: {
    sessionId: number;
    measuredAt: Date;
    source: Record<string, unknown>;
}) => {
    sessionId: number;
    measuredAt: Date;
    bitDepth: number | null;
    holeDepth: number | null;
    blockDepth: number | null;
    rop: number | null;
    source: string;
    raw: {
        witsIds: {
            [k: string]: unknown;
        };
    };
};
export declare const updateDepthTrackingState: (input: DepthTrackingInput, client?: PrismaDbClient) => Promise<{
    state: Record<string, unknown>;
    sample: Record<string, unknown>;
}>;
export declare const getDepthTrackingState: (sessionId: number) => Promise<Record<string, unknown> | null>;
export declare const getDepthTrackingSamples: (filters: DepthTrackingFilters) => Promise<Record<string, unknown>[]>;
export declare const recalculateDepthTrackingFromMwdData: (sessionId: number) => Promise<{
    count: number;
    state: Record<string, unknown> | null;
}>;
export {};
//# sourceMappingURL=depth-tracking.service.d.ts.map