import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { collectWitsValues } from "../utils/mwd-measurements.js";

type PrismaDbClient = PrismaClient | Prisma.TransactionClient;

type DepthTrackingInput = {
  sessionId: number;
  measuredAt?: Date;
  bitDepth?: unknown;
  holeDepth?: unknown;
  blockDepth?: unknown;
  rop?: unknown;
  mode?: string | null;
  status?: string | null;
  source?: string | null;
  settings?: unknown;
  raw?: unknown;
};

type DepthTrackingFilters = {
  sessionId: number;
  measuredFrom?: Date;
  measuredTo?: Date;
  limit?: number;
};

const depthTrackingStateSelect = {
  id: true,
  sessionId: true,
  mode: true,
  bitDepth: true,
  holeDepth: true,
  blockDepth: true,
  rop: true,
  status: true,
  source: true,
  lastMeasuredAt: true,
  settings: true,
  createdAt: true,
  updatedAt: true,
  session: {
    select: {
      id: true,
      sessionCode: true,
      wellName: true,
      rigName: true,
      userId: true,
    },
  },
} as const;

const depthTrackingSampleSelect = {
  id: true,
  sessionId: true,
  stateId: true,
  measuredAt: true,
  bitDepth: true,
  holeDepth: true,
  blockDepth: true,
  rop: true,
  status: true,
  source: true,
  raw: true,
  createdAt: true,
} as const;

const db = (client: PrismaDbClient = prisma) => client as unknown as {
  depthTrackingState: {
    upsert: (args: unknown) => Promise<Record<string, unknown>>;
    findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
  };
  depthTrackingSample: {
    create: (args: unknown) => Promise<Record<string, unknown>>;
    findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
  };
  mWDData: {
    findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
  };
  $transaction: <T>(fn: (tx: PrismaDbClient) => Promise<T>) => Promise<T>;
};

