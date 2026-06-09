type ConnectionStatusInput = {
    source: string;
    status: string;
    description?: string | null;
    checkedAt?: Date;
    responseMs?: number | null;
};
type ConnectionStatusUpdateInput = {
    source?: string;
    status?: string;
    description?: string | null;
    checkedAt?: Date;
    responseMs?: number | null;
};
export declare const createConnectionStatus: (input: ConnectionStatusInput) => Promise<{
    id: number;
    createdAt: Date;
    updatedAt: Date;
    description: string | null;
    source: string;
    status: string;
    checkedAt: Date;
    responseMs: number | null;
}>;
export declare const getAllConnectionStatuses: () => Promise<{
    id: number;
    createdAt: Date;
    updatedAt: Date;
    description: string | null;
    source: string;
    status: string;
    checkedAt: Date;
    responseMs: number | null;
}[]>;
export declare const getConnectionStatusById: (id: number) => Promise<{
    id: number;
    createdAt: Date;
    updatedAt: Date;
    description: string | null;
    source: string;
    status: string;
    checkedAt: Date;
    responseMs: number | null;
} | null>;
export declare const updateConnectionStatus: (id: number, input: ConnectionStatusUpdateInput) => Promise<{
    id: number;
    createdAt: Date;
    updatedAt: Date;
    description: string | null;
    source: string;
    status: string;
    checkedAt: Date;
    responseMs: number | null;
}>;
export declare const deleteConnectionStatus: (id: number) => Promise<{
    id: number;
    createdAt: Date;
    updatedAt: Date;
    description: string | null;
    source: string;
    status: string;
    checkedAt: Date;
    responseMs: number | null;
}>;
export {};
//# sourceMappingURL=connection-status.service.d.ts.map