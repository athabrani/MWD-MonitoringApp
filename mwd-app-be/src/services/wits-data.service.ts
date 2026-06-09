import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import {
  collectWitsValues,
  formatWitsId,
  normalizeWitsId,
} from "../utils/mwd-measurements.js";
import {
  getEnabledWitsConfigsByIds,
  witsConfigSelect,
} from "./wits-config.service.js";
import { queueWitsOutputsForConfigs } from "./wits-output.service.js";

type PrismaDbClient = PrismaClient | Prisma.TransactionClient;

type WitsConfigRecord = {
  id: number;
  witsId: string;
  name: string;
  mappedField: string | null;
  decimalPlaces: number;
  scaleFactor: unknown;
  biasOffset: unknown;
  sensorToBitSpacing: unknown;
  alarmEnabled: boolean;
  alarmMin: unknown;
  alarmMax: unknown;
  customDepthWitsId: string | null;
  sendToRigWitsPort: boolean;
  doNotRepeat: boolean;
};

type RecordConfiguredWitsValuesInput = {
  sessionId: number;
  measuredAt: Date;
  depthMd?: unknown;
  source: Record<string, unknown>;
};

export type WitsDataValueFilters = {
  sessionId?: number;
  ownerUserId?: number;
  witsId?: string;
  measuredFrom?: Date;
  measuredTo?: Date;
  depthMin?: number;
  depthMax?: number;
  limit?: number;
};

export type WitsAlarmFilters = {
  sessionId?: number;
  ownerUserId?: number;
  witsId?: string;
  acknowledged?: boolean;
  limit?: number;
};

export type WitsDataExportFilters = {
  sessionId: number;
  witsId: string;
  measuredFrom?: Date;
  measuredTo?: Date;
  depthMin?: number;
  depthMax?: number;
  sampleMode?: "all" | "first_per_depth";
};

const witsDataValueSelect = {
  id: true,
  sessionId: true,
  witsConfigId: true,
  witsId: true,
  measuredAt: true,
  depthMd: true,
  rawValue: true,
  rawText: true,
  rawLine: true,
  rawBlock: true,
  value: true,
  createdAt: true,
  witsConfig: {
    select: witsConfigSelect,
  },
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

const witsAlarmEventSelect = {
  id: true,
  sessionId: true,
  witsConfigId: true,
  witsId: true,
  measuredAt: true,
  value: true,
  limitType: true,
  limitValue: true,
  message: true,
  acknowledgedById: true,
  acknowledgedAt: true,
  resolvedAt: true,
  createdAt: true,
  witsConfig: {
    select: witsConfigSelect,
  },
  acknowledgedBy: {
    select: {
      id: true,
      username: true,
      email: true,
    },
  },
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

const client = (db: PrismaDbClient) => db as unknown as {
  witsDataValue: {
    create: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<unknown[]>;
  };
  witsAlarmEvent: {
    create: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<unknown[]>;
    update: (args: unknown) => Promise<unknown>;
  };
};

const toFiniteNumber = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) && value !== -9999 ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) && parsed !== -9999 ? parsed : null;
  }

  if (typeof value === "object" && "toString" in value) {
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) && parsed !== -9999 ? parsed : null;
  }

  return null;
};

const normalizeLimit = (limit?: number) => {
  if (limit === undefined) {
    return 500;
  }

  return Math.max(1, Math.min(limit, 5000));
};

const getRawWitsMetadata = (
  source: Record<string, unknown>,
  witsId: string,
  fallbackRawValue: unknown,
) => {
  const rawBlock =
    typeof source.rawWitsBlock === "string"
      ? source.rawWitsBlock
      : typeof source.raw === "string" && source.raw.includes("&&")
        ? source.raw
        : null;
  const serialWitsLines = Array.isArray(source.serialWitsLines)
    ? source.serialWitsLines
    : [];

  for (const item of serialWitsLines) {
    if (
      typeof item !== "object" ||
      item === null ||
      Array.isArray(item)
    ) {
      continue;
    }

    const line = item as Record<string, unknown>;
    const normalizedWitsId = normalizeWitsId(line.witsId);

    if (normalizedWitsId !== witsId) {
      continue;
    }

    return {
      rawText:
        line.rawValue === undefined || line.rawValue === null
          ? null
          : String(line.rawValue),
      rawLine: typeof line.rawLine === "string" ? line.rawLine : null,
      rawBlock,
    };
  }

  return {
    rawText:
      fallbackRawValue === undefined || fallbackRawValue === null
        ? null
        : String(fallbackRawValue),
    rawLine: null,
    rawBlock,
  };
};

