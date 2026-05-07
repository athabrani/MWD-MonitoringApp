import type { Request, Response } from "express";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import * as mwdDataService from "../services/mwd-data.service.js";
import * as sessionService from "../services/mwd-session.service.js";
import {
  applyMeasurementFields,
  parseMeasurementFields,
  type MWDMeasurementInput,
} from "../utils/mwd-measurements.js";
import {
  canAccessSessionOwner,
  canModifyMonitoringData,
  canViewAllSessions,
} from "../utils/roles.js";
import { syncTimestampAndDepth } from "../utils/timestamp-depth-sync.js";

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

const parsePositiveBigInt = (value: unknown) => {
  if (typeof value === "bigint" && value > 0n) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    try {
      const parsed = BigInt(value);
      return parsed > 0n ? parsed : null;
    } catch {
      return null;
    }
  }

  return null;
};

const parseOptionalDateInput = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string" || !value.trim()) {
    return "invalid" as const;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? ("invalid" as const) : date;
};

const canAccessSession = (req: Request, sessionUserId: number) => {
  const user = (req as AuthenticatedRequest).user;
  return !!user && canAccessSessionOwner(user.roleName, user.userId, sessionUserId);
};

const handleMWDDataWriteError = (error: unknown, res: Response) => {
  if (
    error instanceof PrismaClientKnownRequestError &&
    error.code === "P2003"
  ) {
    return res.status(400).json({ message: "Session not found" });
  }

  if (
    error instanceof PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    return res.status(404).json({ message: "MWD data not found" });
  }

  const message =
    error instanceof Error ? error.message : "Internal server error";
  return res.status(500).json({ message });
};

export const createMWDData = async (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthenticatedRequest).user;
    const sessionId = parsePositiveInt(req.body?.sessionId);
    const measuredAt = parseOptionalDateInput(req.body?.measuredAt);

    if (!authUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!canModifyMonitoringData(authUser.roleName)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (sessionId === null) {
      return res.status(400).json({ message: "Valid sessionId is required" });
    }

    if (measuredAt === "invalid") {
      return res.status(400).json({ message: "measuredAt must be a valid date" });
    }

    const session = await sessionService.getSessionById(sessionId);

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    if (!canAccessSession(req, session.userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const measurementResult = parseMeasurementFields(req.body ?? {});

    if ("error" in measurementResult) {
      return res.status(400).json({ message: measurementResult.error });
    }

    const { measuredAt: syncedMeasuredAt, syncInfo } =
      await syncTimestampAndDepth({
        sessionId,
        ...(measuredAt !== undefined ? { measuredAt } : {}),
        depthMd: measurementResult.parsedFields.depthMd.value ?? null,
      });

    const input: {
      sessionId: number;
      measuredAt: Date;
    } & MWDMeasurementInput = {
      sessionId,
      measuredAt: syncedMeasuredAt,
    };

    applyMeasurementFields(input, measurementResult.parsedFields);

    const data = await mwdDataService.createMWDData(input);
    res.status(201).json({ ...data, syncInfo });
  } catch (error: unknown) {
    return handleMWDDataWriteError(error, res);
  }
};

export const getAllMWDData = async (req: Request, res: Response) => {
  try {
    const sessionIdParam = req.query.sessionId;
    const sessionId =
      typeof sessionIdParam === "string" ? parsePositiveInt(sessionIdParam) : null;

    if (sessionIdParam !== undefined && sessionId === null) {
      return res.status(400).json({ message: "sessionId must be a positive integer" });
    }

    if (sessionId !== null) {
      const session = await sessionService.getSessionById(sessionId);

      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      if (!canAccessSession(req, session.userId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
    }

    const authUser = (req as AuthenticatedRequest).user;
    const allData = await mwdDataService.getAllMWDData(sessionId ?? undefined);

    const filteredData =
      authUser && canViewAllSessions(authUser.roleName)
        ? allData
        : allData.filter((item) => item.session.userId === authUser?.userId);

    res.json(filteredData);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};

export const getMWDDataById = async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    const id = typeof idParam === "string" ? parsePositiveBigInt(idParam) : null;

    if (id === null) {
      return res.status(400).json({ message: "Invalid MWD data id" });
    }

    const data = await mwdDataService.getMWDDataById(id);

    if (!data) {
      return res.status(404).json({ message: "MWD data not found" });
    }

    if (!canAccessSession(req, data.session.userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    res.json(data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};

export const updateMWDData = async (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthenticatedRequest).user;
    const idParam = req.params.id;
    const id = typeof idParam === "string" ? parsePositiveBigInt(idParam) : null;

    if (!authUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!canModifyMonitoringData(authUser.roleName)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (id === null) {
      return res.status(400).json({ message: "Invalid MWD data id" });
    }

    const existingData = await mwdDataService.getMWDDataById(id);

    if (!existingData) {
      return res.status(404).json({ message: "MWD data not found" });
    }

    if (!canAccessSession(req, existingData.session.userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updates: {
      sessionId?: number;
      measuredAt?: Date;
    } & MWDMeasurementInput = {};

    if (req.body?.sessionId !== undefined) {
      const sessionId = parsePositiveInt(req.body.sessionId);

      if (sessionId === null) {
        return res.status(400).json({ message: "Valid sessionId is required" });
      }

      const session = await sessionService.getSessionById(sessionId);

      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      if (!canAccessSession(req, session.userId)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      updates.sessionId = sessionId;
    }

    if (req.body?.measuredAt !== undefined) {
      const measuredAt = parseOptionalDateInput(req.body.measuredAt);

      if (measuredAt === "invalid" || measuredAt === undefined) {
        return res.status(400).json({ message: "measuredAt must be a valid date" });
      }

      updates.measuredAt = measuredAt;
    }

    const measurementResult = parseMeasurementFields(req.body ?? {});

    if ("error" in measurementResult) {
      return res.status(400).json({ message: measurementResult.error });
    }

    applyMeasurementFields(updates, measurementResult.parsedFields);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const targetSessionId = updates.sessionId ?? existingData.sessionId;
    const targetMeasuredAt = updates.measuredAt ?? existingData.measuredAt;
    const targetDepthMd =
      updates.depthMd !== undefined ? updates.depthMd : existingData.depthMd;

    if (
      updates.sessionId !== undefined ||
      updates.measuredAt !== undefined ||
      updates.depthMd !== undefined
    ) {
      const syncInput = {
        sessionId: targetSessionId,
        ...(targetMeasuredAt !== null ? { measuredAt: targetMeasuredAt } : {}),
        depthMd: targetDepthMd,
        excludeId: id,
      };
      const { measuredAt: syncedMeasuredAt } = await syncTimestampAndDepth(syncInput);

      updates.measuredAt = syncedMeasuredAt;
    }

    const data = await mwdDataService.updateMWDData(id, updates);
    res.json(data);
  } catch (error: unknown) {
    return handleMWDDataWriteError(error, res);
  }
};

export const deleteMWDData = async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    const id = typeof idParam === "string" ? parsePositiveBigInt(idParam) : null;

    if (id === null) {
      return res.status(400).json({ message: "Invalid MWD data id" });
    }

    const existingData = await mwdDataService.getMWDDataById(id);

    if (!existingData) {
      return res.status(404).json({ message: "MWD data not found" });
    }

    if (!canAccessSession(req, existingData.session.userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await mwdDataService.deleteMWDData(id);
    res.json({ message: "MWD data deleted successfully" });
  } catch (error: unknown) {
    return handleMWDDataWriteError(error, res);
  }
};