const toFiniteNumber = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof value === "object" && "toString" in value) {
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const normalizeText = (value: string | null | undefined, fallback: string) => {
  if (typeof value !== "string") {
    return fallback;
  }

  return value.trim().toLowerCase().replace(/\s+/g, "_") || fallback;
};

const getJsonObject = (value: unknown) => {
  return typeof value === "object" && value !== null ? value : {};
};

const determineStatus = (
  bitDepth: number | null,
  holeDepth: number | null,
  rop: number | null,
  fallback?: string | null,
) => {
  if (fallback && fallback.trim()) {
    return normalizeText(fallback, "unknown");
  }

  if (bitDepth === null && holeDepth === null) {
    return "unknown";
  }

  if (rop !== null && rop > 0) {
    return "drilling";
  }

  if (bitDepth !== null && holeDepth !== null) {
    if (Math.abs(holeDepth - bitDepth) <= 0.1) {
      return "on_bottom";
    }

    if (bitDepth < holeDepth) {
      return "off_bottom";
    }
  }

  return "tracking";
};

const toDateWhere = (
  measuredFrom?: Date,
  measuredTo?: Date,
) => {
  const measuredAt: Record<string, Date> = {};

  if (measuredFrom) {
    measuredAt.gte = measuredFrom;
  }

  if (measuredTo) {
    measuredAt.lte = measuredTo;
  }

  return Object.keys(measuredAt).length > 0 ? measuredAt : undefined;
};

export const buildDepthTrackingInputFromMwdSource = (input: {
  sessionId: number;
  measuredAt: Date;
  source: Record<string, unknown>;
}) => {
  const witsValues = collectWitsValues(input.source);
  const bitDepth =
    toFiniteNumber(witsValues.get("0108")) ??
    toFiniteNumber(input.source.bitDepth) ??
    toFiniteNumber(input.source.depthMd);
  const holeDepth =
    toFiniteNumber(witsValues.get("0110")) ??
    toFiniteNumber(input.source.holeDepth) ??
    toFiniteNumber(input.source.depthMd);
  const blockDepth =
    toFiniteNumber(witsValues.get("0112")) ??
    toFiniteNumber(input.source.blockDepth) ??
    toFiniteNumber(input.source.hookPosition);
  const rop =
    toFiniteNumber(witsValues.get("0113")) ??
    toFiniteNumber(input.source.rop);

  return {
    sessionId: input.sessionId,
    measuredAt: input.measuredAt,
    bitDepth,
    holeDepth,
    blockDepth,
    rop,
    source: "mwd_data",
    raw: {
      witsIds: Object.fromEntries(witsValues),
    },
  };
};

export const updateDepthTrackingState = async (
  input: DepthTrackingInput,
  client: PrismaDbClient = prisma,
) => {
  const measuredAt = input.measuredAt ?? new Date();
  const bitDepth = toFiniteNumber(input.bitDepth);
  const holeDepth = toFiniteNumber(input.holeDepth);
  const blockDepth = toFiniteNumber(input.blockDepth);
  const rop = toFiniteNumber(input.rop);
  const mode = normalizeText(input.mode, "bit_depth");
  const source = normalizeText(input.source, "manual");
  const status = determineStatus(bitDepth, holeDepth, rop, input.status);
  const stateData: Record<string, unknown> = {
    mode,
    bitDepth,
    holeDepth,
    blockDepth,
    rop,
    status,
    source,
    lastMeasuredAt: measuredAt,
  };

  if (input.settings !== undefined) {
    stateData.settings = getJsonObject(input.settings);
  }

  return await db(client).$transaction(async (tx) => {
    const state = await db(tx).depthTrackingState.upsert({
      where: { sessionId: input.sessionId },
      create: {
        sessionId: input.sessionId,
        ...stateData,
      },
      update: stateData,
      select: depthTrackingStateSelect,
    });
    const stateId = Number(state.id);
    const sample = await db(tx).depthTrackingSample.create({
      data: {
        sessionId: input.sessionId,
        stateId,
        measuredAt,
        bitDepth,
        holeDepth,
        blockDepth,
        rop,
        status,
        source,
        raw: input.raw === undefined ? null : getJsonObject(input.raw),
      },
      select: depthTrackingSampleSelect,
    });

    return { state, sample };
  });
};

export const getDepthTrackingState = async (sessionId: number) => {
  return await db().depthTrackingState.findUnique({
    where: { sessionId },
    select: depthTrackingStateSelect,
  });
};

export const getDepthTrackingSamples = async (filters: DepthTrackingFilters) => {
  const measuredAt = toDateWhere(filters.measuredFrom, filters.measuredTo);
  return await db().depthTrackingSample.findMany({
    where: {
      sessionId: filters.sessionId,
      ...(measuredAt ? { measuredAt } : {}),
    },
    orderBy: [{ measuredAt: "desc" }, { id: "desc" }],
    take: Math.max(1, Math.min(filters.limit ?? 500, 5000)),
    select: depthTrackingSampleSelect,
  });
};

export const recalculateDepthTrackingFromMwdData = async (sessionId: number) => {
  const rows = await db().mWDData.findMany({
    where: {
      sessionId,
      isHidden: false,
    },
    orderBy: [{ measuredAt: "asc" }, { id: "asc" }],
    select: {
      measuredAt: true,
      depthMd: true,
      hookPosition: true,
      rop: true,
    },
  });
  let lastResult: Awaited<ReturnType<typeof updateDepthTrackingState>> | null = null;

  for (const row of rows) {
    const measuredAt = row.measuredAt instanceof Date ? row.measuredAt : new Date();
    lastResult = await updateDepthTrackingState({
      sessionId,
      measuredAt,
      bitDepth: row.depthMd,
      holeDepth: row.depthMd,
      blockDepth: row.hookPosition,
      rop: row.rop,
      source: "mwd_data_recalculate",
      raw: {
        mwdDepthMd: row.depthMd,
        hookPosition: row.hookPosition,
        rop: row.rop,
      },
    });
  }

  return {
    count: rows.length,
    state: lastResult?.state ?? (await getDepthTrackingState(sessionId)),
  };
};
