export declare const SYSTEM_ROLES: {
    readonly admin: "admin";
    readonly engineer: "engineer";
    readonly operator: "operator";
};
export type SystemRoleName = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];
export declare const ALL_SYSTEM_ROLE_NAMES: SystemRoleName[];
export declare const normalizeRoleName: (value: unknown) => string;
export declare const isSystemRoleName: (value: unknown) => value is SystemRoleName;
export declare const hasRole: (roleName: unknown, allowedRoles: readonly string[]) => boolean;
export declare const canManageUsers: (roleName: unknown) => boolean;
export declare const canManageRoles: (roleName: unknown) => boolean;
export declare const canExportHistoricalData: (roleName: unknown) => boolean;
export declare const canModifyMonitoringData: (roleName: unknown) => boolean;
export declare const canViewAllSessions: (roleName: unknown) => boolean;
export declare const canAccessSessionOwner: (roleName: unknown, userId: number | undefined, sessionUserId: number) => boolean;
//# sourceMappingURL=roles.d.ts.map