import type { UserRole } from "@/types";

export type PageAccessKey =
  | "dashboard"
  | "configuration"
  | "configuration-wellplan-surveys"
  | "monitoring"
  | "monitoring-rig-wits"
  | "monitoring-aux-port"
  | "data-management"
  | "data-management-survey-data"
  | "data-management-log-data"
  | "data-management-memory-import"
  | "data-management-plotting"
  | "data-management-generate-las"
  | "trajectory"
  | "trajectory-well-plot"
  | "trajectory-analysis"
  | "charts"
  | "alerts"
  | "history"
  | "export"
  | "system-utilities"
  | "settings"
  | "admin"
  | "help";

export type RolePageAccessMap = Record<Exclude<UserRole, "admin">, PageAccessKey[]>;

export type PageAccessRegistryItem = {
  key: PageAccessKey;
  label: string;
  section: string;
  path: string;
  parent?: PageAccessKey;
};

export const rolePageAccessStorageKey = "mwd_role_page_access";
export const rolePageAccessChangedEvent = "mwd-role-page-access-changed";

export const pageAccessRegistry: PageAccessRegistryItem[] = [
  { key: "dashboard", label: "Dashboard", section: "Dashboard", path: "/" },
  { key: "monitoring", label: "Monitoring", section: "Monitoring", path: "/monitoring/rig-wits" },
  { key: "monitoring-rig-wits", label: "Rig WITS", section: "Monitoring", path: "/monitoring/rig-wits", parent: "monitoring" },
  { key: "monitoring-aux-port", label: "Aux Port", section: "Monitoring", path: "/monitoring/aux-port", parent: "monitoring" },
  { key: "data-management", label: "Data Management", section: "Data Management", path: "/data-management/survey-data" },
  { key: "data-management-survey-data", label: "Survey Data", section: "Data Management", path: "/data-management/survey-data", parent: "data-management" },
  { key: "data-management-log-data", label: "Log Data", section: "Data Management", path: "/data-management/log-data", parent: "data-management" },
  { key: "data-management-memory-import", label: "Memory Import", section: "Data Management", path: "/data-management/memory-import", parent: "data-management" },
  { key: "data-management-plotting", label: "Plotting", section: "Data Management", path: "/data-management/plotting", parent: "data-management" },
  { key: "data-management-generate-las", label: "Generate LAS", section: "Data Management", path: "/data-management/generate-las", parent: "data-management" },
  { key: "trajectory-analysis", label: "Trajectory Analysis", section: "Trajectory", path: "/trajectory" },
  { key: "trajectory", label: "Trajectory", section: "Trajectory", path: "/trajectory", parent: "trajectory-analysis" },
  { key: "trajectory-well-plot", label: "Well Plots", section: "Trajectory", path: "/trajectory/well-plot", parent: "trajectory-analysis" },
  { key: "charts", label: "Charts", section: "Trajectory", path: "/charts", parent: "trajectory-analysis" },
  { key: "configuration", label: "Configuration", section: "Configuration", path: "/configuration" },
  { key: "configuration-wellplan-surveys", label: "Wellplan Surveys", section: "Configuration", path: "/configuration/wellplan-surveys", parent: "configuration" },
  { key: "system-utilities", label: "System Utilities", section: "Configuration", path: "/system-utilities" },
  { key: "alerts", label: "Alerts", section: "Operations", path: "/alerts" },
  { key: "history", label: "History", section: "Operations", path: "/history" },
  { key: "export", label: "Export", section: "Operations", path: "/export" },
  { key: "settings", label: "Settings", section: "Support", path: "/settings" },
  { key: "admin", label: "Admin", section: "Support", path: "/admin" },
  { key: "help", label: "Help", section: "Support", path: "/help" },
];

export const editablePageAccessRegistry = pageAccessRegistry.filter((page) => page.key !== "admin");

