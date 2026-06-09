import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

type PrismaDbClient = PrismaClient | Prisma.TransactionClient;

export type PlotTemplateInput = {
  name: string;
  description?: string | null;
  config: unknown;
  isDefault?: boolean;
};

export type PlotTemplateUpdateInput = Partial<PlotTemplateInput>;

export const plotTemplateSelect = {
  id: true,
  name: true,
  description: true,
  config: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
} as const;

const client = (db: PrismaDbClient) => db as unknown as {
  plotTemplate: {
    create: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<unknown[]>;
    findUnique: (args: unknown) => Promise<unknown | null>;
    update: (args: unknown) => Promise<unknown>;
    delete: (args: unknown) => Promise<unknown>;
  };
};

export const createPlotTemplate = async (
  input: PlotTemplateInput,
  db: PrismaDbClient = prisma,
) => {
  return await client(db).plotTemplate.create({
    data: input,
    select: plotTemplateSelect,
  });
};

export const getAllPlotTemplates = async (db: PrismaDbClient = prisma) => {
  return await client(db).plotTemplate.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: plotTemplateSelect,
  });
};

export const getDefaultPlotTemplate = async (db: PrismaDbClient = prisma) => {
  const rows = await client(db).plotTemplate.findMany({
    where: { isDefault: true },
    orderBy: { id: "asc" },
    take: 1,
    select: plotTemplateSelect,
  });

  return rows[0] ?? null;
};

export const getPlotTemplateById = async (
  id: number,
  db: PrismaDbClient = prisma,
) => {
  return await client(db).plotTemplate.findUnique({
    where: { id },
    select: plotTemplateSelect,
  });
};

export const updatePlotTemplate = async (
  id: number,
  input: PlotTemplateUpdateInput,
  db: PrismaDbClient = prisma,
) => {
  return await client(db).plotTemplate.update({
    where: { id },
    data: input,
    select: plotTemplateSelect,
  });
};

export const deletePlotTemplate = async (
  id: number,
  db: PrismaDbClient = prisma,
) => {
  return await client(db).plotTemplate.delete({
    where: { id },
    select: plotTemplateSelect,
  });
};
