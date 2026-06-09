import { prisma } from "../lib/prisma.js";
const db = prisma;
const surveyConfigSelect = {
    id: true,
    sessionId: true,
    wellName: true,
    rigName: true,
    companyName: true,
    fieldName: true,
    location: true,
    units: true,
    proposedAzimuth: true,
    surveyDepthOffset: true,
    northReference: true,
    declination: true,
    latitude: true,
    longitude: true,
    northingOrigin: true,
    eastingOrigin: true,
    elevationKb: true,
    elevationDf: true,
    elevationGl: true,
    sectionType: true,
    plotTemplateId: true,
    createdAt: true,
    updatedAt: true,
};
export const getSurveyConfigBySessionId = async (sessionId) => {
    return await db.surveyConfig.findUnique({
        where: { sessionId },
        select: surveyConfigSelect,
    });
};
export const upsertSurveyConfig = async (input) => {
    const { sessionId, ...data } = input;
    return await db.surveyConfig.upsert({
        where: { sessionId },
        create: {
            sessionId,
            ...data,
        },
        update: data,
        select: surveyConfigSelect,
    });
};
export const deleteSurveyConfig = async (sessionId) => {
    return await db.surveyConfig.delete({
        where: { sessionId },
        select: surveyConfigSelect,
    });
};
//# sourceMappingURL=survey-config.service.js.map