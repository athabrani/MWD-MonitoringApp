import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export type CreateAuditLogInput = {
  userId?: number | null;
  action: string;
  details?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ListAuditLogsQuery = {
  userId?: number;
  action?: string;
  limit?: number;
  beforeId?: bigint;
};

const auditLogSelect = {
  id: true,
  userId: true,
  action: true,
  details: true,
  metadata: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      username: true,
      email: true,
    },
  },
} as const;

export const createAuditLog = async (input: CreateAuditLogInput) => {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    action: input.action,
  };

  if (input.userId) data.userId = input.userId;
  if (input.details !== undefined) data.details = input.details;
  if (input.metadata) data.metadata = input.metadata as Prisma.InputJsonValue;

  return prisma.auditLog.create({
    data,
    select: auditLogSelect,
  });
};

export const listAuditLogs = async (query: ListAuditLogsQuery) => {
  const take = Math.min(Math.max(query.limit ?? 100, 1), 500);
  const where: {
    userId?: number;
    action?: string;
    id?: { lt: bigint };
  } = {};

  if (query.userId !== undefined) where.userId = query.userId;
  if (query.action) where.action = query.action;
  if (query.beforeId !== undefined) where.id = { lt: query.beforeId };

  return prisma.auditLog.findMany({
    where,
    take,
    orderBy: [{ id: "desc" }],
    select: auditLogSelect,
  });
};

export const getAuditLogById = async (id: bigint) => {
  return prisma.auditLog.findUnique({
    where: { id },
    select: auditLogSelect,
  });
};
