import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

type PrismaDbClient = PrismaClient | Prisma.TransactionClient;

export const CLEAR_DATA_TARGETS = [
  "mwd_data",
  "wits_values",
  "wits_alarms",
  "surveys",
  "depth_tracking",
  "wits_output",
  "edit_history",
] as const;

export type ClearDataTarget = (typeof CLEAR_DATA_TARGETS)[number];

type DepthRange = {
  startDepth: number;
  endDepth: number;
};

type SessionBackup = {
  version: 1;
  createdAt: string;
  sessionId: number;
  depthRange: DepthRange;
  targets: ClearDataTarget[];
  data: Partial<Record<ClearDataTarget, unknown[] | Record<string, unknown> | null>>;
};

type ConfigurationBackupTarget = "wits_configs" | "plot_templates";

export const CONFIGURATION_BACKUP_TARGETS = [
  "wits_configs",
  "plot_templates",
] as const satisfies readonly ConfigurationBackupTarget[];

type ConfigurationBackup = {
  version: 1;
  type: "configuration_backup";
  createdAt: string;
  targets: ConfigurationBackupTarget[];
  data: {
    wits_configs?: unknown[];
    plot_templates?: unknown[];
  };
};

const db = (client: PrismaDbClient = prisma) => client as unknown as {
  mWDSession: {
    findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
  };
  mWDData: {
    findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
    createMany: (args: unknown) => Promise<{ count: number }>;
  };
  witsDataValue: {
    findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
    createMany: (args: unknown) => Promise<{ count: number }>;
  };
  witsAlarmEvent: {
    findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
    createMany: (args: unknown) => Promise<{ count: number }>;
  };
  surveyStation: {
    findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
    createMany: (args: unknown) => Promise<{ count: number }>;
  };
  depthTrackingSample: {
    findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
    createMany: (args: unknown) => Promise<{ count: number }>;
  };
  depthTrackingState: {
    findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
    create: (args: unknown) => Promise<Record<string, unknown>>;
  };
  witsOutputMessage: {
    findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
    createMany: (args: unknown) => Promise<{ count: number }>;
  };
  mWDDataEditOperation: {
    findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
    createMany: (args: unknown) => Promise<{ count: number }>;
  };
  witsConfig: {
    findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
    upsert: (args: unknown) => Promise<Record<string, unknown>>;
  };
  plotTemplate: {
    findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
    upsert: (args: unknown) => Promise<Record<string, unknown>>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
  };
  $transaction: <T>(fn: (tx: PrismaDbClient) => Promise<T>) => Promise<T>;
};

const isFullDepthRange = (range: DepthRange) =>
  range.startDepth <= 0 && range.endDepth >= 99999;

const decimalRange = (range: DepthRange) => ({
  gte: range.startDepth,
  lte: range.endDepth,
});

const mwdDepthWhere = (range: DepthRange) =>
  isFullDepthRange(range)
    ? {}
    : {
        OR: [
          { depthMd: decimalRange(range) },
          { hole_depth: decimalRange(range) },
        ],
      };

const depthMdWhere = (range: DepthRange) =>
  isFullDepthRange(range) ? {} : { depthMd: decimalRange(range) };

const surveyDepthWhere = (range: DepthRange) =>
  isFullDepthRange(range) ? {} : { measuredDepth: decimalRange(range) };

const depthTrackingWhere = (range: DepthRange) =>
  isFullDepthRange(range)
    ? {}
    : {
        OR: [
          { bitDepth: decimalRange(range) },
          { holeDepth: decimalRange(range) },
          { blockDepth: decimalRange(range) },
        ],
      };

const editOperationDepthWhere = (range: DepthRange) =>
  isFullDepthRange(range)
    ? {}
    : {
        OR: [
          { depthMin: decimalRange(range) },
          { depthMax: decimalRange(range) },
        ],
      };

const rowCount = (value: unknown) => (Array.isArray(value) ? value.length : value ? 1 : 0);

const omitKeys = (row: Record<string, unknown>, keys: string[]) =>
  Object.fromEntries(Object.entries(row).filter(([key]) => !keys.includes(key)));

