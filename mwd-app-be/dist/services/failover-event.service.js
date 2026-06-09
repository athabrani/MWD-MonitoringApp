import { prisma } from "../lib/prisma.js";
const failoverEventSelect = {
    id: true,
    connectionStatusId: true,
    fromNode: true,
    toNode: true,
    reason: true,
    eventAt: true,
    resolvedAt: true,
    createdAt: true,
    connectionStatus: {
        select: {
            id: true,
            source: true,
            status: true,
            checkedAt: true,
        },
    },
};
export const createFailoverEvent = async (input) => {
    const data = {
        connectionStatusId: input.connectionStatusId,
    };
    if (input.fromNode !== undefined) {
        data.fromNode = input.fromNode;
    }
    if (input.toNode !== undefined) {
        data.toNode = input.toNode;
    }
    if (input.reason !== undefined) {
        data.reason = input.reason;
    }
    if (input.eventAt !== undefined) {
        data.eventAt = input.eventAt;
    }
    if (input.resolvedAt !== undefined) {
        data.resolvedAt = input.resolvedAt;
    }
    return await prisma.failoverEvent.create({
        data,
        select: failoverEventSelect,
    });
};
export const getAllFailoverEvents = async (connectionStatusId) => {
    const args = {
        orderBy: [{ eventAt: "desc" }, { id: "desc" }],
        select: failoverEventSelect,
    };
    if (connectionStatusId !== undefined) {
        args.where = { connectionStatusId };
    }
    return await prisma.failoverEvent.findMany(args);
};
export const getFailoverEventById = async (id) => {
    return await prisma.failoverEvent.findUnique({
        where: { id },
        select: failoverEventSelect,
    });
};
export const updateFailoverEvent = async (id, input) => {
    return await prisma.failoverEvent.update({
        where: { id },
        data: input,
        select: failoverEventSelect,
    });
};
export const deleteFailoverEvent = async (id) => {
    return await prisma.failoverEvent.delete({
        where: { id },
        select: failoverEventSelect,
    });
};
//# sourceMappingURL=failover-event.service.js.map