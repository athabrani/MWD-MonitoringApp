import { prisma } from "../lib/prisma.js";
import * as mwdDataService from "./mwd-data.service.js";
import * as sessionService from "./mwd-session.service.js";
import {
  applyMeasurementFields,
  parseMeasurementFields,
  type MWDMeasurementInput,
} from "../utils/mwd-measurements.js";
import { syncTimestampAndDepth } from "../utils/timestamp-depth-sync.js";
import { recordConfiguredWitsValues } from "./wits-data.service.js";

type GatewayPayload = Record<string, unknown>;

export class GatewayIngestError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = "GatewayIngestError";
    this.statusCode = statusCode;
  }
}

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

const normalizeGatewayPayloads = (rawPayload: unknown) => {
  const payloads = Array.isArray(rawPayload) ? rawPayload : [rawPayload];

  if (
    !payloads.length ||
    typeof payloads[0] !== "object" ||
    payloads[0] === null ||
    Array.isArray(payloads[0])
  ) {
    throw new GatewayIngestError(
      "Request body must contain MWD data payload",
      400,
    );
  }

  return payloads as GatewayPayload[];
};

export const ingestGatewayPayloads = async (rawPayload: unknown) => {
  const payloads = normalizeGatewayPayloads(rawPayload);

  return await prisma.$transaction(async (tx) => {
    const items = [];

    for (const [index, payload] of payloads.entries()) {
      const sessionId = parsePositiveInt(payload.sessionId);
      const measuredAt = parseOptionalDateInput(payload.measuredAt);

      if (sessionId === null) {
        throw new GatewayIngestError(
          `Payload at index ${index} has invalid sessionId`,
          400,
        );
      }

      if (measuredAt === "invalid") {
        throw new GatewayIngestError(
          `Payload at index ${index} has invalid measuredAt`,
          400,
        );
      }

      const session = await sessionService.getSessionById(sessionId);

      if (!session) {
        throw new GatewayIngestError(
          `Session not found for payload at index ${index}`,
          404,
        );
      }

      const measurementResult = parseMeasurementFields(payload);

      if ("error" in measurementResult) {
        throw new GatewayIngestError(
          `Payload at index ${index}: ${measurementResult.error}`,
          400,
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
      const witsInfo = await recordConfiguredWitsValues(
        {
          sessionId,
          measuredAt: syncedMeasuredAt,
          depthMd: measurementResult.parsedFields.depthMd.value ?? null,
          source: payload,
        },
        tx,
      );
      items.push({
        ...createdItem,
        syncInfo,
        witsInfo: {
          configuredCount: witsInfo.configuredCount,
          loggedCount: witsInfo.loggedCount,
          alarmCount: witsInfo.alarmCount,
          skippedInvalid: witsInfo.skippedInvalid,
        },
      });
    }

    return items;
  });
};