const normalizeCreateRows = (
  rows: unknown,
  sessionId: number,
  omittedKeys: string[] = ["id"],
) => {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
    .map((row) => ({
      ...omitKeys(row, omittedKeys),
      sessionId,
    }));
};

const createManyIfRows = async (
  delegate: { createMany: (args: unknown) => Promise<{ count: number }> },
  rows: Record<string, unknown>[],
  extraArgs: Record<string, unknown> = {},
) => {
  if (rows.length === 0) {
    return { count: 0 };
  }

  return await delegate.createMany({
    data: rows,
    ...extraArgs,
  });
};

export const normalizeTargets = (targets: unknown): ClearDataTarget[] => {
  if (!Array.isArray(targets) || targets.length === 0) {
    return [...CLEAR_DATA_TARGETS];
  }

  const normalized = targets
    .map((target) => (typeof target === "string" ? target.trim() : ""))
    .filter((target): target is ClearDataTarget =>
      (CLEAR_DATA_TARGETS as readonly string[]).includes(target),
    );

  return normalized.length > 0 ? [...new Set(normalized)] : [...CLEAR_DATA_TARGETS];
};

export const getValidTargets = () => [...CLEAR_DATA_TARGETS];

export const normalizeConfigurationTargets = (
  targets: unknown,
): ConfigurationBackupTarget[] => {
  if (!Array.isArray(targets) || targets.length === 0) {
    return [...CONFIGURATION_BACKUP_TARGETS];
  }

  const normalized = targets
    .map((target) => (typeof target === "string" ? target.trim() : ""))
    .filter((target): target is ConfigurationBackupTarget =>
      (CONFIGURATION_BACKUP_TARGETS as readonly string[]).includes(target),
    );

  return normalized.length > 0
    ? [...new Set(normalized)]
    : [...CONFIGURATION_BACKUP_TARGETS];
};

export const getValidConfigurationTargets = () => [
  ...CONFIGURATION_BACKUP_TARGETS,
];

