import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import * as emailReportService from "../services/email-report.service.js";
import * as sessionService from "../services/mwd-session.service.js";
import {
  canAccessSessionOwner,
  canViewAllSessions,
} from "../utils/roles.js";

type EmailAddressInput = {
  name?: string;
  email: string;
};

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

const parseOptionalBoolean = (value: unknown, fallback = false) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true" || normalized === "1") {
      return true;
    }

    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }

  return null;
};

const parseOptionalString = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return typeof value === "string" ? value.trim() : null;
};

const parseEmailAddressList = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return [] as EmailAddressInput[];
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean)
      .map((email) => ({ email }));
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const addresses: EmailAddressInput[] = [];

  for (const item of value) {
    if (typeof item === "string") {
      const email = item.trim();

      if (email) {
        addresses.push({ email });
      }

      continue;
    }

    if (
      typeof item === "object" &&
      item !== null &&
      !Array.isArray(item) &&
      "email" in item &&
      typeof item.email === "string" &&
      item.email.trim()
    ) {
      const address: EmailAddressInput = {
        email: item.email.trim(),
      };

      if ("name" in item && typeof item.name === "string" && item.name.trim()) {
        address.name = item.name.trim();
      }

      addresses.push(address);
      continue;
    }

    return null;
  }

  return addresses;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

const buildErrorResponse = (error: unknown, res: Response) => {
  const message = error instanceof Error ? error.message : "Internal server error";
  const log =
    typeof error === "object" && error !== null && "log" in error
      ? (error as { log?: unknown }).log
      : undefined;

  return res.status(500).json({
    message,
    ...(log !== undefined ? { log } : {}),
  });
};

export const sendEmailReport = async (req: Request, res: Response) => {
  try {
    const authUser = getAuthUser(req);
    const body = isRecord(req.body) ? req.body : {};
    const sessionId = parsePositiveInt(body.sessionId);
    const to = parseEmailAddressList(body.to);
    const cc = parseEmailAddressList(body.cc);
    const bcc = parseEmailAddressList(body.bcc);
    const subject = parseOptionalString(body.subject);
    const message = parseOptionalString(body.message ?? body.body);
    const dryRun = parseOptionalBoolean(body.dryRun, false);
    const attachments = body.attachments;

    if (!authUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (sessionId === null) {
      return res.status(400).json({ message: "Valid sessionId is required" });
    }

    if (to === null || cc === null || bcc === null) {
      return res.status(400).json({ message: "to/cc/bcc must be strings or arrays" });
    }

    if (to.length === 0) {
      return res.status(400).json({ message: "to must contain at least one recipient" });
    }

    if (subject === null) {
      return res.status(400).json({ message: "subject must be a string" });
    }

    if (message === null) {
      return res.status(400).json({ message: "message must be a string" });
    }

    if (dryRun === null) {
      return res.status(400).json({ message: "dryRun must be true or false" });
    }

    if (attachments !== undefined && !Array.isArray(attachments)) {
      return res.status(400).json({ message: "attachments must be an array" });
    }

    const session = await ensureSessionAccess(req, res, sessionId);

    if (!session) {
      return;
    }

    const result = await emailReportService.sendEmailReport({
      sentById: authUser.userId,
      session,
      to,
      cc,
      bcc,
      subject: subject ?? `MWD Report - ${session.sessionCode}`,
      ...(message !== undefined ? { message } : {}),
      dryRun,
      ...(Array.isArray(attachments) ? { attachmentRequests: attachments } : {}),
      options: body,
    });

    res.json({
      message: dryRun ? "Email report dry run created" : "Email report sent",
      ...result,
    });
  } catch (error: unknown) {
    return buildErrorResponse(error, res);
  }
};

export const sendTestEmail = async (req: Request, res: Response) => {
  try {
    const authUser = getAuthUser(req);
    const body = isRecord(req.body) ? req.body : {};
    const to = parseEmailAddressList(body.to);
    const cc = parseEmailAddressList(body.cc);
    const bcc = parseEmailAddressList(body.bcc);
    const subject = parseOptionalString(body.subject);
    const message = parseOptionalString(body.message ?? body.body);
    const dryRun = parseOptionalBoolean(body.dryRun, false);

    if (!authUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (to === null || cc === null || bcc === null) {
      return res.status(400).json({ message: "to/cc/bcc must be strings or arrays" });
    }

    if (to.length === 0) {
      return res.status(400).json({ message: "to must contain at least one recipient" });
    }

    if (subject === null) {
      return res.status(400).json({ message: "subject must be a string" });
    }

    if (message === null) {
      return res.status(400).json({ message: "message must be a string" });
    }

    if (dryRun === null) {
      return res.status(400).json({ message: "dryRun must be true or false" });
    }

    const result = await emailReportService.sendTestEmail({
      sentById: authUser.userId,
      to,
      cc,
      bcc,
      subject: subject ?? "MWD Monitoring SMTP Test",
      ...(message !== undefined ? { message } : {}),
      dryRun,
      options: body,
    });

    res.json({
      message: dryRun ? "SMTP test dry run created" : "SMTP test email sent",
      ...result,
    });
  } catch (error: unknown) {
    return buildErrorResponse(error, res);
  }
};

export const getEmailReportLogs = async (req: Request, res: Response) => {
  try {
    const authUser = getAuthUser(req);
    const sessionIdParam = req.query.sessionId;
    const statusParam = req.query.status;
    const limitParam = req.query.limit;
    const sessionId =
      typeof sessionIdParam === "string" ? parsePositiveInt(sessionIdParam) : undefined;
    const limit =
      typeof limitParam === "string" ? parsePositiveInt(limitParam) : undefined;
    const status =
      typeof statusParam === "string" && statusParam.trim()
        ? statusParam.trim()
        : undefined;

    if (!authUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (sessionIdParam !== undefined && sessionId === null) {
      return res.status(400).json({ message: "sessionId must be a positive integer" });
    }

    if (limitParam !== undefined && limit === null) {
      return res.status(400).json({ message: "limit must be a positive integer" });
    }

    if (sessionId !== undefined && sessionId !== null) {
      const session = await ensureSessionAccess(req, res, sessionId);

      if (!session) {
        return;
      }
    }

    const logs = await emailReportService.getEmailReportLogs({
      ...(sessionId !== undefined && sessionId !== null ? { sessionId } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(limit !== undefined && limit !== null ? { limit } : {}),
    });
    const filteredLogs =
      authUser && canViewAllSessions(authUser.roleName)
        ? logs
        : logs.filter((log) => {
            const session = log.session;
            return (
              typeof session === "object" &&
              session !== null &&
              "userId" in session &&
              session.userId === authUser.userId
            );
          });

    res.json({ count: filteredLogs.length, data: filteredLogs });
  } catch (error: unknown) {
    return buildErrorResponse(error, res);
  }
};
