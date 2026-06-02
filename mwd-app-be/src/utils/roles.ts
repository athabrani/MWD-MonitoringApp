export const SYSTEM_ROLES = {
  admin: "admin",
  engineer: "engineer",
  operator: "operator",
} as const;

export type SystemRoleName = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];

export const ALL_SYSTEM_ROLE_NAMES = Object.values(
  SYSTEM_ROLES,
) as SystemRoleName[];

const LEGACY_ROLE_ALIASES: Record<string, SystemRoleName> = {
  admin: SYSTEM_ROLES.admin,
  engineer: SYSTEM_ROLES.engineer,
  operator: SYSTEM_ROLES.operator,
  user: SYSTEM_ROLES.operator,
};

export const normalizeRoleName = (value: unknown) => {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim().toLowerCase();
  return LEGACY_ROLE_ALIASES[normalized] ?? normalized;
};

export const isSystemRoleName = (value: unknown): value is SystemRoleName => {
  return ALL_SYSTEM_ROLE_NAMES.includes(
    normalizeRoleName(value) as SystemRoleName,
  );
};

export const hasRole = (roleName: unknown, allowedRoles: readonly string[]) => {
  const normalizedRoleName = normalizeRoleName(roleName);

  return (
    !!normalizedRoleName &&
    allowedRoles.some(
      (allowedRole) => normalizeRoleName(allowedRole) === normalizedRoleName,
    )
  );
};

export const canManageUsers = (roleName: unknown) => {
  return hasRole(roleName, [SYSTEM_ROLES.admin]);
};

export const canManageRoles = (roleName: unknown) => {
  return hasRole(roleName, [SYSTEM_ROLES.admin]);
};

export const canExportHistoricalData = (roleName: unknown) => {
  return hasRole(roleName, [SYSTEM_ROLES.admin, SYSTEM_ROLES.engineer]);
};

export const canModifyMonitoringData = (roleName: unknown) => {
  return hasRole(roleName, [SYSTEM_ROLES.admin, SYSTEM_ROLES.engineer]);
};

export const canViewAllSessions = (roleName: unknown) => {
  return hasRole(roleName, [
    SYSTEM_ROLES.admin,
    SYSTEM_ROLES.engineer,
    SYSTEM_ROLES.operator,
  ]);
};

export const canAccessSessionOwner = (
  roleName: unknown,
  userId: number | undefined,
  sessionUserId: number,
) => {
  return canViewAllSessions(roleName) || userId === sessionUserId;
};
