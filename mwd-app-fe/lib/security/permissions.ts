import type { User, UserRole } from "@/types";

export type SecurityAction =
  | "admin:user:create"
  | "admin:user:update"
  | "admin:user:delete"
  | "admin:role-page-access:update"
  | "system:backup"
  | "system:restore"
  | "system:clear-data"
  | "configuration:write"
  | "wits-config:write";

const actionRoles: Record<SecurityAction, UserRole[]> = {
  "admin:user:create": ["admin"],
  "admin:user:update": ["admin"],
  "admin:user:delete": ["admin"],
  "admin:role-page-access:update": ["admin"],
  "system:backup": ["admin"],
  "system:restore": ["admin"],
  "system:clear-data": ["admin"],
  "configuration:write": ["engineer", "admin"],
  "wits-config:write": ["engineer", "admin"],
};

export function canPerformAction(user: Pick<User, "role"> | null | undefined, action: SecurityAction) {
  return Boolean(user?.role && actionRoles[action].includes(user.role));
}

export function requireActionPermission(
  user: Pick<User, "role"> | null | undefined,
  action: SecurityAction
) {
  if (canPerformAction(user, action)) return "";
  return "Role Anda tidak memiliki izin untuk aksi ini.";
}
