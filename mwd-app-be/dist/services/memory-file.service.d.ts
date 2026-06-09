import { type MeasurementField } from "../utils/mwd-measurements.js";
type MemoryJsonScalar = string | number | boolean | null;
type MemoryFileImportInput = {
    sessionId: number;
    importedById: number;
    fileName?: string | null;
    source?: string | null;
    content?: string | null;
    rows?: Record<string, unknown>[];
    delimiter?: string | null;
    hasHeader?: boolean;
    columns?: string[];
    depthField?: string | null;
    measuredAtField?: string | null;
    fieldMappings?: unknown;
};
type MemoryCorrelationInput = {
    memoryFileId: number;
    correlatedById: number;
    mode?: "depth" | "timestamp";
    depthOffset?: number;
    measuredAtOffsetMs?: number;
    maxDepthDifference?: number;
    maxTimeDifferenceMs?: number;
    fieldMappings?: unknown;
    includeHidden?: boolean;
    dryRun?: boolean;
};
export type MemoryFieldMapping = {
    source: string;
    target: MeasurementField;
};
export declare const normalizeFieldMappings: (value: unknown) => MemoryFieldMapping[];
export declare const importMemoryFile: (input: MemoryFileImportInput) => Promise<{
    file: Record<string, unknown>;
    importedCount: number;
    fieldMappings: {
        source: string;
        target: keyof import("../utils/mwd-measurements.js").MWDMeasurementInput;
    }[];
    sample: {
        rowNumber: number;
        measuredAt?: Date;
        depthMd?: number;
        values: Record<string, MemoryJsonScalar>;
    }[];
}>;
export declare const getMemoryFiles: (options?: {
    sessionId?: number;
    limit?: number;
}) => Promise<Record<string, unknown>[]>;
export declare const getMemoryFileById: (id: number) => Promise<Record<string, unknown> | null>;
export declare const getMemoryDataPoints: (memoryFileId: number, options?: {
    limit?: number;
    skip?: number;
}) => Promise<Record<string, unknown>[]>;
export declare const deleteMemoryFile: (id: number) => Promise<Record<string, unknown>>;
export declare const getMemoryCorrelations: (options?: {
    sessionId?: number;
    memoryFileId?: number;
    limit?: number;
}) => Promise<Record<string, unknown>[]>;
export declare const correlateMemoryFile: (input: MemoryCorrelationInput) => Promise<{
    memoryFileId: number;
    sessionId: unknown;
    mode: "depth" | "timestamp";
    dryRun: boolean;
    pointCount: number;
    matchedCount: number;
    affectedCount: number;
    skippedCount: number;
    depthOffset: number;
    measuredAtOffsetMs: number;
    maxDepthDifference: number;
    maxTimeDifferenceMs: number;
    fieldMappings: {
        source: string;
        target: keyof import("../utils/mwd-measurements.js").MWDMeasurementInput;
    }[];
    sample: Record<string, unknown>[];
}>;
export {};
//# sourceMappingURL=memory-file.service.d.ts.map