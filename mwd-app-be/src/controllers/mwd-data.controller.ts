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
import { recordConfiguredWitsValues } from "../services/wits-data.service.js";
import {
  buildDepthTrackingInputFromMwdSource,
  updateDepthTrackingState,
} from "../services/depth-tracking.service.js";
import { createAuditLog } from "../services/audit-log.service.js";
import { broadcastMWDData } from "../services/websocket.service.js";

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

type CsvImportRecord = {
  sessionId: number;
  measuredAt?: string;
  depthMd?: number;
  wits: Record<string, string | number>;
  sourceRows: number[];
};

const normalizeCsvHeader = (value: string) =>
  value.trim().replace(/^\uFEFF/, "").toLowerCase().replace(/[^a-z0-9]/g, "");

const normalizeCsvWitsId = (value: string) => {
  const trimmed = value.trim();
  const witsMatch = trimmed.match(/^(?:wits)?0*(\d{1,4})$/i);

  if (!witsMatch?.[1]) return null;
  return witsMatch[1].padStart(4, "0");
};

const parseCsvText = (csvText: string) => {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field.trim());
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(field.trim());
      if (row.some((cell) => cell !== "")) {
        rows.push(row);
      }
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field !== "" || row.length > 0) {
    row.push(field.trim());
    if (row.some((cell) => cell !== "")) {
      rows.push(row);
    }
  }

  return rows;
};

const findCsvColumn = (
  normalizedHeaders: string[],
  aliases: string[],
) => {
  const aliasSet = new Set(aliases);
  const index = normalizedHeaders.findIndex((header) => aliasSet.has(header));
  return index >= 0 ? index : null;
};

const getCsvCell = (row: string[], columnIndex: number | null) =>
  columnIndex === null ? "" : (row[columnIndex] ?? "").trim();

