import { prisma } from "../lib/prisma.js";

const failoverEventSelect = {
  id: true,
  connectionStatusId: true,
  fromNode: true,
  toNode: true,
  reason: true,
  eventAt: true,
  resolvedAt: true,
  createdAt: true,
  connectionStatus: {
    select: {
      id: true,
      source: true,
      status: true,
      checkedAt: true,
    },
  },
} as const;

type FailoverEventInput = {
  connectionStatusId: number;
  fromNode?: string | null;
  toNode?: string | null;
  reason?: string | null;
  eventAt?: Date;
  resolvedAt?: Date | null;
};

type FailoverEventUpdateInput = {
  connectionStatusId?: number;
  fromNode?: string | null;
  toNode?: string | null;
  reason?: string | null;
  eventAt?: Date;
  resolvedAt?: Date | null;
};

export const createFailoverEvent = async (input: FailoverEventInput) => {
  const data: FailoverEventInput = {
    connectionStatusId: input.connectionStatusId,
  };

  if (input.fromNode !== undefined) {
    data.fromNode = input.fromNode;
  }

  if (input.toNode !== undefined) {
    data.toNode = input.toNode;
  }

  if (input.reason !== undefined) {
    data.reason = input.reason;
  }

  if (input.eventAt !== undefined) {
    data.eventAt = input.eventAt;
  }

  if (input.resolvedAt !== undefined) {
    data.resolvedAt = input.resolvedAt;
  }

  return await prisma.failoverEvent.create({
    data,
    select: failoverEventSelect,
  });
};

export const getAllFailoverEvents = async (connectionStatusId?: number) => {
  const args: {
    where?: { connectionStatusId: number };
    orderBy: [{ eventAt: "desc" }, { id: "desc" }];
    select: typeof failoverEventSelect;
  } = {
    orderBy: [{ eventAt: "desc" }, { id: "desc" }],
    select: failoverEventSelect,
  };

  if (connectionStatusId !== undefined) {
    args.where = { connectionStatusId };
  }

  return await prisma.failoverEvent.findMany(args);
};

export const getFailoverEventById = async (id: number) => {
  return await prisma.failoverEvent.findUnique({
    where: { id },
    select: failoverEventSelect,
  });
};

export const updateFailoverEvent = async (
  id: number,
  input: FailoverEventUpdateInput,
) => {
  return await prisma.failoverEvent.update({
    where: { id },
    data: input,
    select: failoverEventSelect,
  });
};

export const deleteFailoverEvent = async (id: number) => {
  return await prisma.failoverEvent.delete({
    where: { id },
    select: failoverEventSelect,
  });
};
