import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

type PrismaDbClient = PrismaClient | Prisma.TransactionClient;

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

export const createMWDData = async (
  input: MWDDataInput,
  db: PrismaDbClient = prisma,
) => {
  return await db.mWDData.create({
    data: input,
    select: mwdDataSelect,
  });
};

export const getAllMWDData = async (
  sessionId?: number,
  db: PrismaDbClient = prisma,
) => {
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

  return await db.mWDData.findMany(args);
};

export const getMWDDataById = async (
  id: bigint,
  db: PrismaDbClient = prisma,
) => {
  return await db.mWDData.findUnique({
    where: { id },
    select: mwdDataSelect,
  });
};

export const getLatestMWDDataBySessionId = async (
  sessionId: number,
  excludeId?: bigint,
  db: PrismaDbClient = prisma,
) => {
  const where: { sessionId: number; id?: { not: bigint } } = { sessionId };

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

export const updateMWDData = async (
  id: bigint,
  input: MWDDataUpdateInput,
  db: PrismaDbClient = prisma,
) => {
  return await db.mWDData.update({
    where: { id },
    data: input,
    select: mwdDataSelect,
  });
};

export const deleteMWDData = async (
  id: bigint,
  db: PrismaDbClient = prisma,
) => {
  return await db.mWDData.delete({
    where: { id },
    select: mwdDataSelect,
  });
};
