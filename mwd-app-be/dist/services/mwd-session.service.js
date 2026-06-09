import { prisma } from "../lib/prisma.js";
const sessionSelect = {
    id: true,
    userId: true,
    connectionStatusId: true,
    sessionCode: true,
    company: true,
    wellName: true,
    wellId: true,
    rigName: true,
    fieldName: true,
    jobNumber: true,
    province: true,
    countyParish: true,
    country: true,
    location: true,
    latitude: true,
    longitude: true,
    notes: true,
    startedAt: true,
    endedAt: true,
    createdAt: true,
    updatedAt: true,
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
    connectionStatus: {
        select: {
            id: true,
            source: true,
            status: true,
            checkedAt: true,
        },
    },
    _count: {
        select: {
            mwdData: true,
            surveyStations: true,
            witsDataValues: true,
        },
    },
};
export const createSession = async (input) => {
    const data = {
        userId: input.userId,
        sessionCode: input.sessionCode,
    };
    if (input.wellName !== undefined) {
        data.wellName = input.wellName;
    }
    if (input.rigName !== undefined) {
        data.rigName = input.rigName;
    }
    for (const fieldName of [
        "company",
        "wellId",
        "fieldName",
        "jobNumber",
        "province",
        "countyParish",
        "country",
        "location",
        "latitude",
        "longitude",
        "notes",
    ]) {
        if (input[fieldName] !== undefined) {
            data[fieldName] = input[fieldName];
        }
    }
    if (input.connectionStatusId !== undefined) {
        data.connectionStatusId = input.connectionStatusId;
    }
    if (input.startedAt !== undefined) {
        data.startedAt = input.startedAt;
    }
    if (input.endedAt !== undefined) {
        data.endedAt = input.endedAt;
    }
    return await prisma.mWDSession.create({
        data: data,
        select: sessionSelect,
    });
};
export const getAllSessions = async (userId) => {
    const args = {
        orderBy: [{ startedAt: "desc" }, { id: "desc" }],
        select: sessionSelect,
    };
    if (userId !== undefined) {
        args.where = { userId };
    }
    return await prisma.mWDSession.findMany({
        ...args,
    }).then((sessions) => sessions.sort((left, right) => {
        const leftDataCount = left._count.mwdData + left._count.surveyStations + left._count.witsDataValues;
        const rightDataCount = right._count.mwdData + right._count.surveyStations + right._count.witsDataValues;
        if (leftDataCount > 0 && rightDataCount === 0)
            return -1;
        if (leftDataCount === 0 && rightDataCount > 0)
            return 1;
        return (right.startedAt.getTime() - left.startedAt.getTime() ||
            right.id - left.id);
    }));
};
export const getSessionById = async (id) => {
    return await prisma.mWDSession.findUnique({
        where: { id },
        select: sessionSelect,
    });
};
export const updateSession = async (id, input) => {
    return await prisma.mWDSession.update({
        where: { id },
        data: input,
        select: sessionSelect,
    });
};
export const deleteSession = async (id) => {
    return await prisma.mWDSession.delete({
        where: { id },
        select: sessionSelect,
    });
};
//# sourceMappingURL=mwd-session.service.js.map