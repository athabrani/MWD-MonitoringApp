import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import * as historicalDataService from "../services/historical-data.service.js";
import * as sessionService from "../services/mwd-session.service.js";
import * as exportRecordService from "../services/export-record.service.js";
import {
  buildExportFileName,
  serializeHistoricalDataAsCsv,
  serializeHistoricalDataAsJson,
} from "../services/export.service.js";

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

const parsePositiveNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
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

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? ("invalid" as const) : date;
};

export const exportHistoricalData = async (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthenticatedRequest).user;

    if (!authUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const sessionId = parsePositiveInt(req.body?.sessionId);
    const format = req.body?.format;
    const measuredFrom = parseOptionalDate(req.body?.measuredFrom);
    const measuredTo = parseOptionalDate(req.body?.measuredTo);
    const depthMin = parsePositiveNumber(req.body?.depthMin);
    const depthMax = parsePositiveNumber(req.body?.depthMax);

    if (sessionId === null) {
      return res.status(400).json({ message: "Valid sessionId is required" });
    }

    if (format !== "json" && format !== "csv") {
      return res.status(400).json({ message: "Format must be either json or csv" });
    }

    if (measuredFrom === "invalid") {
      return res.status(400).json({ message: "measuredFrom must be a valid date" });
    }

    if (measuredTo === "invalid") {
      return res.status(400).json({ message: "measuredTo must be a valid date" });
    }

    if (req.body?.depthMin !== undefined && depthMin === null) {
      return res.status(400).json({ message: "depthMin must be a non-negative number" });
    }

    if (req.body?.depthMax !== undefined && depthMax === null) {
      return res.status(400).json({ message: "depthMax must be a non-negative number" });
    }

    const session = await sessionService.getSessionById(sessionId);

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    const historicalQuery: {
      sessionId: number;
      measuredFrom?: Date;
      measuredTo?: Date;
      depthMin?: number;
      depthMax?: number;
    } = {
      sessionId,
    };

    if (measuredFrom !== undefined) {
      historicalQuery.measuredFrom = measuredFrom;
    }

    if (measuredTo !== undefined) {
      historicalQuery.measuredTo = measuredTo;
    }

    if (depthMin !== null) {
      historicalQuery.depthMin = depthMin;
    }

    if (depthMax !== null) {
      historicalQuery.depthMax = depthMax;
    }

    const historicalData = await historicalDataService.getHistoricalData(
      historicalQuery,
    );

    const fileName = buildExportFileName(session.sessionCode, format);
    const body =
      format === "json"
        ? serializeHistoricalDataAsJson(historicalData.data)
        : serializeHistoricalDataAsCsv(historicalData.data);

    await exportRecordService.createExportRecord({
      sessionId,
      exportedById: authUser.userId,
      fileName,
      fileType: format,
      rowCount: historicalData.count,
    });

    res.setHeader(
      "Content-Type",
      format === "json" ? "application/json; charset=utf-8" : "text/csv; charset=utf-8",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.status(200).send(body);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};

export const getExportRecords = async (_req: Request, res: Response) => {
  try {
    const records = await exportRecordService.getAllExportRecords();
    res.json(records);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};
