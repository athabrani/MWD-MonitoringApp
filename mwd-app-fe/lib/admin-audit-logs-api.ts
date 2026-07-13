import { apiRequest } from "@/lib/api-client";

export type AdminAuditLogListItem = {
  id: string;
  timestamp?: string;
  actor?: string;
  action?: string;
  target?: string;
  description?: string;
  metadata?: unknown;
};

type BackendAuditLog = Record<string, unknown>;

type BackendAuditLogsResponse =
  | BackendAuditLog[]
  | {
      value?: BackendAuditLog[];
      data?: BackendAuditLog[];
      items?: BackendAuditLog[];
      logs?: BackendAuditLog[];
      auditLogs?: BackendAuditLog[];
      records?: BackendAuditLog[];
      results?: BackendAuditLog[];
      Count?: number;
      count?: number;
      total?: number;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstString(record: BackendAuditLog, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
  }

  return undefined;
}

function actorFromRecord(record: BackendAuditLog) {
  const directActor = firstString(record, [
    "actor",
    "userName",
    "username",
    "email",
    "userId",
    "actorId",
  ]);

  if (directActor) return directActor;

  const user = record.user;
  if (!isRecord(user)) return undefined;

  return firstString(user, ["fullName", "name", "username", "email", "id"]);
}

function targetFromRecord(record: BackendAuditLog) {
  const targetName = firstString(record, [
    "target",
    "module",
    "entity",
    "resource",
    "resourceType",
    "entityType",
    "tableName",
  ]);
  const targetId = firstString(record, [
    "targetId",
    "recordId",
    "entityId",
    "resourceId",
  ]);

  if (targetName && targetId) return `${targetName} #${targetId}`;
  return targetName ?? targetId;
}

function normalizeBackendAuditLog(record: BackendAuditLog, index: number): AdminAuditLogListItem {
  const timestamp = firstString(record, [
    "timestamp",
    "createdAt",
    "created_at",
    "time",
    "loggedAt",
  ]);
  const action = firstString(record, ["action", "event", "type", "operation"]);
  const description = firstString(record, [
    "description",
    "message",
    "details",
    "detail",
    "summary",
  ]);

  return {
    id: firstString(record, ["id", "auditLogId", "_id"]) ?? `${timestamp ?? "audit"}-${index}`,
    timestamp,
    actor: actorFromRecord(record),
    action,
    target: targetFromRecord(record),
    description,
    metadata: record.metadata ?? record.meta ?? record.payload ?? record.changes,
  };
}

function extractAuditLogRows(response: BackendAuditLogsResponse): BackendAuditLog[] {
  if (Array.isArray(response)) return response;

  return (
    response.value ??
    response.data ??
    response.items ??
    response.logs ??
    response.auditLogs ??
    response.records ??
    response.results ??
    []
  );
}

function sortNewestFirst(logs: AdminAuditLogListItem[]) {
  return [...logs].sort((left, right) => {
    const leftTime = left.timestamp ? new Date(left.timestamp).getTime() : 0;
    const rightTime = right.timestamp ? new Date(right.timestamp).getTime() : 0;

    return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
  });
}

export async function fetchAdminAuditLogs(token: string): Promise<AdminAuditLogListItem[]> {
  const response = await apiRequest<BackendAuditLogsResponse>("/api/audit-logs", {
    method: "GET",
    token,
  });

  return sortNewestFirst(extractAuditLogRows(response).map(normalizeBackendAuditLog));
}
