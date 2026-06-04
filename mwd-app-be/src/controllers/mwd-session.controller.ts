import type { Request, Response } from "express";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import * as sessionService from "../services/mwd-session.service.js";
import { createAuditLog } from "../services/audit-log.service.js";
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

const normalizeString = (value: unknown) => {
  return typeof value === "string" ? value.trim() : "";
};

const normalizeNullableString = (value: unknown) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  return typeof value === "string" ? value.trim() || null : null;
};

const parseOptionalDecimal = (value: unknown, fieldName: string) => {
  if (value === undefined) {
    return { provided: false as const, value: undefined };
  }

  if (value === null || value === "") {
    return { provided: true as const, value: null };
  }

  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed)
    ? { provided: true as const, value: parsed }
    : { provided: true as const, error: `${fieldName} must be a valid number` };
};

const parseOptionalDate = (value: unknown) => {
  if (value === undefined) {
    return { provided: false as const, value: undefined };
  }

  if (value === null || value === "") {
    return { provided: true as const, value: null };
  }

  if (typeof value !== "string") {
    return { provided: true as const, value: "invalid" as const };
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? { provided: true as const, value: "invalid" as const }
    : { provided: true as const, value: date };
};

const canAccessSession = (
  req: Request,
  sessionUserId: number,
) => {
  const user = (req as AuthenticatedRequest).user;
  return !!user && canAccessSessionOwner(user.roleName, user.userId, sessionUserId);
};

const handleSessionWriteError = (error: unknown, res: Response) => {
  if (
    error instanceof PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return res.status(409).json({ message: "Session code already exists" });
  }

  if (
    error instanceof PrismaClientKnownRequestError &&
    error.code === "P2003"
  ) {
    return res
      .status(400)
      .json({ message: "User or connection status not found" });
  }

  if (
    error instanceof PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    return res.status(404).json({ message: "Session not found" });
  }

  const message =
    error instanceof Error ? error.message : "Internal server error";
  return res.status(500).json({ message });
};

const SESSION_TEXT_FIELDS = [
  "company",
  "wellId",
  "fieldName",
  "jobNumber",
  "province",
  "countyParish",
  "country",
  "location",
  "notes",
] as const;

const getSessionBodyValue = (
  body: Record<string, unknown>,
  fieldName: string,
) => {
  if (fieldName === "fieldName" && Object.prototype.hasOwnProperty.call(body, "field")) {
    return body.field;
  }

  return body[fieldName];
};

const collectSessionMetadata = (
  body: Record<string, unknown>,
  options: { create: boolean },
) => {
  const data: Record<string, string | number | null> = {};

  for (const fieldName of SESSION_TEXT_FIELDS) {
    const rawValue = getSessionBodyValue(body, fieldName);

    if (!options.create && rawValue === undefined) {
      continue;
    }

    const value = normalizeNullableString(rawValue);

    if (value !== undefined) {
      data[fieldName] = value;
    }
  }

  for (const fieldName of ["latitude", "longitude"] as const) {
    const parsed = parseOptionalDecimal(body[fieldName], fieldName);

    if ("error" in parsed) {
      return { error: parsed.error };
    }

    if (parsed.provided) {
      data[fieldName] = parsed.value;
    }
  }

  return { data };
};

export const createSession = async (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthenticatedRequest).user;

    if (!authUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!canModifyMonitoringData(authUser.roleName)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const sessionCode = normalizeString(req.body?.sessionCode);
    const wellName = normalizeString(req.body?.wellName);
    const rigName = normalizeString(req.body?.rigName);
    const metadata = collectSessionMetadata(req.body ?? {}, { create: true });
    const requestedUserId = parsePositiveInt(req.body?.userId);
    const connectionStatusId =
      req.body?.connectionStatusId === undefined
        ? undefined
        : req.body?.connectionStatusId === null
          ? null
          : parsePositiveInt(req.body?.connectionStatusId);
    const startedAt = parseOptionalDate(req.body?.startedAt);
    const endedAt = parseOptionalDate(req.body?.endedAt);

    if (!sessionCode) {
      return res.status(400).json({ message: "Session code is required" });
    }

    if ("error" in metadata) {
      return res.status(400).json({ message: metadata.error });
    }

    if (connectionStatusId === null && req.body?.connectionStatusId !== null) {
      return res
        .status(400)
        .json({ message: "connectionStatusId must be a positive integer" });
    }

    if (startedAt.value === "invalid") {
      return res.status(400).json({ message: "startedAt must be a valid date" });
    }

    if (endedAt.value === "invalid") {
      return res.status(400).json({ message: "endedAt must be a valid date" });
    }

    const userId =
      canViewAllSessions(authUser.roleName) && requestedUserId !== null
        ? requestedUserId
        : authUser.userId;

    const createInput: {
      userId: number;
      sessionCode: string;
      company?: string | null;
      wellName?: string | null;
      wellId?: string | null;
      rigName?: string | null;
      fieldName?: string | null;
      jobNumber?: string | null;
      province?: string | null;
      countyParish?: string | null;
      country?: string | null;
      location?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      notes?: string | null;
      connectionStatusId?: number | null;
      startedAt?: Date;
      endedAt?: Date | null;
    } = {
      userId,
      sessionCode,
      wellName: wellName || null,
      rigName: rigName || null,
      ...metadata.data,
    };

    if (connectionStatusId !== undefined) {
      createInput.connectionStatusId = connectionStatusId;
    }

    if (startedAt.provided && startedAt.value instanceof Date) {
      createInput.startedAt = startedAt.value;
    }

    if (
      endedAt.provided &&
      (endedAt.value === null || endedAt.value instanceof Date)
    ) {
      createInput.endedAt = endedAt.value;
    }

    const session = await sessionService.createSession(createInput);

    await createAuditLog({
      userId: authUser.userId,
      action: "mwd_session.create",
      details: `Created session ${session.sessionCode}`,
      metadata: {
        sessionId: session.id,
        sessionCode: session.sessionCode,
        ownerUserId: session.userId,
      },
    });

    res.status(201).json(session);
  } catch (error: unknown) {
    return handleSessionWriteError(error, res);
  }
};

