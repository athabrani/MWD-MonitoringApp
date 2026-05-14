import type { Request, Response } from "express";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import * as sessionService from "../services/mwd-session.service.js";
import * as witsDataService from "../services/wits-data.service.js";
import { normalizeWitsId } from "../utils/mwd-measurements.js";
import {
  canAccessSessionOwner,
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

const parseOptionalDate = (value: unknown, fieldName: string) => {
  if (value === undefined) {
    return { provided: false as const, value: undefined };
  }

  if (typeof value !== "string" || !value.trim()) {
    return {
      provided: true as const,
      error: `${fieldName} must be a valid date`,
    };
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? { provided: true as const, error: `${fieldName} must be a valid date` }
    : { provided: true as const, value: date };
};

const parseOptionalNumber = (value: unknown, fieldName: string) => {
  if (value === undefined) {
    return { provided: false as const, value: undefined };
  }

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : NaN;

  return Number.isFinite(parsed)
    ? { provided: true as const, value: parsed }
    : { provided: true as const, error: `${fieldName} must be a valid number` };
};

const parseOptionalBoolean = (value: unknown, fieldName: string) => {
  if (value === undefined) {
    return { provided: false as const, value: undefined };
  }

  if (typeof value === "boolean") {
    return { provided: true as const, value };
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true" || normalized === "1") {
      return { provided: true as const, value: true };
    }

    if (normalized === "false" || normalized === "0") {
      return { provided: true as const, value: false };
    }
  }

  return {
    provided: true as const,
    error: `${fieldName} must be true or false`,
  };
};

const parseOptionalWitsId = (value: unknown) => {
  if (value === undefined) {
    return { provided: false as const, value: undefined };
  }

  const witsId = normalizeWitsId(value);

  if (!witsId || !/^\d{4}$/.test(witsId)) {
    return {
      provided: true as const,
      error: "witsId must be a 4 digit WITS ID",
    };
  }

  return { provided: true as const, value: witsId };
};

const canAccessSession = (req: Request, sessionUserId: number) => {
  const user = (req as AuthenticatedRequest).user;
  return !!user && canAccessSessionOwner(user.roleName, user.userId, sessionUserId);
};

const getSessionFilter = async (req: Request, res: Response) => {
  const authUser = (req as AuthenticatedRequest).user;
  const sessionIdParam = req.query.sessionId;
  const sessionId =
    typeof sessionIdParam === "string" ? parsePositiveInt(sessionIdParam) : null;

  if (!authUser) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }

  if (sessionIdParam !== undefined && sessionId === null) {
    res.status(400).json({ message: "sessionId must be a positive integer" });
    return null;
  }

  if (sessionId !== null) {
    const session = await sessionService.getSessionById(sessionId);

    if (!session) {
      res.status(404).json({ message: "Session not found" });
      return null;
    }

    if (!canAccessSession(req, session.userId)) {
      res.status(403).json({ message: "Forbidden" });
      return null;
    }
  }

  const filter: { sessionId?: number; ownerUserId?: number } = {};

  if (sessionId !== null) {
    filter.sessionId = sessionId;
  }

  if (!canViewAllSessions(authUser.roleName)) {
    filter.ownerUserId = authUser.userId;
  }

  return filter;
};

const parseLimit = (value: unknown) => {
  if (value === undefined) {
    return undefined;
  }

  const parsed = parsePositiveInt(value);
  return parsed ?? "invalid";
};

const handleWitsDataWriteError = (error: unknown, res: Response) => {
  if (
    error instanceof PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    return res.status(404).json({ message: "WITS alarm not found" });
  }

  const message =
    error instanceof Error ? error.message : "Internal server error";
  return res.status(500).json({ message });
};

export const getWitsDataValues = async (req: Request, res: Response) => {
  try {
    const sessionFilter = await getSessionFilter(req, res);

    if (!sessionFilter) {
      return;
    }

    const witsId = parseOptionalWitsId(req.query.witsId);
    const measuredFrom = parseOptionalDate(req.query.measuredFrom, "measuredFrom");
    const measuredTo = parseOptionalDate(req.query.measuredTo, "measuredTo");
    const depthMin = parseOptionalNumber(req.query.depthMin, "depthMin");
    const depthMax = parseOptionalNumber(req.query.depthMax, "depthMax");
    const limit = parseLimit(req.query.limit);

    for (const parsed of [witsId, measuredFrom, measuredTo, depthMin, depthMax]) {
      if ("error" in parsed) {
        return res.status(400).json({ message: parsed.error });
      }
    }

    if (limit === "invalid") {
      return res.status(400).json({ message: "limit must be a positive integer" });
    }

    const filters: witsDataService.WitsDataValueFilters = {
      ...sessionFilter,
      ...(witsId.provided ? { witsId: witsId.value } : {}),
      ...(measuredFrom.provided ? { measuredFrom: measuredFrom.value } : {}),
      ...(measuredTo.provided ? { measuredTo: measuredTo.value } : {}),
      ...(depthMin.provided ? { depthMin: depthMin.value } : {}),
      ...(depthMax.provided ? { depthMax: depthMax.value } : {}),
      ...(limit !== undefined ? { limit } : {}),
    };
    const data = await witsDataService.getWitsDataValues(filters);

    res.json({
      filters,
      count: data.length,
      data,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};

export const getWitsAlarmEvents = async (req: Request, res: Response) => {
  try {
    const sessionFilter = await getSessionFilter(req, res);

    if (!sessionFilter) {
      return;
    }

    const witsId = parseOptionalWitsId(req.query.witsId);
    const acknowledged = parseOptionalBoolean(
      req.query.acknowledged,
      "acknowledged",
    );
    const limit = parseLimit(req.query.limit);

    for (const parsed of [witsId, acknowledged]) {
      if ("error" in parsed) {
        return res.status(400).json({ message: parsed.error });
      }
    }

    if (limit === "invalid") {
      return res.status(400).json({ message: "limit must be a positive integer" });
    }

    const filters: witsDataService.WitsAlarmFilters = {
      ...sessionFilter,
      ...(witsId.provided ? { witsId: witsId.value } : {}),
      ...(acknowledged.provided ? { acknowledged: acknowledged.value } : {}),
      ...(limit !== undefined ? { limit } : {}),
    };
    const data = await witsDataService.getWitsAlarmEvents(filters);

    res.json({
      filters,
      count: data.length,
      data,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};

export const acknowledgeWitsAlarm = async (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthenticatedRequest).user;
    const id = parsePositiveBigInt(req.params.id);

    if (!authUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (id === null) {
      return res.status(400).json({ message: "Invalid WITS alarm id" });
    }

    const alarm = await witsDataService.acknowledgeWitsAlarm(
      id,
      authUser.userId,
    );
    res.json(alarm);
  } catch (error: unknown) {
    return handleWitsDataWriteError(error, res);
  }
};

export const resolveWitsAlarm = async (req: Request, res: Response) => {
  try {
    const id = parsePositiveBigInt(req.params.id);

    if (id === null) {
      return res.status(400).json({ message: "Invalid WITS alarm id" });
    }

    const alarm = await witsDataService.resolveWitsAlarm(id);
    res.json(alarm);
  } catch (error: unknown) {
    return handleWitsDataWriteError(error, res);
  }
};
