import { prisma } from "../lib/prisma.js";
import { MWD_MEASUREMENT_FIELDS, } from "../utils/mwd-measurements.js";
const mwdMeasurementSelect = Object.fromEntries(MWD_MEASUREMENT_FIELDS.map((fieldName) => [fieldName, true]));
const mwdDataSelect = {
    id: true,
    sessionId: true,
    measuredAt: true,
    ...mwdMeasurementSelect,
    isHidden: true,
    hiddenAt: true,
    hiddenById: true,
    editNote: true,
    createdAt: true,
    session: {
        select: {
            id: true,
            sessionCode: true,
            wellName: true,
            rigName: true,
            userId: true,
            user: {
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
        },
    },
};
export const createMWDData = async (input, db = prisma) => {
    return await db.mWDData.create({
        data: input,
        select: mwdDataSelect,
    });
};
export const getAllMWDData = async (sessionId, options = {}, db = prisma) => {
    const args = {
        where: options.includeHidden ? {} : { isHidden: false },
        orderBy: [{ measuredAt: "asc" }, { id: "asc" }],
        select: mwdDataSelect,
    };
    if (sessionId !== undefined) {
        args.where = {
            ...(args.where ?? {}),
            sessionId,
        };
    }
    return await db.mWDData.findMany(args);
};
export const getMWDDataById = async (id, db = prisma) => {
    return await db.mWDData.findUnique({
        where: { id },
        select: mwdDataSelect,
    });
};
export const getLatestMWDDataBySessionId = async (sessionId, excludeId, db = prisma) => {
    const where = {
        sessionId,
        isHidden: false,
    };
    if (excludeId !== undefined) {
        where.id = { not: excludeId };
    }
    return await db.mWDData.findFirst({
        where,
        orderBy: [{ measuredAt: "desc" }, { id: "desc" }],
        select: {
            id: true,
            measuredAt: true,
            depthMd: true,
        },
    });
};
export const updateMWDData = async (id, input, db = prisma) => {
    return await db.mWDData.update({
        where: { id },
        data: input,
        select: mwdDataSelect,
    });
};
export const deleteMWDData = async (id, db = prisma) => {
    return await db.mWDData.delete({
        where: { id },
        select: mwdDataSelect,
    });
};
//# sourceMappingURL=mwd-data.service.js.map