const getMeasuredAtWhere = (filters: Pick<WitsDataValueFilters, "measuredFrom" | "measuredTo">) => {
  const measuredAt: Record<string, Date> = {};

  if (filters.measuredFrom) {
    measuredAt.gte = filters.measuredFrom;
  }

  if (filters.measuredTo) {
    measuredAt.lte = filters.measuredTo;
  }

  return Object.keys(measuredAt).length > 0 ? measuredAt : undefined;
};

const getDepthWhere = (filters: Pick<WitsDataValueFilters, "depthMin" | "depthMax">) => {
  const depthMd: Record<string, number> = {};

  if (filters.depthMin !== undefined) {
    depthMd.gte = filters.depthMin;
  }

  if (filters.depthMax !== undefined) {
    depthMd.lte = filters.depthMax;
  }

  return Object.keys(depthMd).length > 0 ? depthMd : undefined;
};

export const recordConfiguredWitsValues = async (
  input: RecordConfiguredWitsValuesInput,
  db: PrismaDbClient = prisma,
) => {
  const rawWitsValues = collectWitsValues(input.source);
  const witsIds = Array.from(rawWitsValues.keys());
  const configs = (await getEnabledWitsConfigsByIds(
    witsIds,
    db,
  )) as WitsConfigRecord[];
  const values = [];
  const alarms = [];
  const skippedInvalid: string[] = [];
  const outputValues = [];

  for (const config of configs) {
    const rawInputValue = rawWitsValues.get(config.witsId);
    const rawValue = toFiniteNumber(rawInputValue);
    const rawMetadata = getRawWitsMetadata(
      input.source,
      config.witsId,
      rawInputValue,
    );

    const scaleFactor = toFiniteNumber(config.scaleFactor) ?? 1;
    const biasOffset = toFiniteNumber(config.biasOffset) ?? 0;
    const sensorToBitSpacing = toFiniteNumber(config.sensorToBitSpacing) ?? 0;
    const customDepthWitsId = normalizeWitsId(config.customDepthWitsId);
    const customDepth =
      customDepthWitsId !== null
        ? toFiniteNumber(rawWitsValues.get(customDepthWitsId))
        : null;
    const baseDepth = customDepth ?? toFiniteNumber(input.depthMd);
    const depthMd = baseDepth === null ? null : baseDepth - sensorToBitSpacing;
    const value = rawValue === null ? null : (rawValue - biasOffset) * scaleFactor;

    const createdValue = await client(db).witsDataValue.create({
      data: {
        sessionId: input.sessionId,
        witsConfigId: config.id,
        witsId: config.witsId,
        measuredAt: input.measuredAt,
        depthMd,
        rawValue,
        rawText: rawMetadata.rawText,
        rawLine: rawMetadata.rawLine,
        rawBlock: rawMetadata.rawBlock,
        value,
      },
      select: witsDataValueSelect,
    });
    values.push(createdValue);

    if (value === null) {
      skippedInvalid.push(config.witsId);
      continue;
    }

    outputValues.push({ config, value });

    if (!config.alarmEnabled) {
      continue;
    }

    const alarmMin = toFiniteNumber(config.alarmMin);
    const alarmMax = toFiniteNumber(config.alarmMax);
    const alarm =
      alarmMin !== null && value < alarmMin
        ? { limitType: "min", limitValue: alarmMin }
        : alarmMax !== null && value > alarmMax
          ? { limitType: "max", limitValue: alarmMax }
          : null;

    if (!alarm) {
      continue;
    }

    const createdAlarm = await client(db).witsAlarmEvent.create({
      data: {
        sessionId: input.sessionId,
        witsConfigId: config.id,
        witsId: config.witsId,
        measuredAt: input.measuredAt,
        value,
        limitType: alarm.limitType,
        limitValue: alarm.limitValue,
        message: `${config.name} (WITS ${formatWitsId(config.witsId)}) ${alarm.limitType === "min" ? "below" : "above"} alarm limit`,
      },
      select: witsAlarmEventSelect,
    });
    alarms.push(createdAlarm);
  }
  const outputInfo = await queueWitsOutputsForConfigs({
    sessionId: input.sessionId,
    measuredAt: input.measuredAt,
    depthMd: input.depthMd,
    values: outputValues,
    reason: "recorded_configured_wits_value",
    db,
  });

  return {
    configuredCount: configs.length,
    loggedCount: values.length,
    alarmCount: alarms.length,
    outputQueuedCount: outputInfo.queuedCount,
    outputSkippedCount: outputInfo.skippedCount,
    skippedInvalid,
    values,
    alarms,
    outputMessages: outputInfo.messages,
  };
};

