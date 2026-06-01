import type { Request, Response } from "express";
import * as rawPacketLogService from "../services/gateway-raw-packet-log.service.js";

const parsePositiveInt = (value: unknown) => {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
};

const parsePositiveBigInt = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const parsed = BigInt(value);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
};

const parseOptionalBoolean = (value: unknown) => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    return "invalid" as const;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return "invalid" as const;
};

const normalizeOptionalString = (value: unknown) => {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
};

export const listGatewayRawPacketLogs = async (
  req: Request,
  res: Response,
) => {
  try {
    const sessionId =
      req.query.sessionId !== undefined
        ? parsePositiveInt(req.query.sessionId)
        : undefined;
    const limit =
      req.query.limit !== undefined
        ? parsePositiveInt(req.query.limit)
        : undefined;
    const beforeId =
      req.query.beforeId !== undefined
        ? parsePositiveBigInt(String(req.query.beforeId))
        : undefined;
    const selectedByFusion = parseOptionalBoolean(req.query.selectedByFusion);
    const ingested = parseOptionalBoolean(req.query.ingested);

    if (req.query.sessionId !== undefined && sessionId === null) {
      return res.status(400).json({ message: "sessionId must be a positive integer" });
    }

    if (req.query.limit !== undefined && limit === null) {
      return res.status(400).json({ message: "limit must be a positive integer" });
    }

    if (req.query.beforeId !== undefined && beforeId === null) {
      return res.status(400).json({ message: "beforeId must be a positive integer" });
    }

    if (selectedByFusion === "invalid") {
      return res.status(400).json({ message: "selectedByFusion must be boolean" });
    }

    if (ingested === "invalid") {
      return res.status(400).json({ message: "ingested must be boolean" });
    }

    const query: rawPacketLogService.ListGatewayRawPacketLogsQuery = {};
    const channel = normalizeOptionalString(req.query.channel);
    const source = normalizeOptionalString(req.query.source);
    const messageType = normalizeOptionalString(req.query.messageType);

    if (sessionId !== undefined && sessionId !== null) query.sessionId = sessionId;
    if (limit !== undefined && limit !== null) query.limit = limit;
    if (beforeId !== undefined && beforeId !== null) query.beforeId = beforeId;
    if (selectedByFusion !== undefined) query.selectedByFusion = selectedByFusion;
    if (ingested !== undefined) query.ingested = ingested;
    if (channel) query.channel = channel;
    if (source) query.source = source;
    if (messageType) query.messageType = messageType;

    const logs = await rawPacketLogService.listGatewayRawPacketLogs(query);

    res.json(logs);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};

export const getGatewayRawPacketLogById = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = parsePositiveBigInt(req.params.id);

    if (id === null) {
      return res.status(400).json({ message: "Invalid raw packet log id" });
    }

    const log = await rawPacketLogService.getGatewayRawPacketLogById(id);

    if (!log) {
      return res.status(404).json({ message: "Raw packet log not found" });
    }

    res.json(log);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};
