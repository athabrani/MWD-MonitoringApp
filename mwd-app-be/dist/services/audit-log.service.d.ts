import type { Prisma } from "@prisma/client";
export type CreateAuditLogInput = {
    userId?: number | null;
    action: string;
    details?: string | null;
    metadata?: Record<string, unknown> | null;
};
export type ListAuditLogsQuery = {
    userId?: number;
    action?: string;
    limit?: number;
    beforeId?: bigint;
};
export declare const createAuditLog: (input: CreateAuditLogInput) => Promise<{
    id: bigint;
    action: string;
    details: string | null;
    metadata: Prisma.JsonValue;
    createdAt: Date;
    user: {
        id: number;
        username: string;
        email: string;
    } | null;
    userId: number | null;
}>;
export declare const listAuditLogs: (query: ListAuditLogsQuery) => Promise<{
    id: bigint;
    action: string;
    details: string | null;
    metadata: Prisma.JsonValue;
    createdAt: Date;
    user: {
        id: number;
        username: string;
        email: string;
    } | null;
    userId: number | null;
}[]>;
export declare const getAuditLogById: (id: bigint) => Promise<{
    id: bigint;
    action: string;
    details: string | null;
    metadata: Prisma.JsonValue;
    createdAt: Date;
    user: {
        id: number;
        username: string;
        email: string;
    } | null;
    userId: number | null;
} | null>;
//# sourceMappingURL=audit-log.service.d.ts.map