import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
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

type GatewayPayload = Record<string, unknown>;

export const ingestMWDData = async (req: Request, res: Response) => {
  try {
    const rawPayload = req.body?.data ?? req.body;
    const payloads: GatewayPayload[] = Array.isArray(rawPayload)
      ? rawPayload
      : [rawPayload];

    if (!payloads.length || typeof payloads[0] !== "object" || payloads[0] === null) {
      return res.status(400).json({ message: "Request body must contain MWD data payload" });
    }

    const createdItems = await prisma.$transaction(async (tx) => {
      const items = [];

      for (const [index, payload] of payloads.entries()) {
        const sessionId = parsePositiveInt(payload.sessionId);
        const measuredAt = parseOptionalDateInput(payload.measuredAt);

        if (sessionId === null) {
          throw new Error(`Payload at index ${index} has invalid sessionId`);
        }

        if (measuredAt === "invalid") {
          throw new Error(`Payload at index ${index} has invalid measuredAt`);
        }

        const session = await sessionService.getSessionById(sessionId);

        if (!session) {
          throw new Error(`Session not found for payload at index ${index}`);
        }

        const measurementResult = parseMeasurementFields(payload);

        if ("error" in measurementResult) {
          throw new Error(
            `Payload at index ${index}: ${measurementResult.error}`,
          );
        }

        const { measuredAt: syncedMeasuredAt, syncInfo } =
          await syncTimestampAndDepth(
            {
              sessionId,
              ...(measuredAt !== undefined ? { measuredAt } : {}),
              depthMd: measurementResult.parsedFields.depthMd.value ?? null,
            },
            tx,
          );

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

        const createdItem = await mwdDataService.createMWDData(input, tx);
        items.push({ ...createdItem, syncInfo });
      }

      return items;
    });

    res.status(201).json({
      message: "MWD data ingested successfully",
      count: createdItems.length,
      data: createdItems,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";

    if (
      message.includes("Payload at index") ||
      message.includes("Session not found")
    ) {
      const statusCode = message.includes("Session not found") ? 404 : 400;
      return res.status(statusCode).json({ message });
    }

    res.status(500).json({ message });
  }
};
