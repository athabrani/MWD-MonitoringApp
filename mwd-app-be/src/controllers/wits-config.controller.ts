import type { Request, Response } from "express";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import {
  MWD_MEASUREMENT_FIELDS,
  normalizeWitsId,
} from "../utils/mwd-measurements.js";
import * as witsConfigService from "../services/wits-config.service.js";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { createAuditLog } from "../services/audit-log.service.js";

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

const toRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};

const parseBoolean = (value: unknown, fieldName: string) => {
  if (value === undefined) {
    return { provided: false as const, value: undefined };
  }

  if (typeof value === "boolean") {
    return { provided: true as const, value };
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true") {
      return { provided: true as const, value: true };
    }

    if (normalized === "false") {
      return { provided: true as const, value: false };
    }
  }

  return {
    provided: true as const,
    error: `${fieldName} must be a boolean`,
  };
};

const parseOptionalText = (value: unknown, fieldName: string) => {
  if (value === undefined) {
    return { provided: false as const, value: undefined };
  }

  if (value === null || value === "") {
    return { provided: true as const, value: null };
  }

  if (typeof value !== "string") {
    return {
      provided: true as const,
      error: `${fieldName} must be a string`,
    };
  }

  return { provided: true as const, value: value.trim() || null };
};

const parseOptionalDecimal = (value: unknown, fieldName: string) => {
  if (value === undefined) {
    return { provided: false as const, value: undefined };
  }

  if (value === null || value === "") {
    return { provided: true as const, value: null };
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? { provided: true as const, value }
      : { provided: true as const, error: `${fieldName} must be a valid number` };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    const parsed = Number(trimmed);

    return trimmed && Number.isFinite(parsed)
      ? { provided: true as const, value: trimmed }
      : { provided: true as const, error: `${fieldName} must be a valid number` };
  }

  return {
    provided: true as const,
    error: `${fieldName} must be a valid number`,
  };
};

const parseWitsIdInput = (
  value: unknown,
  fieldName: string,
  required: boolean,
) => {
  if (value === undefined || value === null || value === "") {
    return required
      ? { provided: true as const, error: `${fieldName} is required` }
      : { provided: false as const, value: undefined };
  }

  const witsId = normalizeWitsId(value);

  if (!witsId || !/^\d{4}$/.test(witsId)) {
    return {
      provided: true as const,
      error: `${fieldName} must be a 4 digit WITS ID`,
    };
  }

  return { provided: true as const, value: witsId };
};

const getBodyValue = (
  body: Record<string, unknown>,
  fieldNames: readonly string[],
) => {
  for (const fieldName of fieldNames) {
    if (Object.prototype.hasOwnProperty.call(body, fieldName)) {
      return body[fieldName];
    }
  }

  return undefined;
};

