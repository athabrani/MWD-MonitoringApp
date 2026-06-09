import type { Request, Response } from "express";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import * as plotTemplateService from "../services/plot-template.service.js";
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

const parseOptionalBoolean = (value: unknown) => {
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

  return { provided: true as const, error: "isDefault must be a boolean" };
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const toRecord = (value: unknown): Record<string, unknown> =>
  isRecord(value) ? value : {};

const parseTemplateBody = (
  body: Record<string, unknown>,
  mode: "create" | "update",
) => {
  const data: Record<string, unknown> = {};

  if (mode === "create" || body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return { error: mode === "create" ? "name is required" : "name cannot be empty" };
    }

    data.name = name;
  }

  if (body.description !== undefined) {
    if (body.description === null || body.description === "") {
      data.description = null;
    } else if (typeof body.description === "string") {
      data.description = body.description.trim() || null;
    } else {
      return { error: "description must be a string" };
    }
  }

  if (mode === "create" || body.config !== undefined) {
    if (!isRecord(body.config)) {
      return { error: "config must be an object" };
    }

    data.config = body.config;
  }

  const isDefault = parseOptionalBoolean(body.isDefault);

  if ("error" in isDefault) {
    return { error: isDefault.error };
  }

  if (isDefault.provided) {
    data.isDefault = isDefault.value;
  }

  if (mode === "update" && Object.keys(data).length === 0) {
    return { error: "No valid fields to update" };
  }

  return { data };
};

const handlePlotTemplateError = (error: unknown, res: Response) => {
  if (
    error instanceof PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return res.status(409).json({ message: "Plot template name already exists" });
  }

  if (
    error instanceof PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    return res.status(404).json({ message: "Plot template not found" });
  }

  const message =
    error instanceof Error ? error.message : "Internal server error";
  return res.status(500).json({ message });
};

export const createPlotTemplate = async (req: Request, res: Response) => {
  try {
    const result = parseTemplateBody(req.body ?? {}, "create");

    if ("error" in result) {
      return res.status(400).json({ message: result.error });
    }

    const template = await plotTemplateService.createPlotTemplate(
      result.data as plotTemplateService.PlotTemplateInput,
    );
    const authUser = (req as AuthenticatedRequest).user;
    const templateRecord = toRecord(template);

    await createAuditLog({
      userId: authUser?.userId ?? null,
      action: "plot_template.create",
      details: `Created plot template ${String(templateRecord.name ?? "")}`,
      metadata: {
        plotTemplateId:
          templateRecord.id !== undefined ? String(templateRecord.id) : null,
        name:
          templateRecord.name !== undefined ? String(templateRecord.name) : null,
        isDefault: templateRecord.isDefault ?? null,
      },
    });

    res.status(201).json(template);
  } catch (error: unknown) {
    return handlePlotTemplateError(error, res);
  }
};

export const getAllPlotTemplates = async (_req: Request, res: Response) => {
  try {
    const templates = await plotTemplateService.getAllPlotTemplates();
    res.json({ count: templates.length, data: templates });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};

export const getDefaultPlotTemplate = async (_req: Request, res: Response) => {
  try {
    const template = await plotTemplateService.getDefaultPlotTemplate();

    if (!template) {
      return res.status(404).json({ message: "Default plot template not found" });
    }

    res.json(template);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};

export const getPlotTemplateById = async (req: Request, res: Response) => {
  try {
    const id = parsePositiveInt(req.params.id);

    if (id === null) {
      return res.status(400).json({ message: "Invalid plot template id" });
    }

    const template = await plotTemplateService.getPlotTemplateById(id);

    if (!template) {
      return res.status(404).json({ message: "Plot template not found" });
    }

    res.json(template);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};

export const updatePlotTemplate = async (req: Request, res: Response) => {
  try {
    const id = parsePositiveInt(req.params.id);

    if (id === null) {
      return res.status(400).json({ message: "Invalid plot template id" });
    }

    const result = parseTemplateBody(req.body ?? {}, "update");

    if ("error" in result) {
      return res.status(400).json({ message: result.error });
    }

    const template = await plotTemplateService.updatePlotTemplate(
      id,
      result.data as plotTemplateService.PlotTemplateUpdateInput,
    );
    const authUser = (req as AuthenticatedRequest).user;
    const templateRecord = toRecord(template);

    await createAuditLog({
      userId: authUser?.userId ?? null,
      action: "plot_template.update",
      details: `Updated plot template ${String(templateRecord.name ?? id)}`,
      metadata: {
        plotTemplateId:
          templateRecord.id !== undefined ? String(templateRecord.id) : String(id),
        name:
          templateRecord.name !== undefined ? String(templateRecord.name) : null,
        updatedFields: Object.keys(result.data),
      },
    });

    res.json(template);
  } catch (error: unknown) {
    return handlePlotTemplateError(error, res);
  }
};

export const deletePlotTemplate = async (req: Request, res: Response) => {
  try {
    const id = parsePositiveInt(req.params.id);

    if (id === null) {
      return res.status(400).json({ message: "Invalid plot template id" });
    }

    const template = await plotTemplateService.getPlotTemplateById(id);
    await plotTemplateService.deletePlotTemplate(id);

    const authUser = (req as AuthenticatedRequest).user;
    const templateRecord = toRecord(template);

    await createAuditLog({
      userId: authUser?.userId ?? null,
      action: "plot_template.delete",
      details: `Deleted plot template ${String(templateRecord.name ?? id)}`,
      metadata: {
        plotTemplateId:
          templateRecord.id !== undefined ? String(templateRecord.id) : String(id),
        name:
          templateRecord.name !== undefined ? String(templateRecord.name) : null,
      },
    });

    res.json({ message: "Plot template deleted successfully" });
  } catch (error: unknown) {
    return handlePlotTemplateError(error, res);
  }
};
