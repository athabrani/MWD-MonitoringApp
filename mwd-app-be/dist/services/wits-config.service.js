import { prisma } from "../lib/prisma.js";
export const witsConfigSelect = {
    id: true,
    witsId: true,
    name: true,
    units: true,
    mappedField: true,
    decimalPlaces: true,
    scaleFactor: true,
    biasOffset: true,
    sensorToBitSpacing: true,
    plotScaleLeft: true,
    plotScaleRight: true,
    lineColor: true,
    wrapColor: true,
    depthTrackingMode: true,
    depthTrackingField: true,
    enableLogging: true,
    alarmEnabled: true,
    alarmMin: true,
    alarmMax: true,
    customDepthWitsId: true,
    dataSource: true,
    dataInputValue: true,
    sendToRigWitsPort: true,
    doNotRepeat: true,
    lasTag: true,
    lasDescription: true,
    lasFilter: true,
    createdAt: true,
    updatedAt: true,
};
const client = (db) => db;
export const createWitsConfig = async (input, db = prisma) => {
    return await client(db).witsConfig.create({
        data: input,
        select: witsConfigSelect,
    });
};
export const getAllWitsConfigs = async (options = {}, db = prisma) => {
    const where = options.includeDisabled ? undefined : { enableLogging: true };
    return await client(db).witsConfig.findMany({
        ...(where ? { where } : {}),
        orderBy: { witsId: "asc" },
        select: witsConfigSelect,
    });
};
export const getEnabledWitsConfigsByIds = async (witsIds, db = prisma) => {
    if (witsIds.length === 0) {
        return [];
    }
    return await client(db).witsConfig.findMany({
        where: {
            witsId: {
                in: witsIds,
            },
            enableLogging: true,
        },
        select: witsConfigSelect,
    });
};
export const getWitsConfigById = async (id, db = prisma) => {
    return await client(db).witsConfig.findUnique({
        where: { id },
        select: witsConfigSelect,
    });
};
export const getWitsConfigByWitsId = async (witsId, db = prisma) => {
    return await client(db).witsConfig.findUnique({
        where: { witsId },
        select: witsConfigSelect,
    });
};
export const updateWitsConfig = async (id, input, db = prisma) => {
    return await client(db).witsConfig.update({
        where: { id },
        data: input,
        select: witsConfigSelect,
    });
};
export const deleteWitsConfig = async (id, db = prisma) => {
    return await client(db).witsConfig.delete({
        where: { id },
        select: witsConfigSelect,
    });
};
//# sourceMappingURL=wits-config.service.js.map