const buildWitsConfigInput = (
  body: Record<string, unknown>,
  mode: "create" | "update",
) => {
  const data: Record<string, unknown> = {};
  const witsId = parseWitsIdInput(
    getBodyValue(body, ["witsId", "witsID", "wits_id"]),
    "witsId",
    mode === "create",
  );

  if ("error" in witsId) {
    return { error: witsId.error };
  }

  if (witsId.provided) {
    data.witsId = witsId.value;
  }

  if (mode === "create") {
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return { error: "name is required" };
    }

    data.name = name;
  } else if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return { error: "name cannot be empty" };
    }

    data.name = name;
  }

  const textFields = [
    { target: "units", aliases: ["units"], nullable: true },
    { target: "mappedField", aliases: ["mappedField", "measurementField"], nullable: true },
    { target: "dataSource", aliases: ["dataSource", "dataInput"], nullable: false },
    { target: "lineColor", aliases: ["lineColor"], nullable: true },
    { target: "wrapColor", aliases: ["wrapColor"], nullable: true },
    { target: "depthTrackingMode", aliases: ["depthTrackingMode"], nullable: false },
    { target: "depthTrackingField", aliases: ["depthTrackingField"], nullable: false },
    { target: "lasTag", aliases: ["lasTag"], nullable: true },
    { target: "lasDescription", aliases: ["lasDescription"], nullable: true },
  ] as const;

  for (const field of textFields) {
    const parsed = parseOptionalText(
      getBodyValue(body, field.aliases),
      field.target,
    );

    if ("error" in parsed) {
      return { error: parsed.error };
    }

    if (parsed.provided && !field.nullable && parsed.value === null) {
      return { error: `${field.target} cannot be empty` };
    }

    if (parsed.provided) {
      data[field.target] = parsed.value;
    }
  }

  if (
    typeof data.mappedField === "string" &&
    !MWD_MEASUREMENT_FIELDS.includes(data.mappedField as (typeof MWD_MEASUREMENT_FIELDS)[number])
  ) {
    return {
      error: `mappedField must be one of: ${MWD_MEASUREMENT_FIELDS.join(", ")}`,
    };
  }

  const customDepthWitsId = parseWitsIdInput(
    body.customDepthWitsId,
    "customDepthWitsId",
    false,
  );

  if ("error" in customDepthWitsId) {
    return { error: customDepthWitsId.error };
  }

  if (customDepthWitsId.provided) {
    data.customDepthWitsId = customDepthWitsId.value;
  } else if (body.customDepthWitsId === null || body.customDepthWitsId === "") {
    data.customDepthWitsId = null;
  }

  const decimalFields = [
    { target: "scaleFactor", aliases: ["scaleFactor"] },
    { target: "biasOffset", aliases: ["biasOffset"] },
    { target: "sensorToBitSpacing", aliases: ["sensorToBitSpacing"] },
    { target: "plotScaleLeft", aliases: ["plotScaleLeft", "scaleLeft", "leftScale"] },
    { target: "plotScaleRight", aliases: ["plotScaleRight", "scaleRight", "rightScale"] },
    { target: "alarmMin", aliases: ["alarmMin", "alarmLow"] },
    { target: "alarmMax", aliases: ["alarmMax", "alarmHigh"] },
    { target: "lasFilter", aliases: ["lasFilter"] },
    { target: "dataInputValue", aliases: ["dataInputValue", "inputValue", "value"] },
  ] as const;

  for (const field of decimalFields) {
    const parsed = parseOptionalDecimal(
      getBodyValue(body, field.aliases),
      field.target,
    );

    if ("error" in parsed) {
      return { error: parsed.error };
    }

    if (parsed.provided) {
      data[field.target] = parsed.value;
    }
  }

  if (body.decimalPlaces !== undefined) {
    const decimalPlaces =
      typeof body.decimalPlaces === "number"
        ? body.decimalPlaces
        : typeof body.decimalPlaces === "string"
          ? Number(body.decimalPlaces)
          : NaN;

    if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 8) {
      return { error: "decimalPlaces must be an integer between 0 and 8" };
    }

    data.decimalPlaces = decimalPlaces;
  }

  const booleanFields = [
    { target: "enableLogging", aliases: ["enableLogging", "enableDataLogging"] },
    { target: "alarmEnabled", aliases: ["alarmEnabled", "enableAlarm"] },
    { target: "sendToRigWitsPort", aliases: ["sendToRigWitsPort", "sendToRigWITSPort", "sendToRigPort"] },
    { target: "doNotRepeat", aliases: ["doNotRepeat"] },
  ] as const;

  for (const field of booleanFields) {
    const parsed = parseBoolean(
      getBodyValue(body, field.aliases),
      field.target,
    );

    if ("error" in parsed) {
      return { error: parsed.error };
    }

    if (parsed.provided) {
      data[field.target] = parsed.value;
    }
  }

  if (mode === "update" && Object.keys(data).length === 0) {
    return { error: "No valid fields to update" };
  }

  return { data };
};

const handleWitsConfigError = (error: unknown, res: Response) => {
  if (
    error instanceof PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return res.status(409).json({ message: "WITS ID already exists" });
  }

  if (
    error instanceof PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    return res.status(404).json({ message: "WITS config not found" });
  }

  const message =
    error instanceof Error ? error.message : "Internal server error";
  return res.status(500).json({ message });
};

