import { type MeasurementField } from "../utils/mwd-measurements.js";
type EditOperationInput = {
    sessionId: number;
    editedById: number;
    depthMin: number;
    depthMax: number;
    note?: string | null;
};
type DepthRangeOptions = {
    includeHidden?: boolean;
};
type MoveDepthInput = EditOperationInput & DepthRangeOptions & {
    depthOffset: number;
};
type CopyDepthInput = EditOperationInput & DepthRangeOptions & {
    depthOffset: number;
    measuredAtOffsetMs?: number;
};
type RescaleInput = EditOperationInput & DepthRangeOptions & {
    field: MeasurementField;
    scaleFactor: number;
    biasOffset: number;
};
export declare const previewMoveDepthRange: (input: MoveDepthInput) => Promise<{
    operation: string;
    affectedCount: number;
    depthOffset: number;
    sample: {
        id: unknown;
        measuredAt: unknown;
        isHidden: unknown;
        currentDepthMd: number | null;
        newDepthMd: number | null;
    }[];
}>;
export declare const previewCopyDepthRange: (input: CopyDepthInput) => Promise<{
    operation: string;
    affectedCount: number;
    depthOffset: number;
    measuredAtOffsetMs: number;
    sample: {
        id: unknown;
        measuredAt: Date | null;
        copiedMeasuredAt: Date | null;
        isHidden: unknown;
        currentDepthMd: number | null;
        copiedDepthMd: number | null;
    }[];
}>;
export declare const previewRescaleDepthRange: (input: RescaleInput) => Promise<{
    operation: string;
    affectedCount: number;
    field: keyof import("../utils/mwd-measurements.js").MWDMeasurementInput;
    scaleFactor: number;
    biasOffset: number;
    sample: {
        id: unknown;
        measuredAt: unknown;
        depthMd: unknown;
        isHidden: unknown;
        currentValue: number | null;
        newValue: number | null;
    }[];
}>;
export declare const setHiddenByDepthRange: (input: EditOperationInput & DepthRangeOptions & {
    hidden: boolean;
}) => Promise<{
    affectedCount: number;
}>;
export declare const deleteDepthRange: (input: EditOperationInput & DepthRangeOptions) => Promise<{
    affectedCount: number;
}>;
export declare const moveDepthRange: (input: MoveDepthInput) => Promise<{
    affectedCount: number;
    depthOffset: number;
}>;
export declare const copyDepthRange: (input: CopyDepthInput) => Promise<{
    affectedCount: number;
    depthOffset: number;
    measuredAtOffsetMs: number;
}>;
export declare const rescaleDepthRange: (input: RescaleInput) => Promise<{
    affectedCount: number;
    field: keyof import("../utils/mwd-measurements.js").MWDMeasurementInput;
    scaleFactor: number;
    biasOffset: number;
}>;
export declare const getEditOperations: (options?: {
    sessionId?: number;
    limit?: number;
}) => Promise<unknown[]>;
export {};
//# sourceMappingURL=mwd-data-edit.service.d.ts.map