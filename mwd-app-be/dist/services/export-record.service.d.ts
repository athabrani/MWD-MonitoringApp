type ExportRecordInput = {
    sessionId: number;
    exportedById: number;
    fileName: string;
    fileType: string;
    filePath?: string | null;
    rowCount?: number | null;
};
export declare const createExportRecord: (input: ExportRecordInput) => Promise<{
    id: number;
    sessionId: number;
    session: {
        id: number;
        sessionCode: string;
        wellName: string | null;
        rigName: string | null;
    };
    fileName: string;
    fileType: string;
    filePath: string | null;
    rowCount: number | null;
    exportedAt: Date;
    exportedBy: {
        id: number;
        username: string;
        email: string;
        role: {
            id: number;
            name: string;
        };
    };
    exportedById: number;
}>;
export declare const getAllExportRecords: () => Promise<{
    id: number;
    sessionId: number;
    session: {
        id: number;
        sessionCode: string;
        wellName: string | null;
        rigName: string | null;
    };
    fileName: string;
    fileType: string;
    filePath: string | null;
    rowCount: number | null;
    exportedAt: Date;
    exportedBy: {
        id: number;
        username: string;
        email: string;
        role: {
            id: number;
            name: string;
        };
    };
    exportedById: number;
}[]>;
export {};
//# sourceMappingURL=export-record.service.d.ts.map