const parseOptionalCsvNumber = (value: string, label: string, rowNumber: number) => {
  if (!value) return undefined;
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a valid number at CSV row ${rowNumber}`);
  }

  return parsed;
};

const getCsvTextFromRequestBody = (body: unknown) => {
  if (typeof body === "string") return body;

  if (body && typeof body === "object" && !Array.isArray(body)) {
    const record = body as Record<string, unknown>;
    const csvValue = record.csv ?? record.text ?? record.data ?? record.raw;

    if (typeof csvValue === "string") return csvValue;
  }

  return "";
};

const makeCsvImportGroupKey = (
  sessionId: number,
  measuredAt: string | undefined,
  depthMd: number | undefined,
) => `${sessionId}|${measuredAt ?? ""}|${depthMd ?? ""}`;

const parseCsvImportRecords = (
  csvText: string,
  fallbackSessionId: number | null,
) => {
  const rows = parseCsvText(csvText);

  if (rows.length < 2) {
    throw new Error("CSV must include a header row and at least one data row");
  }

  const headers = rows[0] ?? [];
  const normalizedHeaders = headers.map(normalizeCsvHeader);
  const sessionIdColumn = findCsvColumn(normalizedHeaders, [
    "sessionid",
    "mwdsessionid",
    "session",
  ]);
  const measuredAtColumn = findCsvColumn(normalizedHeaders, [
    "measuredat",
    "timestamp",
    "time",
    "datetime",
    "date",
  ]);
  const depthColumn = findCsvColumn(normalizedHeaders, [
    "depthmd",
    "md",
    "depth",
    "measureddepth",
    "bitdepth",
  ]);
  const witsIdColumn = findCsvColumn(normalizedHeaders, [
    "witsid",
    "wits",
    "channel",
    "channelid",
    "id",
  ]);
  const valueColumn = findCsvColumn(normalizedHeaders, [
    "value",
    "rawvalue",
    "raw",
    "reading",
  ]);
  const wideWitsColumns = normalizedHeaders
    .map((header, index) => ({
      index,
      witsId: normalizeCsvWitsId(headers[index] ?? header),
    }))
    .filter((column): column is { index: number; witsId: string } =>
      Boolean(column.witsId),
    );

  const isLongFormat = witsIdColumn !== null && valueColumn !== null;

  if (!isLongFormat && wideWitsColumns.length === 0) {
    throw new Error(
      "CSV must include either witsId/value columns or WITS ID columns like 0715, 0824",
    );
  }

  const groupedRecords = new Map<string, CsvImportRecord>();

  rows.slice(1).forEach((row, rowIndex) => {
    const csvRowNumber = rowIndex + 2;
    const sessionId =
      parsePositiveInt(getCsvCell(row, sessionIdColumn)) ?? fallbackSessionId;

    if (sessionId === null) {
      throw new Error(`Valid sessionId is required at CSV row ${csvRowNumber}`);
    }

    const measuredAt = getCsvCell(row, measuredAtColumn) || undefined;
    const depthMd = parseOptionalCsvNumber(
      getCsvCell(row, depthColumn),
      "depthMd",
      csvRowNumber,
    );
    const groupKey = makeCsvImportGroupKey(sessionId, measuredAt, depthMd);
    const existing = groupedRecords.get(groupKey);
    const record =
      existing ??
      {
        sessionId,
        ...(measuredAt ? { measuredAt } : {}),
        ...(depthMd !== undefined ? { depthMd } : {}),
        wits: {},
        sourceRows: [],
      };

    if (isLongFormat) {
      const witsId = normalizeCsvWitsId(getCsvCell(row, witsIdColumn));
      const value = getCsvCell(row, valueColumn);

      if (!witsId) {
        throw new Error(`Valid witsId is required at CSV row ${csvRowNumber}`);
      }
      if (!value) {
        throw new Error(`value is required at CSV row ${csvRowNumber}`);
      }

      record.wits[witsId] = value;
    } else {
      for (const column of wideWitsColumns) {
        const value = getCsvCell(row, column.index);
        if (value) {
          record.wits[column.witsId] = value;
        }
      }
    }

    if (Object.keys(record.wits).length === 0) {
      throw new Error(`At least one WITS value is required at CSV row ${csvRowNumber}`);
    }

    record.sourceRows.push(csvRowNumber);
    groupedRecords.set(groupKey, record);
  });

  return Array.from(groupedRecords.values());
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
    const witsInfo = await recordConfiguredWitsValues({
      sessionId,
      measuredAt: syncedMeasuredAt,
      depthMd: measurementResult.parsedFields.depthMd.value ?? null,
      source: req.body ?? {},
    });
    const depthTrackingInfo = await updateDepthTrackingState(
      buildDepthTrackingInputFromMwdSource({
        sessionId,
        measuredAt: syncedMeasuredAt,
        source: req.body ?? {},
      }),
    );

    await createAuditLog({
      userId: authUser.userId,
      action: "mwd_data.create",
      details: `Created MWD data for session ${sessionId}`,
      metadata: {
        mwdDataId: data.id.toString(),
        sessionId,
        depthMd: data.depthMd?.toString() ?? null,
        measuredAt: data.measuredAt.toISOString(),
      },
    });

    broadcastMWDData(data);

    res.status(201).json({
      ...data,
      syncInfo,
      depthTrackingInfo,
      witsInfo: {
        configuredCount: witsInfo.configuredCount,
        loggedCount: witsInfo.loggedCount,
        alarmCount: witsInfo.alarmCount,
        skippedInvalid: witsInfo.skippedInvalid,
        outputQueuedCount: witsInfo.outputQueuedCount,
        outputSkippedCount: witsInfo.outputSkippedCount,
      },
    });
  } catch (error: unknown) {
    return handleMWDDataWriteError(error, res);
  }
};

export const importMWDDataCsv = async (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthenticatedRequest).user;

    if (!authUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!canModifyMonitoringData(authUser.roleName)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const fallbackSessionId =
      parsePositiveInt(req.query.sessionId) ??
      parsePositiveInt(
        typeof req.body === "object" && req.body !== null && !Array.isArray(req.body)
          ? (req.body as Record<string, unknown>).sessionId
          : undefined,
      );
    const csvText = getCsvTextFromRequestBody(req.body);

    if (!csvText.trim()) {
      return res.status(400).json({
        message: "CSV content is required. Send text/csv body or JSON { csv }.",
      });
    }

    const importRecords = parseCsvImportRecords(csvText, fallbackSessionId);
    const sessionCache = new Map<number, Awaited<ReturnType<typeof sessionService.getSessionById>>>();
    const createdItems = [];
    let loggedWitsValueCount = 0;
    let alarmCount = 0;
    let outputQueuedCount = 0;

    for (const importRecord of importRecords) {
      let session = sessionCache.get(importRecord.sessionId);

      if (session === undefined) {
        session = await sessionService.getSessionById(importRecord.sessionId);
        sessionCache.set(importRecord.sessionId, session);
      }

      if (!session) {
        return res.status(404).json({
          message: `Session ${importRecord.sessionId} not found`,
        });
      }

      if (!canAccessSession(req, session.userId)) {
        return res.status(403).json({
          message: `Forbidden for session ${importRecord.sessionId}`,
        });
      }

      const measuredAt = parseOptionalDateInput(importRecord.measuredAt);

      if (measuredAt === "invalid") {
        return res.status(400).json({
          message: `measuredAt must be a valid date for CSV rows ${importRecord.sourceRows.join(", ")}`,
        });
      }

      const source = {
        sessionId: importRecord.sessionId,
        ...(importRecord.measuredAt ? { measuredAt: importRecord.measuredAt } : {}),
        ...(importRecord.depthMd !== undefined ? { depthMd: importRecord.depthMd } : {}),
        wits: importRecord.wits,
      };
      const measurementResult = parseMeasurementFields(source);

      if ("error" in measurementResult) {
        return res.status(400).json({
          message: `${measurementResult.error} for CSV rows ${importRecord.sourceRows.join(", ")}`,
        });
      }

      const { measuredAt: syncedMeasuredAt, syncInfo } =
        await syncTimestampAndDepth({
          sessionId: importRecord.sessionId,
          ...(measuredAt !== undefined ? { measuredAt } : {}),
          depthMd: measurementResult.parsedFields.depthMd.value ?? null,
        });

      const input: {
        sessionId: number;
        measuredAt: Date;
      } & MWDMeasurementInput = {
        sessionId: importRecord.sessionId,
        measuredAt: syncedMeasuredAt,
      };

      applyMeasurementFields(input, measurementResult.parsedFields);

      const data = await mwdDataService.createMWDData(input);
      const witsInfo = await recordConfiguredWitsValues({
        sessionId: importRecord.sessionId,
        measuredAt: syncedMeasuredAt,
        depthMd: measurementResult.parsedFields.depthMd.value ?? null,
        source,
      });
      const depthTrackingInfo = await updateDepthTrackingState(
        buildDepthTrackingInputFromMwdSource({
          sessionId: importRecord.sessionId,
          measuredAt: syncedMeasuredAt,
          source,
        }),
      );

      loggedWitsValueCount += witsInfo.loggedCount;
      alarmCount += witsInfo.alarmCount;
      outputQueuedCount += witsInfo.outputQueuedCount;

      createdItems.push({
        ...data,
        sourceRows: importRecord.sourceRows,
        syncInfo,
        depthTrackingInfo,
        witsInfo: {
          configuredCount: witsInfo.configuredCount,
          loggedCount: witsInfo.loggedCount,
          alarmCount: witsInfo.alarmCount,
          skippedInvalid: witsInfo.skippedInvalid,
          outputQueuedCount: witsInfo.outputQueuedCount,
          outputSkippedCount: witsInfo.outputSkippedCount,
        },
      });
    }

    await createAuditLog({
      userId: authUser.userId,
      action: "mwd_data.import_csv",
      details: `Imported ${createdItems.length} MWD data rows from CSV`,
      metadata: {
        importedRows: createdItems.length,
        csvDataRows: parseCsvText(csvText).length - 1,
        sessions: Array.from(sessionCache.keys()),
        loggedWitsValueCount,
        alarmCount,
        outputQueuedCount,
      },
    });

    res.status(201).json({
      message: "CSV imported successfully",
      count: createdItems.length,
      loggedWitsValueCount,
      alarmCount,
      outputQueuedCount,
      data: createdItems,
    });
  } catch (error: unknown) {
    return handleMWDDataWriteError(error, res);
  }
};

export const getAllMWDData = async (req: Request, res: Response) => {
  try {
    const sessionIdParam = req.query.sessionId;
    const sessionId =
      typeof sessionIdParam === "string" ? parsePositiveInt(sessionIdParam) : null;
    const includeHidden =
      req.query.includeHidden === "true" || req.query.includeHidden === "1";

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
    const allData = await mwdDataService.getAllMWDData(sessionId ?? undefined, {
      includeHidden,
    });

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

    await createAuditLog({
      userId: authUser.userId,
      action: "mwd_data.update",
      details: `Updated MWD data ${id.toString()}`,
      metadata: {
        mwdDataId: id.toString(),
        sessionId: data.sessionId,
        updatedFields: Object.keys(updates),
      },
    });

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

    const deletedData = await mwdDataService.deleteMWDData(id);
    const authUser = (req as AuthenticatedRequest).user;

    await createAuditLog({
      userId: authUser?.userId ?? null,
      action: "mwd_data.delete",
      details: `Deleted MWD data ${id.toString()}`,
      metadata: {
        mwdDataId: id.toString(),
        sessionId: deletedData.sessionId,
        depthMd: deletedData.depthMd?.toString() ?? null,
      },
    });

    res.json({ message: "MWD data deleted successfully" });
  } catch (error: unknown) {
    return handleMWDDataWriteError(error, res);
  }
};
