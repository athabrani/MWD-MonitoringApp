type FailoverEventInput = {
    connectionStatusId: number;
    fromNode?: string | null;
    toNode?: string | null;
    reason?: string | null;
    eventAt?: Date;
    resolvedAt?: Date | null;
};
type FailoverEventUpdateInput = {
    connectionStatusId?: number;
    fromNode?: string | null;
    toNode?: string | null;
    reason?: string | null;
    eventAt?: Date;
    resolvedAt?: Date | null;
};
export declare const createFailoverEvent: (input: FailoverEventInput) => Promise<{
    id: number;
    createdAt: Date;
    reason: string | null;
    connectionStatusId: number;
    connectionStatus: {
        id: number;
        source: string;
        status: string;
        checkedAt: Date;
    };
    fromNode: string | null;
    toNode: string | null;
    eventAt: Date;
    resolvedAt: Date | null;
}>;
export declare const getAllFailoverEvents: (connectionStatusId?: number) => Promise<{
    id: number;
    createdAt: Date;
    reason: string | null;
    connectionStatusId: number;
    connectionStatus: {
        id: number;
        source: string;
        status: string;
        checkedAt: Date;
    };
    fromNode: string | null;
    toNode: string | null;
    eventAt: Date;
    resolvedAt: Date | null;
}[]>;
export declare const getFailoverEventById: (id: number) => Promise<{
    id: number;
    createdAt: Date;
    reason: string | null;
    connectionStatusId: number;
    connectionStatus: {
        id: number;
        source: string;
        status: string;
        checkedAt: Date;
    };
    fromNode: string | null;
    toNode: string | null;
    eventAt: Date;
    resolvedAt: Date | null;
} | null>;
export declare const updateFailoverEvent: (id: number, input: FailoverEventUpdateInput) => Promise<{
    id: number;
    createdAt: Date;
    reason: string | null;
    connectionStatusId: number;
    connectionStatus: {
        id: number;
        source: string;
        status: string;
        checkedAt: Date;
    };
    fromNode: string | null;
    toNode: string | null;
    eventAt: Date;
    resolvedAt: Date | null;
}>;
export declare const deleteFailoverEvent: (id: number) => Promise<{
    id: number;
    createdAt: Date;
    reason: string | null;
    connectionStatusId: number;
    connectionStatus: {
        id: number;
        source: string;
        status: string;
        checkedAt: Date;
    };
    fromNode: string | null;
    toNode: string | null;
    eventAt: Date;
    resolvedAt: Date | null;
}>;
export {};
//# sourceMappingURL=failover-event.service.d.ts.map