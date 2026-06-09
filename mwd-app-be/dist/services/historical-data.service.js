import { prisma } from "../lib/prisma.js";
import { MWD_MEASUREMENT_FIELDS } from "../utils/mwd-measurements.js";
const historicalMeasurementSelect = Object.fromEntries(MWD_MEASUREMENT_FIELDS.map((fieldName) => [fieldName, true]));
const historicalDataSelect = {
    id: true,
    sessionId: true,
    measuredAt: true,
    ...historicalMeasurementSelect,
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
        },
    },
};
export const getHistoricalData = async (query) => {
    const where = {};
    if (query.includeHidden !== true) {
        where.isHidden = false;
    }
    if (query.sessionId !== undefined) {
        where.sessionId = query.sessionId;
    }
    else if (query.sessionIds !== undefined) {
        where.sessionId = { in: query.sessionIds };
    }
    if (query.measuredFrom !== undefined || query.measuredTo !== undefined) {
        where.measuredAt = {};
        if (query.measuredFrom !== undefined) {
            where.measuredAt.gte = query.measuredFrom;
        }
        if (query.measuredTo !== undefined) {
            where.measuredAt.lte = query.measuredTo;
        }
    }
    if (query.depthMin !== undefined || query.depthMax !== undefined) {
        where.depthMd = {};
        if (query.depthMin !== undefined) {
            where.depthMd.gte = query.depthMin;
        }
        if (query.depthMax !== undefined) {
            where.depthMd.lte = query.depthMax;
        }
    }
    const args = {
        where,
        orderBy: [{ measuredAt: "asc" }, { id: "asc" }],
        select: historicalDataSelect,
    };
    if (query.limit !== undefined) {
        args.take = query.limit;
    }
    const data = await prisma.mWDData.findMany(args);
    return {
        count: data.length,
        data,
    };
};
//# sourceMappingURL=historical-data.service.js.map