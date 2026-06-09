import type { Prisma, PrismaClient } from "@prisma/client";
type PrismaDbClient = PrismaClient | Prisma.TransactionClient;
export declare const CLEAR_DATA_TARGETS: readonly ["mwd_data", "wits_values", "wits_alarms", "surveys", "depth_tracking", "wits_output", "edit_history"];
export type ClearDataTarget = (typeof CLEAR_DATA_TARGETS)[number];
type DepthRange = {
    startDepth: number;
    endDepth: number;
};
type SessionBackup = {
    version: 1;
    createdAt: string;
    sessionId: number;
    depthRange: DepthRange;
    targets: ClearDataTarget[];
    data: Partial<Record<ClearDataTarget, unknown[] | Record<string, unknown> | null>>;
};
type ConfigurationBackupTarget = "wits_configs" | "plot_templates";
export declare const CONFIGURATION_BACKUP_TARGETS: readonly ["wits_configs", "plot_templates"];
type ConfigurationBackup = {
    version: 1;
    type: "configuration_backup";
    createdAt: string;
    targets: ConfigurationBackupTarget[];
    data: {
        wits_configs?: unknown[];
        plot_templates?: unknown[];
    };
};
export declare const normalizeTargets: (targets: unknown) => ClearDataTarget[];
export declare const getValidTargets: () => ("mwd_data" | "wits_values" | "wits_alarms" | "surveys" | "depth_tracking" | "wits_output" | "edit_history")[];
export declare const normalizeConfigurationTargets: (targets: unknown) => ConfigurationBackupTarget[];
export declare const getValidConfigurationTargets: () => ("wits_configs" | "plot_templates")[];
export declare const createSessionBackup: (sessionId: number, depthRange: DepthRange, targets: ClearDataTarget[], client?: PrismaDbClient) => Promise<{
    session: Record<string, unknown>;
    backup: SessionBackup;
    counts: {
        [k: string]: number;
    };
}>;
export declare const previewClearSessionData: (sessionId: number, depthRange: DepthRange, targets: ClearDataTarget[]) => Promise<{
    session: Record<string, unknown>;
    depthRange: DepthRange;
    targets: ("mwd_data" | "wits_values" | "wits_alarms" | "surveys" | "depth_tracking" | "wits_output" | "edit_history")[];
    counts: {
        [k: string]: number;
    };
}>;
export declare const clearSessionData: (sessionId: number, depthRange: DepthRange, targets: ClearDataTarget[]) => Promise<{
    session: Record<string, unknown>;
    depthRange: DepthRange;
    targets: ("mwd_data" | "wits_values" | "wits_alarms" | "surveys" | "depth_tracking" | "wits_output" | "edit_history")[];
    deleted: Record<string, number>;
    backup: SessionBackup;
}>;
export declare const restoreSessionData: (sessionId: number, backup: SessionBackup, targets: ClearDataTarget[], replaceExisting: boolean) => Promise<{
    sessionId: number;
    targets: ("mwd_data" | "wits_values" | "wits_alarms" | "surveys" | "depth_tracking" | "wits_output" | "edit_history")[];
    restored: Record<string, number>;
}>;
export declare const createConfigurationBackup: (targets: ConfigurationBackupTarget[]) => Promise<{
    targets: ConfigurationBackupTarget[];
    counts: {
        plot_templates?: number;
        wits_configs?: number;
    };
    backup: ConfigurationBackup;
}>;
export declare const restoreConfigurationBackup: (backup: ConfigurationBackup, targets: ConfigurationBackupTarget[]) => Promise<{
    targets: ConfigurationBackupTarget[];
    restored: Record<string, number>;
}>;
export {};
//# sourceMappingURL=system-utility.service.d.ts.map