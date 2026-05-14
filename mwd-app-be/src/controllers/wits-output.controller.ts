import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import * as sessionService from "../services/mwd-session.service.js";
import * as witsOutputService from "../services/wits-output.service.js";
import { normalizeWitsId } from "../utils/mwd-measurements.js";
import {
  canAccessSessionOwner,
  canModifyMonitoringData,
  canViewAllSessions,
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

const parseOptionalText = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return typeof value === "string" ? value.trim() : null;
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

export const getWitsOutputMessages = async (req: Request, res: Response) => {
  try {
    const authUser = getAuthUser(req);
    const sessionIdParam = req.query.sessionId;
    const sessionId =
      typeof sessionIdParam === "string" ? parsePositiveInt(sessionIdParam) : undefined;
    const targetPort = parseOptionalText(req.query.targetPort);
    const status = parseOptionalText(req.query.status);
    const witsId =
      req.query.witsId === undefined
        ? undefined
        : normalizeWitsId(req.query.witsId);
    const limit =
      req.query.limit === undefined ? undefined : parsePositiveInt(req.query.limit);

    if (!authUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (sessionIdParam !== undefined && sessionId === null) {
      return res.status(400).json({ message: "sessionId must be a positive integer" });
    }

    if (targetPort === null || (targetPort !== undefined && !witsOutputService.isValidTargetPort(targetPort))) {
      return res.status(400).json({ message: "targetPort must be aux or rig" });
    }

    if (status === null || (status !== undefined && !witsOutputService.isValidStatus(status))) {
      return res.status(400).json({ message: "status must be queued, sent, failed, or skipped" });
    }

    if (req.query.witsId !== undefined && (!witsId || !/^\d{4}$/.test(witsId))) {
      return res.status(400).json({ message: "witsId must be a 4 digit WITS ID" });
    }

    if (req.query.limit !== undefined && limit === null) {
      return res.status(400).json({ message: "limit must be a positive integer" });
    }

    if (sessionId !== undefined && sessionId !== null) {
      const session = await ensureSessionAccess(req, res, sessionId);

      if (!session) {
        return;
      }
    }

    const messages = await witsOutputService.getWitsOutputMessages({
      ...(sessionId !== undefined && sessionId !== null ? { sessionId } : {}),
      ...(targetPort !== undefined ? { targetPort } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(witsId ? { witsId } : {}),
      ...(limit !== undefined && limit !== null ? { limit } : {}),
      ...(!canViewAllSessions(authUser.roleName) ? { ownerUserId: authUser.userId } : {}),
    });

    res.json({
      filters: {
        sessionId: sessionId ?? null,
        targetPort: targetPort ?? null,
        status: status ?? null,
        witsId: witsId ?? null,
        limit: limit ?? null,
      },
      count: messages.length,
      data: messages,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};

export const generateWitsOutputFromLatest = async (req: Request, res: Response) => {
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

    const result = await witsOutputService.queueWitsOutputFromLatestMwdData(sessionId);
    res.json({
      message: "WITS output queued from latest MWD data",
      ...result,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};

export const markWitsOutputStatus = async (req: Request, res: Response) => {
  try {
    if (!ensureCanModify(req, res)) {
      return;
    }

    const id = parsePositiveBigInt(req.params.id);
    const status = parseOptionalText(req.body?.status);
    const reason = parseOptionalText(req.body?.reason);

    if (id === null) {
      return res.status(400).json({ message: "Invalid WITS output message id" });
    }

    if (
      status === null ||
      status === undefined ||
      !witsOutputService.isValidStatus(status)
    ) {
      return res.status(400).json({ message: "status must be queued, sent, failed, or skipped" });
    }

    if (reason === null) {
      return res.status(400).json({ message: "reason must be a string" });
    }

    const message = await witsOutputService.updateWitsOutputStatus(
      id,
      status as "queued" | "sent" | "failed" | "skipped",
      reason,
    );

    res.json(message);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};
