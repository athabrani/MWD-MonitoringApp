import { prisma } from "../lib/prisma.js";

const sessionSelect = {
  id: true,
  userId: true,
  connectionStatusId: true,
  sessionCode: true,
  wellName: true,
  rigName: true,
  startedAt: true,
  endedAt: true,
  createdAt: true,
  updatedAt: true,
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
  connectionStatus: {
    select: {
      id: true,
      source: true,
      status: true,
      checkedAt: true,
    },
  },
} as const;

type SessionInput = {
  userId: number;
  sessionCode: string;
  wellName?: string | null;
  rigName?: string | null;
  connectionStatusId?: number | null;
  startedAt?: Date;
  endedAt?: Date | null;
};

type SessionUpdateInput = {
  userId?: number;
  sessionCode?: string;
  wellName?: string | null;
  rigName?: string | null;
  connectionStatusId?: number | null;
  startedAt?: Date;
  endedAt?: Date | null;
};

export const createSession = async (input: SessionInput) => {
  const data: {
    userId: number;
    sessionCode: string;
    wellName?: string | null;
    rigName?: string | null;
    connectionStatusId?: number | null;
    startedAt?: Date;
    endedAt?: Date | null;
  } = {
    userId: input.userId,
    sessionCode: input.sessionCode,
  };

  if (input.wellName !== undefined) {
    data.wellName = input.wellName;
  }

  if (input.rigName !== undefined) {
    data.rigName = input.rigName;
  }

  if (input.connectionStatusId !== undefined) {
    data.connectionStatusId = input.connectionStatusId;
  }

  if (input.startedAt !== undefined) {
    data.startedAt = input.startedAt;
  }

  if (input.endedAt !== undefined) {
    data.endedAt = input.endedAt;
  }

  return await prisma.mWDSession.create({
    data,
    select: sessionSelect,
  });
};

export const getAllSessions = async (userId?: number) => {
  const args: {
    where?: { userId: number };
    orderBy: { id: "asc" };
    select: typeof sessionSelect;
  } = {
    orderBy: { id: "asc" },
    select: sessionSelect,
  };

  if (userId !== undefined) {
    args.where = { userId };
  }

  return await prisma.mWDSession.findMany({
    ...args,
  });
};

export const getSessionById = async (id: number) => {
  return await prisma.mWDSession.findUnique({
    where: { id },
    select: sessionSelect,
  });
};

export const updateSession = async (id: number, input: SessionUpdateInput) => {
  return await prisma.mWDSession.update({
    where: { id },
    data: input,
    select: sessionSelect,
  });
};

export const deleteSession = async (id: number) => {
  return await prisma.mWDSession.delete({
    where: { id },
    select: sessionSelect,
  });
};
