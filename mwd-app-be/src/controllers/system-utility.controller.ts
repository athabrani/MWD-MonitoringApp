import type { Request, Response } from "express";
import * as systemUtilityService from "../services/system-utility.service.js";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { createAuditLog } from "../services/audit-log.service.js";

const parsePositiveInt = (value: unknown) => {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
};

const parseDepthValue = (value: unknown, fallback: number) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseBoolean = (value: unknown) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
  }

  return false;
};

const getClearInput = (body: Record<string, unknown>) => {
  const sessionId = parsePositiveInt(body.sessionId);
  const startDepth = parseDepthValue(
    body.startDepth ?? body.depthMin ?? body.depthStart,
    0,
  );
  const endDepth = parseDepthValue(
    body.endDepth ?? body.depthMax ?? body.depthEnd,
    99999,
  );
  const targets = systemUtilityService.normalizeTargets(body.targets);

  if (sessionId === null) {
    return { error: "sessionId must be a positive integer" } as const;
  }

  if (startDepth === null || endDepth === null) {
    return { error: "startDepth and endDepth must be valid numbers" } as const;
  }

  if (startDepth > endDepth) {
    return { error: "startDepth must be less than or equal to endDepth" } as const;
  }

  return {
    sessionId,
    depthRange: {
      startDepth,
      endDepth,
    },
    targets,
  } as const;
};

const getUserId = (req: Request) =>
  (req as AuthenticatedRequest).user?.userId ?? null;

export const getClearDataTargets = (_req: Request, res: Response) => {
  res.json({
    data: systemUtilityService.getValidTargets(),
  });
};

export const getConfigurationBackupTargets = (_req: Request, res: Response) => {
  res.json({
    data: systemUtilityService.getValidConfigurationTargets(),
  });
};

export const backupSessionData = async (req: Request, res: Response) => {
  try {
    const input = getClearInput(req.body ?? {});

    if ("error" in input) {
      return res.status(400).json({ message: input.error });
    }

    const result = await systemUtilityService.createSessionBackup(
      input.sessionId,
      input.depthRange,
      input.targets,
    );

    await createAuditLog({
      userId: getUserId(req),
      action: "system.backup_session",
      details: `Generated backup for session ${input.sessionId}`,
      metadata: {
        sessionId: input.sessionId,
        depthRange: input.depthRange,
        targets: input.targets,
        counts: result.counts,
      },
    });

    res.json({
      message: "Session backup generated",
      session: result.session,
      depthRange: input.depthRange,
      targets: input.targets,
      counts: result.counts,
      backup: result.backup,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const status = message === "Session not found" ? 404 : 500;
    res.status(status).json({ message });
  }
};

export const previewClearSessionData = async (req: Request, res: Response) => {
  try {
    const input = getClearInput(req.body ?? {});

    if ("error" in input) {
      return res.status(400).json({ message: input.error });
    }

    const result = await systemUtilityService.previewClearSessionData(
      input.sessionId,
      input.depthRange,
      input.targets,
    );

    await createAuditLog({
      userId: getUserId(req),
      action: "system.preview_clear_session",
      details: `Previewed clear data for session ${input.sessionId}`,
      metadata: {
        sessionId: input.sessionId,
        depthRange: input.depthRange,
        targets: input.targets,
        counts: result.counts,
      },
    });

    res.json({
      message: "Clear data preview",
      ...result,
      requiredConfirm: `CLEAR_DATA_SESSION_${input.sessionId}`,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const status = message === "Session not found" ? 404 : 500;
    res.status(status).json({ message });
  }
};

export const clearSessionData = async (req: Request, res: Response) => {
  try {
    const input = getClearInput(req.body ?? {});

    if ("error" in input) {
      return res.status(400).json({ message: input.error });
    }

    const requiredConfirm = `CLEAR_DATA_SESSION_${input.sessionId}`;

    if (req.body?.confirm !== requiredConfirm) {
      return res.status(400).json({
        message: `confirm must be ${requiredConfirm}`,
      });
    }

    const result = await systemUtilityService.clearSessionData(
      input.sessionId,
      input.depthRange,
      input.targets,
    );

    await createAuditLog({
      userId: getUserId(req),
      action: "system.clear_session",
      details: `Cleared data for session ${input.sessionId}`,
      metadata: {
        sessionId: input.sessionId,
        depthRange: input.depthRange,
        targets: input.targets,
        deleted: result.deleted,
      },
    });

    res.json({
      message: "Session data cleared",
      ...result,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const status = message === "Session not found" ? 404 : 500;
    res.status(status).json({ message });
  }
};

export const restoreSessionData = async (req: Request, res: Response) => {
  try {
    const sessionId = parsePositiveInt(req.body?.sessionId);

    if (sessionId === null) {
      return res.status(400).json({ message: "sessionId must be a positive integer" });
    }

    const requiredConfirm = `RESTORE_DATA_SESSION_${sessionId}`;

    if (req.body?.confirm !== requiredConfirm) {
      return res.status(400).json({
        message: `confirm must be ${requiredConfirm}`,
      });
    }

    const backup = req.body?.backup;
    const targets = systemUtilityService.normalizeTargets(
      req.body?.targets ?? (typeof backup === "object" && backup !== null
        ? (backup as { targets?: unknown }).targets
        : undefined),
    );
    const replaceExisting = parseBoolean(req.body?.replaceExisting);
    const result = await systemUtilityService.restoreSessionData(
      sessionId,
      backup,
      targets,
      replaceExisting,
    );

    await createAuditLog({
      userId: getUserId(req),
      action: "system.restore_session",
      details: `Restored data for session ${sessionId}`,
      metadata: {
        sessionId,
        targets,
        replaceExisting,
        restored: result.restored,
      },
    });

    res.json({
      message: "Session data restored",
      replaceExisting,
      ...result,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};

export const backupConfiguration = async (req: Request, res: Response) => {
  try {
    const targets = systemUtilityService.normalizeConfigurationTargets(
      req.body?.targets,
    );
    const result = await systemUtilityService.createConfigurationBackup(targets);

    await createAuditLog({
      userId: getUserId(req),
      action: "system.backup_configuration",
      details: "Generated configuration backup",
      metadata: {
        targets,
        counts: result.counts,
      },
    });

    res.json({
      message: "Configuration backup generated",
      ...result,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};

export const restoreConfiguration = async (req: Request, res: Response) => {
  try {
    const confirm = req.body?.confirm;

    if (confirm !== "RESTORE_CONFIGURATION") {
      return res.status(400).json({
        message: "confirm must be RESTORE_CONFIGURATION",
      });
    }

    const backup = req.body?.backup;
    const targets = systemUtilityService.normalizeConfigurationTargets(
      req.body?.targets ??
        (typeof backup === "object" && backup !== null
          ? (backup as { targets?: unknown }).targets
          : undefined),
    );
    const result = await systemUtilityService.restoreConfigurationBackup(
      backup,
      targets,
    );

    await createAuditLog({
      userId: getUserId(req),
      action: "system.restore_configuration",
      details: "Restored configuration backup",
      metadata: {
        targets,
        restored: result.restored,
      },
    });

    res.json({
      message: "Configuration restored",
      ...result,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};
