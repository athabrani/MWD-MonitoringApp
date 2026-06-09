import { prisma } from "../lib/prisma.js";
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
};
export const createAuditLog = async (input) => {
    const data = {
        action: input.action,
    };
    if (input.userId)
        data.userId = input.userId;
    if (input.details !== undefined)
        data.details = input.details;
    if (input.metadata)
        data.metadata = input.metadata;
    return prisma.auditLog.create({
        data,
        select: auditLogSelect,
    });
};
export const listAuditLogs = async (query) => {
    const take = Math.min(Math.max(query.limit ?? 100, 1), 500);
    const where = {};
    if (query.userId !== undefined)
        where.userId = query.userId;
    if (query.action)
        where.action = query.action;
    if (query.beforeId !== undefined)
        where.id = { lt: query.beforeId };
    return prisma.auditLog.findMany({
        where,
        take,
        orderBy: [{ id: "desc" }],
        select: auditLogSelect,
    });
};
export const getAuditLogById = async (id) => {
    return prisma.auditLog.findUnique({
        where: { id },
        select: auditLogSelect,
    });
};
//# sourceMappingURL=audit-log.service.js.map