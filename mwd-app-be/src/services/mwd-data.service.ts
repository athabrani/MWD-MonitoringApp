import { prisma } from "../lib/prisma.js";

const mwdDataSelect = {
  id: true,
  sessionId: true,
  measuredAt: true,
  depthMd: true,
  inclination: true,
  azimuth: true,
  gammaRay: true,
  rop: true,
  hookLoad: true,
  standpipePressure: true,
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
} as const;

type MWDDataInput = {
  sessionId: number;
  measuredAt: Date;
  depthMd?: number | string | null;
  inclination?: number | string | null;
  azimuth?: number | string | null;
  gammaRay?: number | string | null;
  rop?: number | string | null;
  hookLoad?: number | string | null;
  standpipePressure?: number | string | null;
};

type MWDDataUpdateInput = {
  sessionId?: number;
  measuredAt?: Date;
  depthMd?: number | string | null;
  inclination?: number | string | null;
  azimuth?: number | string | null;
  gammaRay?: number | string | null;
  rop?: number | string | null;
  hookLoad?: number | string | null;
  standpipePressure?: number | string | null;
};

export const createMWDData = async (input: MWDDataInput) => {
  return await prisma.mWDData.create({
    data: input,
    select: mwdDataSelect,
  });
};

export const getAllMWDData = async (sessionId?: number) => {
  const args: {
    where?: { sessionId: number };
    orderBy: [{ measuredAt: "asc" }, { id: "asc" }];
    select: typeof mwdDataSelect;
  } = {
    orderBy: [{ measuredAt: "asc" }, { id: "asc" }],
    select: mwdDataSelect,
  };

  if (sessionId !== undefined) {
    args.where = { sessionId };
  }

  return await prisma.mWDData.findMany(args);
};

export const getMWDDataById = async (id: bigint) => {
  return await prisma.mWDData.findUnique({
    where: { id },
    select: mwdDataSelect,
  });
};

export const getLatestMWDDataBySessionId = async (sessionId: number) => {
  return await prisma.mWDData.findFirst({
    where: { sessionId },
    orderBy: [{ measuredAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      measuredAt: true,
      depthMd: true,
    },
  });
};

export const updateMWDData = async (id: bigint, input: MWDDataUpdateInput) => {
  return await prisma.mWDData.update({
    where: { id },
    data: input,
    select: mwdDataSelect,
  });
};

export const deleteMWDData = async (id: bigint) => {
  return await prisma.mWDData.delete({
    where: { id },
    select: mwdDataSelect,
  });
};
