import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import * as mwdDataService from "../services/mwd-data.service.js";
import * as sessionService from "../services/mwd-session.service.js";
import {
  applyMeasurementFields,
  parseMeasurementFields,
  type MWDMeasurementInput,
} from "../utils/mwd-measurements.js";
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
        } & MWDMeasurementInput = {
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
