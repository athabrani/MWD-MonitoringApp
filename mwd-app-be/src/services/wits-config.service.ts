import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

type PrismaDbClient = PrismaClient | Prisma.TransactionClient;

export type WitsConfigInput = {
  witsId: string;
  name: string;
  units?: string | null;
  mappedField?: string | null;
  decimalPlaces?: number;
  scaleFactor?: number | string;
  biasOffset?: number | string;
  sensorToBitSpacing?: number | string | null;
  plotScaleLeft?: number | string | null;
  plotScaleRight?: number | string | null;
  lineColor?: string | null;
  wrapColor?: string | null;
  depthTrackingMode?: string;
  depthTrackingField?: string;
  enableLogging?: boolean;
  alarmEnabled?: boolean;
  alarmMin?: number | string | null;
  alarmMax?: number | string | null;
  customDepthWitsId?: string | null;
  dataSource?: string;
  dataInputValue?: number | string | null;
  sendToRigWitsPort?: boolean;
  doNotRepeat?: boolean;
  lasTag?: string | null;
  lasDescription?: string | null;
  lasFilter?: number | string | null;
};

export type WitsConfigUpdateInput = Partial<Omit<WitsConfigInput, "witsId">> & {
  witsId?: string;
};

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
} as const;

const client = (db: PrismaDbClient) => db as unknown as {
  witsConfig: {
    create: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<unknown[]>;
    findUnique: (args: unknown) => Promise<unknown | null>;
    update: (args: unknown) => Promise<unknown>;
    delete: (args: unknown) => Promise<unknown>;
  };
};

export const createWitsConfig = async (
  input: WitsConfigInput,
  db: PrismaDbClient = prisma,
) => {
  return await client(db).witsConfig.create({
    data: input,
    select: witsConfigSelect,
  });
};

export const getAllWitsConfigs = async (
  options: { includeDisabled?: boolean } = {},
  db: PrismaDbClient = prisma,
) => {
  const where = options.includeDisabled ? undefined : { enableLogging: true };

  return await client(db).witsConfig.findMany({
    ...(where ? { where } : {}),
    orderBy: { witsId: "asc" },
    select: witsConfigSelect,
  });
};

export const getEnabledWitsConfigsByIds = async (
  witsIds: string[],
  db: PrismaDbClient = prisma,
) => {
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

export const getWitsConfigById = async (
  id: number,
  db: PrismaDbClient = prisma,
) => {
  return await client(db).witsConfig.findUnique({
    where: { id },
    select: witsConfigSelect,
  });
};

export const getWitsConfigByWitsId = async (
  witsId: string,
  db: PrismaDbClient = prisma,
) => {
  return await client(db).witsConfig.findUnique({
    where: { witsId },
    select: witsConfigSelect,
  });
};

export const updateWitsConfig = async (
  id: number,
  input: WitsConfigUpdateInput,
  db: PrismaDbClient = prisma,
) => {
  return await client(db).witsConfig.update({
    where: { id },
    data: input,
    select: witsConfigSelect,
  });
};

export const deleteWitsConfig = async (
  id: number,
  db: PrismaDbClient = prisma,
) => {
  return await client(db).witsConfig.delete({
    where: { id },
    select: witsConfigSelect,
  });
};
