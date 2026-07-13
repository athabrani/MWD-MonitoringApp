import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import {
  MWD_MEASUREMENT_FIELDS,
  type MWDMeasurementInput,
} from "../utils/mwd-measurements.js";

type PrismaDbClient = PrismaClient | Prisma.TransactionClient;

const mwdMeasurementSelect = Object.fromEntries(
  MWD_MEASUREMENT_FIELDS.map((fieldName) => [fieldName, true]),
) as {
  [Field in (typeof MWD_MEASUREMENT_FIELDS)[number]]: true;
};

const mwdDataSelect = {
  id: true,
  sessionId: true,
  measuredAt: true,
  ...mwdMeasurementSelect,
  isHidden: true,
  hiddenAt: true,
  hiddenById: true,
  editNote: true,
  gatewaySequence: true,
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
  gatewaySequence?: string;
} & MWDMeasurementInput;

type MWDDataUpdateInput = {
  sessionId?: number;
  measuredAt?: Date;
} & MWDMeasurementInput;

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
  options: {
    includeHidden?: boolean;
    latest?: boolean;
    limit?: number;
    measuredFrom?: Date;
    measuredTo?: Date;
    depthMin?: number;
    depthMax?: number;
  } = {},
  db: PrismaDbClient = prisma,
) => {
  const where: Prisma.MWDDataWhereInput = {};

  if (!options.includeHidden) {
    where.isHidden = false;
  }

  if (sessionId !== undefined) {
    where.sessionId = sessionId;
  }

  if (options.measuredFrom || options.measuredTo) {
    where.measuredAt = {
      ...(options.measuredFrom ? { gte: options.measuredFrom } : {}),
      ...(options.measuredTo ? { lte: options.measuredTo } : {}),
    };
  }

  if (options.depthMin !== undefined || options.depthMax !== undefined) {
    where.depthMd = {
      ...(options.depthMin !== undefined ? { gte: options.depthMin } : {}),
      ...(options.depthMax !== undefined ? { lte: options.depthMax } : {}),
    };
  }

  const take =
    options.limit !== undefined
      ? Math.max(1, Math.min(options.limit, 10_000))
      : undefined;
  const args: {
    where: Prisma.MWDDataWhereInput;
    orderBy: Prisma.MWDDataOrderByWithRelationInput[];
    take?: number;
    select: typeof mwdDataSelect;
  } = {
    where,
    orderBy: options.latest
      ? [{ measuredAt: "desc" }, { id: "desc" }]
      : [{ measuredAt: "asc" }, { id: "asc" }],
    select: mwdDataSelect,
  };

  if (take !== undefined) {
    args.take = take;
  }

  const rows = await db.mWDData.findMany(args);
  return options.latest ? rows.reverse() : rows;
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
  const where: { sessionId: number; isHidden: boolean; id?: { not: bigint } } = {
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
