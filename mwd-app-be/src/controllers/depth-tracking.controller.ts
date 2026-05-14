import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import * as depthTrackingService from "../services/depth-tracking.service.js";
import * as sessionService from "../services/mwd-session.service.js";
import {
  canAccessSessionOwner,
  canModifyMonitoringData,
} from "../utils/roles.js";

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

const parseOptionalDate = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    return "invalid" as const;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? ("invalid" as const) : parsed;
};

const getAuthUser = (req: Request) => (req as AuthenticatedRequest).user;

const canAccessSession = (req: Request, sessionUserId: number) => {
  const user = getAuthUser(req);
  return !!user && canAccessSessionOwner(user.roleName, user.userId, sessionUserId);
};

const ensureSessionAccess = async (
  req: Request,
  res: Response,
  sessionId: number,
) => {
  const session = await sessionService.getSessionById(sessionId);

  if (!session) {
    res.status(404).json({ message: "Session not found" });
    return null;
  }

  if (!canAccessSession(req, session.userId)) {
    res.status(403).json({ message: "Forbidden" });
    return null;
  }

  return session;
};

const ensureCanModify = (req: Request, res: Response) => {
  const authUser = getAuthUser(req);

  if (!authUser) {
    res.status(401).json({ message: "Unauthorized" });
    return false;
  }

  if (!canModifyMonitoringData(authUser.roleName)) {
    res.status(403).json({ message: "Forbidden" });
    return false;
  }

  return true;
};

export const getDepthTrackingState = async (req: Request, res: Response) => {
  try {
    const sessionId = parsePositiveInt(req.query.sessionId);

    if (sessionId === null) {
      return res.status(400).json({ message: "sessionId must be a positive integer" });
    }

    const session = await ensureSessionAccess(req, res, sessionId);

    if (!session) {
      return;
    }

    const state = await depthTrackingService.getDepthTrackingState(sessionId);
    res.json({ sessionId, state });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};

export const getDepthTrackingSamples = async (req: Request, res: Response) => {
  try {
    const sessionId = parsePositiveInt(req.query.sessionId);
    const measuredFrom = parseOptionalDate(req.query.measuredFrom);
    const measuredTo = parseOptionalDate(req.query.measuredTo);
    const limit =
      req.query.limit === undefined ? undefined : parsePositiveInt(req.query.limit);

    if (sessionId === null) {
      return res.status(400).json({ message: "sessionId must be a positive integer" });
    }

    if (measuredFrom === "invalid") {
      return res.status(400).json({ message: "measuredFrom must be a valid date" });
    }

    if (measuredTo === "invalid") {
      return res.status(400).json({ message: "measuredTo must be a valid date" });
    }

    if (req.query.limit !== undefined && limit === null) {
      return res.status(400).json({ message: "limit must be a positive integer" });
    }

    const session = await ensureSessionAccess(req, res, sessionId);

    if (!session) {
      return;
    }

    const samples = await depthTrackingService.getDepthTrackingSamples({
      sessionId,
      ...(measuredFrom !== undefined ? { measuredFrom } : {}),
      ...(measuredTo !== undefined ? { measuredTo } : {}),
      ...(limit !== undefined && limit !== null ? { limit } : {}),
    });

    res.json({
      filters: {
        sessionId,
        measuredFrom: measuredFrom ?? null,
        measuredTo: measuredTo ?? null,
        limit: limit ?? null,
      },
      count: samples.length,
      data: samples,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};

export const updateDepthTrackingState = async (req: Request, res: Response) => {
  try {
    if (!ensureCanModify(req, res)) {
      return;
    }

    const sessionId = parsePositiveInt(req.body?.sessionId);
    const measuredAt = parseOptionalDate(req.body?.measuredAt);

    if (sessionId === null) {
      return res.status(400).json({ message: "Valid sessionId is required" });
    }

    if (measuredAt === "invalid") {
      return res.status(400).json({ message: "measuredAt must be a valid date" });
    }

    const session = await ensureSessionAccess(req, res, sessionId);

    if (!session) {
      return;
    }

    const result = await depthTrackingService.updateDepthTrackingState({
      sessionId,
      ...(measuredAt !== undefined ? { measuredAt } : {}),
      bitDepth: req.body?.bitDepth,
      holeDepth: req.body?.holeDepth,
      blockDepth: req.body?.blockDepth,
      rop: req.body?.rop,
      mode: req.body?.mode,
      status: req.body?.status,
      source: req.body?.source ?? "manual",
      settings: req.body?.settings,
      raw: req.body ?? {},
    });

    res.json({
      message: "Depth tracking state updated",
      ...result,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};

export const recalculateDepthTracking = async (req: Request, res: Response) => {
  try {
    if (!ensureCanModify(req, res)) {
      return;
    }

    const sessionId = parsePositiveInt(req.body?.sessionId ?? req.query.sessionId);

    if (sessionId === null) {
      return res.status(400).json({ message: "Valid sessionId is required" });
    }

    const session = await ensureSessionAccess(req, res, sessionId);

    if (!session) {
      return;
    }

    const result = await depthTrackingService.recalculateDepthTrackingFromMwdData(
      sessionId,
    );
    res.json({
      message: "Depth tracking recalculated from MWD data",
      ...result,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};
