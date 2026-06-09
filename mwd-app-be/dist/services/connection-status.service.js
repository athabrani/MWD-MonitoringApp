import { prisma } from "../lib/prisma.js";
const connectionStatusSelect = {
    id: true,
    source: true,
    status: true,
    description: true,
    checkedAt: true,
    responseMs: true,
    createdAt: true,
    updatedAt: true,
};
export const createConnectionStatus = async (input) => {
    const data = {
        source: input.source,
        status: input.status,
    };
    if (input.description !== undefined) {
        data.description = input.description;
    }
    if (input.checkedAt !== undefined) {
        data.checkedAt = input.checkedAt;
    }
    if (input.responseMs !== undefined) {
        data.responseMs = input.responseMs;
    }
    return await prisma.connectionStatus.create({
        data,
        select: connectionStatusSelect,
    });
};
export const getAllConnectionStatuses = async () => {
    return await prisma.connectionStatus.findMany({
        orderBy: [{ checkedAt: "desc" }, { id: "desc" }],
        select: connectionStatusSelect,
    });
};
export const getConnectionStatusById = async (id) => {
    return await prisma.connectionStatus.findUnique({
        where: { id },
        select: connectionStatusSelect,
    });
};
export const updateConnectionStatus = async (id, input) => {
    return await prisma.connectionStatus.update({
        where: { id },
        data: input,
        select: connectionStatusSelect,
    });
};
export const deleteConnectionStatus = async (id) => {
    return await prisma.connectionStatus.delete({
        where: { id },
        select: connectionStatusSelect,
    });
};
//# sourceMappingURL=connection-status.service.js.map