export const getWitsDataValues = async (
  filters: WitsDataValueFilters,
  db: PrismaDbClient = prisma,
) => {
  const where: Record<string, unknown> = {};
  const measuredAt = getMeasuredAtWhere(filters);
  const depthMd = getDepthWhere(filters);

  if (filters.sessionId !== undefined) {
    where.sessionId = filters.sessionId;
  }

  if (filters.ownerUserId !== undefined) {
    where.session = { userId: filters.ownerUserId };
  }

  if (filters.witsId !== undefined) {
    where.witsId = filters.witsId;
  }

  if (measuredAt) {
    where.measuredAt = measuredAt;
  }

  if (depthMd) {
    where.depthMd = depthMd;
  }

  return await client(db).witsDataValue.findMany({
    where,
    orderBy: [{ measuredAt: "asc" }, { id: "asc" }],
    take: normalizeLimit(filters.limit),
    select: witsDataValueSelect,
  });
};

export const getWitsDataValuesForExport = async (
  filters: WitsDataExportFilters,
  db: PrismaDbClient = prisma,
) => {
  const where: Record<string, unknown> = {
    sessionId: filters.sessionId,
    witsId: filters.witsId,
  };
  const measuredAt = getMeasuredAtWhere(filters);
  const depthMd = getDepthWhere(filters);

  if (measuredAt) {
    where.measuredAt = measuredAt;
  }

  if (depthMd) {
    where.depthMd = depthMd;
  }

  const rows = await client(db).witsDataValue.findMany({
    where,
    orderBy: [
      { depthMd: "asc" },
      { measuredAt: "asc" },
      { id: "asc" },
    ],
    select: {
      id: true,
      measuredAt: true,
      depthMd: true,
      rawValue: true,
      value: true,
      witsConfig: {
        select: {
          witsId: true,
          name: true,
          units: true,
        },
      },
    },
  }) as Array<{
    id: bigint;
    measuredAt: Date;
    depthMd: unknown;
    rawValue: unknown;
    value: unknown;
    witsConfig: { witsId: string; name: string; units: string | null } | null;
  }>;

  if (filters.sampleMode !== "first_per_depth") {
    return rows;
  }

  const seenDepths = new Set<string>();
  const sampled = [];

  for (const row of rows) {
    const depthKey =
      row.depthMd === null || row.depthMd === undefined
        ? `no-depth-${row.id.toString()}`
        : row.depthMd.toString();

    if (seenDepths.has(depthKey)) {
      continue;
    }

    seenDepths.add(depthKey);
    sampled.push(row);
  }

  return sampled;
};

export const getWitsAlarmEvents = async (
  filters: WitsAlarmFilters,
  db: PrismaDbClient = prisma,
) => {
  const where: Record<string, unknown> = {};

  if (filters.sessionId !== undefined) {
    where.sessionId = filters.sessionId;
  }

  if (filters.ownerUserId !== undefined) {
    where.session = { userId: filters.ownerUserId };
  }

  if (filters.witsId !== undefined) {
    where.witsId = filters.witsId;
  }

  if (filters.acknowledged !== undefined) {
    where.acknowledgedAt = filters.acknowledged ? { not: null } : null;
  }

  return await client(db).witsAlarmEvent.findMany({
    where,
    orderBy: [{ measuredAt: "desc" }, { id: "desc" }],
    take: normalizeLimit(filters.limit),
    select: witsAlarmEventSelect,
  });
};

export const acknowledgeWitsAlarm = async (
  id: bigint,
  acknowledgedById: number,
  db: PrismaDbClient = prisma,
) => {
  return await client(db).witsAlarmEvent.update({
    where: { id },
    data: {
      acknowledgedById,
      acknowledgedAt: new Date(),
    },
    select: witsAlarmEventSelect,
  });
};

export const resolveWitsAlarm = async (
  id: bigint,
  db: PrismaDbClient = prisma,
) => {
  return await client(db).witsAlarmEvent.update({
    where: { id },
    data: {
      resolvedAt: new Date(),
    },
    select: witsAlarmEventSelect,
  });
};