export const getAllSessions = async (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthenticatedRequest).user;

    if (!authUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const sessions = await sessionService.getAllSessions(
      canViewAllSessions(authUser.roleName) ? undefined : authUser.userId,
    );

    res.json(sessions);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};

export const getSessionById = async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    const id = typeof idParam === "string" ? parsePositiveInt(idParam) : null;

    if (id === null) {
      return res.status(400).json({ message: "Invalid session id" });
    }

    const session = await sessionService.getSessionById(id);

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    if (!canAccessSession(req, session.userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    res.json(session);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};

export const updateSession = async (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthenticatedRequest).user;
    const idParam = req.params.id;
    const id = typeof idParam === "string" ? parsePositiveInt(idParam) : null;

    if (!authUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!canModifyMonitoringData(authUser.roleName)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (id === null) {
      return res.status(400).json({ message: "Invalid session id" });
    }

    const existingSession = await sessionService.getSessionById(id);

    if (!existingSession) {
      return res.status(404).json({ message: "Session not found" });
    }

    if (!canAccessSession(req, existingSession.userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updates: {
      userId?: number;
      sessionCode?: string;
      company?: string | null;
      wellName?: string | null;
      wellId?: string | null;
      rigName?: string | null;
      fieldName?: string | null;
      jobNumber?: string | null;
      province?: string | null;
      countyParish?: string | null;
      country?: string | null;
      location?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      notes?: string | null;
      connectionStatusId?: number | null;
      startedAt?: Date;
      endedAt?: Date | null;
    } = {};
    const metadata = collectSessionMetadata(req.body ?? {}, { create: false });

    if ("error" in metadata) {
      return res.status(400).json({ message: metadata.error });
    }

    Object.assign(updates, metadata.data);

    if (req.body?.userId !== undefined) {
      if (!canViewAllSessions(authUser.roleName)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const userId = parsePositiveInt(req.body.userId);

      if (userId === null) {
        return res.status(400).json({ message: "Valid userId is required" });
      }

      updates.userId = userId;
    }

    if (req.body?.sessionCode !== undefined) {
      const sessionCode = normalizeString(req.body.sessionCode);

      if (!sessionCode) {
        return res.status(400).json({ message: "Session code cannot be empty" });
      }

      updates.sessionCode = sessionCode;
    }

    if (req.body?.wellName !== undefined) {
      updates.wellName = normalizeString(req.body.wellName) || null;
    }

    if (req.body?.rigName !== undefined) {
      updates.rigName = normalizeString(req.body.rigName) || null;
    }

    if (req.body?.connectionStatusId !== undefined) {
      if (req.body.connectionStatusId === null) {
        updates.connectionStatusId = null;
      } else {
        const connectionStatusId = parsePositiveInt(req.body.connectionStatusId);

        if (connectionStatusId === null) {
          return res.status(400).json({
            message: "connectionStatusId must be a positive integer",
          });
        }

        updates.connectionStatusId = connectionStatusId;
      }
    }

    if (req.body?.startedAt !== undefined) {
      const startedAt = parseOptionalDate(req.body.startedAt);

      if (startedAt.value === "invalid" || startedAt.value === null) {
        return res.status(400).json({ message: "startedAt must be a valid date" });
      }

      if (startedAt.value instanceof Date) {
        updates.startedAt = startedAt.value;
      }
    }

    if (req.body?.endedAt !== undefined) {
      const endedAt = parseOptionalDate(req.body.endedAt);

      if (endedAt.value === "invalid") {
        return res.status(400).json({ message: "endedAt must be a valid date" });
      }

      if (endedAt.value === null || endedAt.value instanceof Date) {
        updates.endedAt = endedAt.value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const session = await sessionService.updateSession(id, updates);

    await createAuditLog({
      userId: authUser.userId,
      action: "mwd_session.update",
      details: `Updated session ${session.sessionCode}`,
      metadata: {
        sessionId: session.id,
        sessionCode: session.sessionCode,
        updatedFields: Object.keys(updates),
      },
    });

    res.json(session);
  } catch (error: unknown) {
    return handleSessionWriteError(error, res);
  }
};

export const deleteSession = async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    const id = typeof idParam === "string" ? parsePositiveInt(idParam) : null;

    if (id === null) {
      return res.status(400).json({ message: "Invalid session id" });
    }

    const existingSession = await sessionService.getSessionById(id);

    if (!existingSession) {
      return res.status(404).json({ message: "Session not found" });
    }

    if (!canAccessSession(req, existingSession.userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const authUser = (req as AuthenticatedRequest).user;
    const deletedSession = await sessionService.deleteSession(id);

    await createAuditLog({
      userId: authUser?.userId ?? null,
      action: "mwd_session.delete",
      details: `Deleted session ${deletedSession.sessionCode}`,
      metadata: {
        sessionId: deletedSession.id,
        sessionCode: deletedSession.sessionCode,
        ownerUserId: deletedSession.userId,
      },
    });

    res.json({ message: "Session deleted successfully" });
  } catch (error: unknown) {
    return handleSessionWriteError(error, res);
  }
};
