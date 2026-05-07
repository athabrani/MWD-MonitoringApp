import { prisma } from "../lib/prisma.js";
import { MWD_MEASUREMENT_FIELDS } from "../utils/mwd-measurements.js";

const historicalMeasurementSelect = Object.fromEntries(
  MWD_MEASUREMENT_FIELDS.map((fieldName) => [fieldName, true]),
) as {
  [Field in (typeof MWD_MEASUREMENT_FIELDS)[number]]: true;
};

const historicalDataSelect = {
  id: true,
  sessionId: true,
  measuredAt: true,
  ...historicalMeasurementSelect,
  createdAt: true,
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

type HistoricalDataQuery = {
  sessionId?: number;
  sessionIds?: number[];
  measuredFrom?: Date;
  measuredTo?: Date;
  depthMin?: number;
  depthMax?: number;
  limit?: number;
};

export const getHistoricalData = async (query: HistoricalDataQuery) => {
  const where: {
    sessionId?: number | { in: number[] };
    measuredAt?: { gte?: Date; lte?: Date };
    depthMd?: { gte?: number; lte?: number };
  } = {};

  if (query.sessionId !== undefined) {
    where.sessionId = query.sessionId;
  } else if (query.sessionIds !== undefined) {
    where.sessionId = { in: query.sessionIds };
  }

  if (query.measuredFrom !== undefined || query.measuredTo !== undefined) {
    where.measuredAt = {};

    if (query.measuredFrom !== undefined) {
      where.measuredAt.gte = query.measuredFrom;
    }

    if (query.measuredTo !== undefined) {
      where.measuredAt.lte = query.measuredTo;
    }
  }

  if (query.depthMin !== undefined || query.depthMax !== undefined) {
    where.depthMd = {};

    if (query.depthMin !== undefined) {
      where.depthMd.gte = query.depthMin;
    }

    if (query.depthMax !== undefined) {
      where.depthMd.lte = query.depthMax;
    }
  }

  const args: {
    where: typeof where;
    orderBy: [{ measuredAt: "asc" }, { id: "asc" }];
    take?: number;
    select: typeof historicalDataSelect;
  } = {
    where,
    orderBy: [{ measuredAt: "asc" }, { id: "asc" }],
    select: historicalDataSelect,
  };

  if (query.limit !== undefined) {
    args.take = query.limit;
  }

  const data = await prisma.mWDData.findMany(args);

  return {
    count: data.length,
    data,
  };
};