export const createWitsConfig = async (req: Request, res: Response) => {
  try {
    const result = buildWitsConfigInput(req.body ?? {}, "create");

    if ("error" in result) {
      return res.status(400).json({ message: result.error });
    }

    const config = await witsConfigService.createWitsConfig(
      result.data as witsConfigService.WitsConfigInput,
    );

    const authUser = (req as AuthenticatedRequest).user;
    const configRecord = toRecord(config);
    await createAuditLog({
      userId: authUser?.userId ?? null,
      action: "wits_config.create",
      details: `Created WITS config ${String(configRecord.witsId ?? "")}`,
      metadata: {
        witsConfigId:
          configRecord.id !== undefined ? String(configRecord.id) : null,
        witsId:
          configRecord.witsId !== undefined
            ? String(configRecord.witsId)
            : null,
        mappedField:
          configRecord.mappedField !== undefined
            ? String(configRecord.mappedField)
            : null,
      },
    });

    res.status(201).json(config);
  } catch (error: unknown) {
    return handleWitsConfigError(error, res);
  }
};

export const getAllWitsConfigs = async (req: Request, res: Response) => {
  try {
    const includeDisabled =
      req.query.includeDisabled === "true" || req.query.includeDisabled === "1";
    const configs = await witsConfigService.getAllWitsConfigs({
      includeDisabled,
    });

    res.json({
      count: configs.length,
      data: configs,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};

export const getWitsConfigById = async (req: Request, res: Response) => {
  try {
    const id = parsePositiveInt(req.params.id);

    if (id === null) {
      return res.status(400).json({ message: "Invalid WITS config id" });
    }

    const config = await witsConfigService.getWitsConfigById(id);

    if (!config) {
      return res.status(404).json({ message: "WITS config not found" });
    }

    res.json(config);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};

export const updateWitsConfig = async (req: Request, res: Response) => {
  try {
    const id = parsePositiveInt(req.params.id);

    if (id === null) {
      return res.status(400).json({ message: "Invalid WITS config id" });
    }

    const result = buildWitsConfigInput(req.body ?? {}, "update");

    if ("error" in result) {
      return res.status(400).json({ message: result.error });
    }

    const config = await witsConfigService.updateWitsConfig(
      id,
      result.data as witsConfigService.WitsConfigUpdateInput,
    );

    const authUser = (req as AuthenticatedRequest).user;
    const configRecord = toRecord(config);
    await createAuditLog({
      userId: authUser?.userId ?? null,
      action: "wits_config.update",
      details: `Updated WITS config ${String(configRecord.witsId ?? id)}`,
      metadata: {
        witsConfigId:
          configRecord.id !== undefined ? String(configRecord.id) : String(id),
        witsId:
          configRecord.witsId !== undefined
            ? String(configRecord.witsId)
            : null,
        updatedFields: Object.keys(result.data),
      },
    });

    res.json(config);
  } catch (error: unknown) {
    return handleWitsConfigError(error, res);
  }
};

export const deleteWitsConfig = async (req: Request, res: Response) => {
  try {
    const id = parsePositiveInt(req.params.id);

    if (id === null) {
      return res.status(400).json({ message: "Invalid WITS config id" });
    }

    const deletedConfig = await witsConfigService.deleteWitsConfig(id);
    const authUser = (req as AuthenticatedRequest).user;
    const deletedConfigRecord = toRecord(deletedConfig);

    await createAuditLog({
      userId: authUser?.userId ?? null,
      action: "wits_config.delete",
      details: `Deleted WITS config ${String(deletedConfigRecord.witsId ?? id)}`,
      metadata: {
        witsConfigId:
          deletedConfigRecord.id !== undefined
            ? String(deletedConfigRecord.id)
            : String(id),
        witsId:
          deletedConfigRecord.witsId !== undefined
            ? String(deletedConfigRecord.witsId)
            : null,
      },
    });

    res.json({ message: "WITS config deleted successfully" });
  } catch (error: unknown) {
    return handleWitsConfigError(error, res);
  }
};
