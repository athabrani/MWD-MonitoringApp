import type { Request, Response } from "express";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import * as mwdDataService from "../services/mwd-data.service.js";
import * as sessionService from "../services/mwd-session.service.js";
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
    return null;
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseOptionalDecimal = (value: unknown) => {
  if (value === undefined) {
    return { provided: false as const, value: undefined };
  }

  if (value === null || value === "") {
    return { provided: true as const, value: null };
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? { provided: true as const, value }
      : { provided: true as const, value: "invalid" as const };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return { provided: true as const, value: null };
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed)
      ? { provided: true as const, value: trimmed }
      : { provided: true as const, value: "invalid" as const };
  }

  return { provided: true as const, value: "invalid" as const };
};

const canAccessSession = (req: Request, sessionUserId: number) => {
  const user = (req as AuthenticatedRequest).user;
  return !!user && (user.roleName === "Engineer" || user.userId === sessionUserId);
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

const parseMeasurementFields = (source: Record<string, unknown>) => {
  const depthMd = parseOptionalDecimal(source.depthMd);
  const inclination = parseOptionalDecimal(source.inclination);
  const azimuth = parseOptionalDecimal(source.azimuth);
  const gammaRay = parseOptionalDecimal(source.gammaRay);
  const rop = parseOptionalDecimal(source.rop);
  const hookLoad = parseOptionalDecimal(source.hookLoad);
  const standpipePressure = parseOptionalDecimal(source.standpipePressure);

  const parsedFields = {
    depthMd,
    inclination,
    azimuth,
    gammaRay,
    rop,
    hookLoad,
    standpipePressure,
  };

  for (const [fieldName, fieldValue] of Object.entries(parsedFields)) {
    if (fieldValue.value === "invalid") {
      return { error: `${fieldName} must be a valid number` };
    }
  }

  return { parsedFields };
};

const applyMeasurementFields = (
  target: {
    depthMd?: number | string | null;
    inclination?: number | string | null;
    azimuth?: number | string | null;
    gammaRay?: number | string | null;
    rop?: number | string | null;
    hookLoad?: number | string | null;
    standpipePressure?: number | string | null;
  },
  parsedFields: {
    depthMd: { provided: boolean; value: number | string | null | undefined };
    inclination: { provided: boolean; value: number | string | null | undefined };
    azimuth: { provided: boolean; value: number | string | null | undefined };
    gammaRay: { provided: boolean; value: number | string | null | undefined };
    rop: { provided: boolean; value: number | string | null | undefined };
    hookLoad: { provided: boolean; value: number | string | null | undefined };
    standpipePressure: { provided: boolean; value: number | string | null | undefined };
  },
) => {
  if (parsedFields.depthMd.provided) {
    target.depthMd = parsedFields.depthMd.value ?? null;
  }

  if (parsedFields.inclination.provided) {
    target.inclination = parsedFields.inclination.value ?? null;
  }

  if (parsedFields.azimuth.provided) {
    target.azimuth = parsedFields.azimuth.value ?? null;
  }

  if (parsedFields.gammaRay.provided) {
    target.gammaRay = parsedFields.gammaRay.value ?? null;
  }

  if (parsedFields.rop.provided) {
    target.rop = parsedFields.rop.value ?? null;
  }

  if (parsedFields.hookLoad.provided) {
    target.hookLoad = parsedFields.hookLoad.value ?? null;
  }

  if (parsedFields.standpipePressure.provided) {
    target.standpipePressure = parsedFields.standpipePressure.value ?? null;
  }
};

export const createMWDData = async (req: Request, res: Response) => {
  try {
    const sessionId = parsePositiveInt(req.body?.sessionId);
    const measuredAt = parseOptionalDateInput(req.body?.measuredAt);

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

    const measurementResult = parseMeasurementFields(req.body ?? {});

    if ("error" in measurementResult) {
      return res.status(400).json({ message: measurementResult.error });
    }

    const { measuredAt: syncedMeasuredAt, syncInfo } =
      await syncTimestampAndDepth({
        sessionId,
        measuredAt,
        depthMd: measurementResult.parsedFields.depthMd.value ?? null,
      });

    const input: {
      sessionId: number;
      measuredAt: Date;
      depthMd?: number | string | null;
      inclination?: number | string | null;
      azimuth?: number | string | null;
      gammaRay?: number | string | null;
      rop?: number | string | null;
      hookLoad?: number | string | null;
      standpipePressure?: number | string | null;
    } = {
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
      authUser?.roleName === "Engineer"
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
      depthMd?: number | string | null;
      inclination?: number | string | null;
      azimuth?: number | string | null;
      gammaRay?: number | string | null;
      rop?: number | string | null;
      hookLoad?: number | string | null;
      standpipePressure?: number | string | null;
    } = {};

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

      if (!measuredAt) {
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