export const createSessionBackup = async (
  sessionId: number,
  depthRange: DepthRange,
  targets: ClearDataTarget[],
  client: PrismaDbClient = prisma,
) => {
  const database = db(client);
  const session = await database.mWDSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      sessionCode: true,
      wellName: true,
      rigName: true,
      userId: true,
    },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  const data: SessionBackup["data"] = {};

  if (targets.includes("mwd_data")) {
    data.mwd_data = await database.mWDData.findMany({
      where: { sessionId, ...mwdDepthWhere(depthRange) },
      orderBy: [{ measuredAt: "asc" }, { id: "asc" }],
    });
  }

  if (targets.includes("wits_values")) {
    data.wits_values = await database.witsDataValue.findMany({
      where: { sessionId, ...depthMdWhere(depthRange) },
      orderBy: [{ measuredAt: "asc" }, { id: "asc" }],
    });
  }

  if (targets.includes("wits_alarms")) {
    data.wits_alarms = await database.witsAlarmEvent.findMany({
      where: { sessionId },
      orderBy: [{ measuredAt: "asc" }, { id: "asc" }],
    });
  }

  if (targets.includes("surveys")) {
    data.surveys = await database.surveyStation.findMany({
      where: { sessionId, ...surveyDepthWhere(depthRange) },
      orderBy: [{ measuredDepth: "asc" }, { id: "asc" }],
    });
  }

  if (targets.includes("depth_tracking")) {
    data.depth_tracking = {
      state: await database.depthTrackingState.findUnique({
        where: { sessionId },
      }),
      samples: await database.depthTrackingSample.findMany({
        where: { sessionId, ...depthTrackingWhere(depthRange) },
        orderBy: [{ measuredAt: "asc" }, { id: "asc" }],
      }),
    };
  }

  if (targets.includes("wits_output")) {
    data.wits_output = await database.witsOutputMessage.findMany({
      where: { sessionId, ...depthMdWhere(depthRange) },
      orderBy: [{ measuredAt: "asc" }, { id: "asc" }],
    });
  }

  if (targets.includes("edit_history")) {
    data.edit_history = await database.mWDDataEditOperation.findMany({
      where: { sessionId, ...editOperationDepthWhere(depthRange) },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }

  const backup: SessionBackup = {
    version: 1,
    createdAt: new Date().toISOString(),
    sessionId,
    depthRange,
    targets,
    data,
  };

  return {
    session,
    backup,
    counts: Object.fromEntries(
      Object.entries(data).map(([target, value]) => [
        target,
        target === "depth_tracking" && typeof value === "object" && value !== null
          ? rowCount((value as { samples?: unknown }).samples) + rowCount((value as { state?: unknown }).state)
          : rowCount(value),
      ]),
    ),
  };
};

export const previewClearSessionData = async (
  sessionId: number,
  depthRange: DepthRange,
  targets: ClearDataTarget[],
) => {
  const backup = await createSessionBackup(sessionId, depthRange, targets);

  return {
    session: backup.session,
    depthRange,
    targets,
    counts: backup.counts,
  };
};

export const clearSessionData = async (
  sessionId: number,
  depthRange: DepthRange,
  targets: ClearDataTarget[],
) => {
  return await db().$transaction(async (tx) => {
    const database = db(tx);
    const backup = await createSessionBackup(sessionId, depthRange, targets, tx);
    const deleted: Record<string, number> = {};

    if (targets.includes("wits_output")) {
      deleted.wits_output = (
        await database.witsOutputMessage.deleteMany({
          where: { sessionId, ...depthMdWhere(depthRange) },
        })
      ).count;
    }

    if (targets.includes("depth_tracking")) {
      deleted.depth_tracking_samples = (
        await database.depthTrackingSample.deleteMany({
          where: { sessionId, ...depthTrackingWhere(depthRange) },
        })
      ).count;

      if (isFullDepthRange(depthRange)) {
        deleted.depth_tracking_state = (
          await database.depthTrackingState.deleteMany({
            where: { sessionId },
          })
        ).count;
      }
    }

    if (targets.includes("edit_history")) {
      deleted.edit_history = (
        await database.mWDDataEditOperation.deleteMany({
          where: { sessionId, ...editOperationDepthWhere(depthRange) },
        })
      ).count;
    }

    if (targets.includes("surveys")) {
      deleted.surveys = (
        await database.surveyStation.deleteMany({
          where: { sessionId, ...surveyDepthWhere(depthRange) },
        })
      ).count;
    }

    if (targets.includes("wits_alarms")) {
      deleted.wits_alarms = (
        await database.witsAlarmEvent.deleteMany({
          where: { sessionId },
        })
      ).count;
    }

    if (targets.includes("wits_values")) {
      deleted.wits_values = (
        await database.witsDataValue.deleteMany({
          where: { sessionId, ...depthMdWhere(depthRange) },
        })
      ).count;
    }

    if (targets.includes("mwd_data")) {
      deleted.mwd_data = (
        await database.mWDData.deleteMany({
          where: { sessionId, ...mwdDepthWhere(depthRange) },
        })
      ).count;
    }

    return {
      session: backup.session,
      depthRange,
      targets,
      deleted,
      backup: backup.backup,
    };
  });
};

export const restoreSessionData = async (
  sessionId: number,
  backup: SessionBackup,
  targets: ClearDataTarget[],
  replaceExisting: boolean,
) => {
  if (!backup || backup.version !== 1 || typeof backup.data !== "object") {
    throw new Error("Invalid backup format");
  }

  if (replaceExisting) {
    await clearSessionData(sessionId, backup.depthRange, targets);
  }

  return await db().$transaction(async (tx) => {
    const database = db(tx);

    const restored: Record<string, number> = {};

    if (targets.includes("mwd_data")) {
      restored.mwd_data = (await createManyIfRows(
        database.mWDData,
        normalizeCreateRows(backup.data.mwd_data, sessionId),
      )).count;
    }

    if (targets.includes("wits_values")) {
      restored.wits_values = (await createManyIfRows(
        database.witsDataValue,
        normalizeCreateRows(backup.data.wits_values, sessionId),
      )).count;
    }

    if (targets.includes("wits_alarms")) {
      restored.wits_alarms = (await createManyIfRows(
        database.witsAlarmEvent,
        normalizeCreateRows(backup.data.wits_alarms, sessionId),
      )).count;
    }

    if (targets.includes("surveys")) {
      restored.surveys = (await createManyIfRows(
        database.surveyStation,
        normalizeCreateRows(backup.data.surveys, sessionId),
        { skipDuplicates: true },
      )).count;
    }

    if (targets.includes("depth_tracking")) {
      const depthTracking = backup.data.depth_tracking as
        | { state?: Record<string, unknown> | null; samples?: unknown[] }
        | undefined;

      if (depthTracking?.state) {
        await database.depthTrackingState.create({
          data: {
            ...omitKeys(depthTracking.state, ["id"]),
            sessionId,
          },
        });
        restored.depth_tracking_state = 1;
      }

      restored.depth_tracking_samples = (await createManyIfRows(
        database.depthTrackingSample,
        normalizeCreateRows(depthTracking?.samples ?? [], sessionId, [
          "id",
          "stateId",
        ]),
      )).count;
    }

    if (targets.includes("wits_output")) {
      restored.wits_output = (await createManyIfRows(
        database.witsOutputMessage,
        normalizeCreateRows(backup.data.wits_output, sessionId),
      )).count;
    }

    if (targets.includes("edit_history")) {
      restored.edit_history = (await createManyIfRows(
        database.mWDDataEditOperation,
        normalizeCreateRows(backup.data.edit_history, sessionId),
      )).count;
    }

    return {
      sessionId,
      targets,
      restored,
    };
  });
};

export const createConfigurationBackup = async (
  targets: ConfigurationBackupTarget[],
) => {
  const database = db();
  const data: ConfigurationBackup["data"] = {};

  if (targets.includes("wits_configs")) {
    data.wits_configs = await database.witsConfig.findMany({
      orderBy: { witsId: "asc" },
    });
  }

  if (targets.includes("plot_templates")) {
    data.plot_templates = await database.plotTemplate.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  }

  const backup: ConfigurationBackup = {
    version: 1,
    type: "configuration_backup",
    createdAt: new Date().toISOString(),
    targets,
    data,
  };

  return {
    targets,
    counts: {
      ...(data.wits_configs ? { wits_configs: data.wits_configs.length } : {}),
      ...(data.plot_templates
        ? { plot_templates: data.plot_templates.length }
        : {}),
    },
    backup,
  };
};

const normalizeConfigurationRows = (
  rows: unknown,
  omittedKeys: string[] = ["id", "createdAt", "updatedAt"],
) => {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
    .map((row) => omitKeys(row, omittedKeys));
};

export const restoreConfigurationBackup = async (
  backup: ConfigurationBackup,
  targets: ConfigurationBackupTarget[],
) => {
  if (
    !backup ||
    backup.version !== 1 ||
    backup.type !== "configuration_backup" ||
    typeof backup.data !== "object"
  ) {
    throw new Error("Invalid configuration backup format");
  }

  return await db().$transaction(async (tx) => {
    const database = db(tx);
    const restored: Record<string, number> = {};

    if (targets.includes("wits_configs")) {
      const rows = normalizeConfigurationRows(backup.data.wits_configs);
      let count = 0;

      for (const row of rows) {
        const witsId = typeof row.witsId === "string" ? row.witsId : null;

        if (!witsId) {
          continue;
        }

        await database.witsConfig.upsert({
          where: { witsId },
          create: row,
          update: row,
        });
        count += 1;
      }

      restored.wits_configs = count;
    }

    if (targets.includes("plot_templates")) {
      const rows = normalizeConfigurationRows(backup.data.plot_templates);
      let count = 0;

      for (const row of rows) {
        const name = typeof row.name === "string" ? row.name : null;

        if (!name) {
          continue;
        }

        await database.plotTemplate.upsert({
          where: { name },
          create: row,
          update: row,
        });
        count += 1;
      }

      restored.plot_templates = count;
    }

    return {
      targets,
      restored,
    };
  });
};
