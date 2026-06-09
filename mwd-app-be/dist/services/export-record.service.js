import { prisma } from "../lib/prisma.js";
const exportRecordSelect = {
    id: true,
    sessionId: true,
    exportedById: true,
    fileName: true,
    fileType: true,
    filePath: true,
    rowCount: true,
    exportedAt: true,
    session: {
        select: {
            id: true,
            sessionCode: true,
            wellName: true,
            rigName: true,
        },
    },
    exportedBy: {
        select: {
            id: true,
            username: true,
            email: true,
            role: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
    },
};
export const createExportRecord = async (input) => {
    return await prisma.exportRecord.create({
        data: {
            sessionId: input.sessionId,
            exportedById: input.exportedById,
            fileName: input.fileName,
            fileType: input.fileType,
            filePath: input.filePath ?? null,
            rowCount: input.rowCount ?? null,
        },
        select: exportRecordSelect,
    });
};
export const getAllExportRecords = async () => {
    return await prisma.exportRecord.findMany({
        orderBy: [{ exportedAt: "desc" }, { id: "desc" }],
        select: exportRecordSelect,
    });
};
//# sourceMappingURL=export-record.service.js.map