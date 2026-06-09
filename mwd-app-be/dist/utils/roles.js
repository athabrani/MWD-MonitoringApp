export const SYSTEM_ROLES = {
    admin: "admin",
    engineer: "engineer",
    operator: "operator",
};
export const ALL_SYSTEM_ROLE_NAMES = Object.values(SYSTEM_ROLES);
const LEGACY_ROLE_ALIASES = {
    admin: SYSTEM_ROLES.admin,
    engineer: SYSTEM_ROLES.engineer,
    operator: SYSTEM_ROLES.operator,
    user: SYSTEM_ROLES.operator,
};
export const normalizeRoleName = (value) => {
    if (typeof value !== "string") {
        return "";
    }
    const normalized = value.trim().toLowerCase();
    return LEGACY_ROLE_ALIASES[normalized] ?? normalized;
};
export const isSystemRoleName = (value) => {
    return ALL_SYSTEM_ROLE_NAMES.includes(normalizeRoleName(value));
};
export const hasRole = (roleName, allowedRoles) => {
    const normalizedRoleName = normalizeRoleName(roleName);
    return (!!normalizedRoleName &&
        allowedRoles.some((allowedRole) => normalizeRoleName(allowedRole) === normalizedRoleName));
};
export const canManageUsers = (roleName) => {
    return hasRole(roleName, [SYSTEM_ROLES.admin]);
};
export const canManageRoles = (roleName) => {
    return hasRole(roleName, [SYSTEM_ROLES.admin]);
};
export const canExportHistoricalData = (roleName) => {
    return hasRole(roleName, [SYSTEM_ROLES.admin, SYSTEM_ROLES.engineer]);
};
export const canModifyMonitoringData = (roleName) => {
    return hasRole(roleName, [SYSTEM_ROLES.admin, SYSTEM_ROLES.engineer]);
};
export const canViewAllSessions = (roleName) => {
    return hasRole(roleName, [
        SYSTEM_ROLES.admin,
        SYSTEM_ROLES.engineer,
        SYSTEM_ROLES.operator,
    ]);
};
export const canAccessSessionOwner = (roleName, userId, sessionUserId) => {
    return canViewAllSessions(roleName) || userId === sessionUserId;
};
//# sourceMappingURL=roles.js.map