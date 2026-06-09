import { prisma } from "../lib/prisma.js";

export type SurveyConfigInput = {
  sessionId: number;
  wellName?: string | null;
  rigName?: string | null;
  companyName?: string | null;
  fieldName?: string | null;
  location?: string | null;
  units?: string | null;
  proposedAzimuth?: number | null;
  surveyDepthOffset?: number | null;
  northReference?: string | null;
  declination?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  northingOrigin?: number | null;
  eastingOrigin?: number | null;
  elevationKb?: number | null;
  elevationDf?: number | null;
  elevationGl?: number | null;
  sectionType?: string | null;
  plotTemplateId?: number | null;
};

const db = prisma as unknown as {
  surveyConfig: {
    findUnique: (args: unknown) => Promise<unknown | null>;
    upsert: (args: unknown) => Promise<unknown>;
    delete: (args: unknown) => Promise<unknown>;
  };
};

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
} as const;

export const getSurveyConfigBySessionId = async (sessionId: number) => {
  return await db.surveyConfig.findUnique({
    where: { sessionId },
    select: surveyConfigSelect,
  });
};

export const upsertSurveyConfig = async (input: SurveyConfigInput) => {
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

export const deleteSurveyConfig = async (sessionId: number) => {
  return await db.surveyConfig.delete({
    where: { sessionId },
    select: surveyConfigSelect,
  });
};