const allPageKeys = pageAccessRegistry.map((page) => page.key);
const sectionDefaultTargets: Partial<Record<PageAccessKey, PageAccessKey>> = {
  monitoring: "monitoring-rig-wits",
  "data-management": "data-management-survey-data",
  trajectory: "trajectory-analysis",
};
const pagePathAliases: Record<string, PageAccessKey> = {
  "/dashboard": "dashboard",
};

export const defaultRolePageAccess: RolePageAccessMap = {
  engineer: allPageKeys.filter((key) => key !== "admin"),
  operator: allPageKeys.filter((key) => key !== "admin" && key !== "export" && key !== "system-utilities"),
};

function sanitizeRolePages(role: Exclude<UserRole, "admin">, value: unknown): PageAccessKey[] {
  const validKeys = new Set(editablePageAccessRegistry.map((page) => page.key));
  const source = Array.isArray(value) ? value : defaultRolePageAccess[role];
  const pages = source.filter((page): page is PageAccessKey => typeof page === "string" && validKeys.has(page as PageAccessKey));

  return Array.from(new Set(pages));
}

export function readRolePageAccess(): RolePageAccessMap {
  if (typeof window === "undefined") return defaultRolePageAccess;

  try {
    const raw = window.localStorage.getItem(rolePageAccessStorageKey);
    const parsed = raw ? (JSON.parse(raw) as Partial<Record<UserRole, unknown>>) : {};

    return {
      engineer: sanitizeRolePages("engineer", parsed.engineer),
      operator: sanitizeRolePages("operator", parsed.operator),
    };
  } catch {
    return defaultRolePageAccess;
  }
}

export function saveRolePageAccess(access: RolePageAccessMap) {
  if (typeof window === "undefined") return;

  const sanitized: RolePageAccessMap = {
    engineer: sanitizeRolePages("engineer", access.engineer),
    operator: sanitizeRolePages("operator", access.operator),
  };

  window.localStorage.setItem(rolePageAccessStorageKey, JSON.stringify(sanitized));
  window.dispatchEvent(new CustomEvent(rolePageAccessChangedEvent));
}

export function subscribeRolePageAccess(listener: () => void) {
  if (typeof window === "undefined") return () => {};

  const handleStorage = (event: StorageEvent) => {
    if (event.key === rolePageAccessStorageKey) listener();
  };

  window.addEventListener(rolePageAccessChangedEvent, listener);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(rolePageAccessChangedEvent, listener);
    window.removeEventListener("storage", handleStorage);
  };
}

export function canAccessPage(role: UserRole | undefined, page: PageAccessKey, access = readRolePageAccess()) {
  if (!role) return false;
  if (role === "admin") return true;

  const allowed = new Set(access[role]);
  if (allowed.has(page)) return true;

  return Boolean(sectionDefaultTargets[page]) && pageAccessRegistry.some((item) => item.parent === page && allowed.has(item.key));
}

export function getDefaultAccessiblePage(role: UserRole | undefined, access = readRolePageAccess()): PageAccessKey {
  if (role === "admin") return "dashboard";
  if (!role) return "dashboard";

  return access[role][0] ?? "dashboard";
}

export function getAccessiblePageTarget(
  role: UserRole | undefined,
  page: PageAccessKey,
  fallback: PageAccessKey,
  access = readRolePageAccess()
): PageAccessKey {
  if (canAccessPage(role, page, access)) {
    const sectionTarget = sectionDefaultTargets[page];

    if (sectionTarget && canAccessPage(role, sectionTarget, access)) {
      return sectionTarget;
    }

    return page;
  }

  return getDefaultAccessiblePage(role, access) ?? fallback;
}

export function getPageAccessLabel(page: PageAccessKey) {
  return pageAccessRegistry.find((item) => item.key === page)?.label ?? page;
}

export function getPageAccessKeyForPath(pathname: string): PageAccessKey | null {
  const normalizedPath = pathname.replace(/\/$/, "") || "/";
  if (pagePathAliases[normalizedPath]) return pagePathAliases[normalizedPath];

  const sortedPages = [...pageAccessRegistry].sort((left, right) => right.path.length - left.path.length);

  return sortedPages.find((page) => page.path === normalizedPath)?.key ?? null;
}
