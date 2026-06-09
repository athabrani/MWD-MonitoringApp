import type { Request, Response } from "express";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import * as connectionStatusService from "../services/connection-status.service.js";

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

const parseOptionalResponseMs = (value: unknown) => {
  if (value === undefined) {
    return { provided: false as const, value: undefined };
  }

  if (value === null || value === "") {
    return { provided: true as const, value: null };
  }

  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return { provided: true as const, value };
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0
      ? { provided: true as const, value: parsed }
      : { provided: true as const, value: "invalid" as const };
  }

  return { provided: true as const, value: "invalid" as const };
};

const handleConnectionStatusWriteError = (error: unknown, res: Response) => {
  if (
    error instanceof PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    return res.status(404).json({ message: "Connection status not found" });
  }

  const message =
    error instanceof Error ? error.message : "Internal server error";
  return res.status(500).json({ message });
};

export const createConnectionStatus = async (req: Request, res: Response) => {
  try {
    const source = normalizeString(req.body?.source);
    const status = normalizeString(req.body?.status);
    const description = normalizeString(req.body?.description);
    const checkedAt = parseOptionalDate(req.body?.checkedAt);
    const responseMs = parseOptionalResponseMs(req.body?.responseMs);

    if (!source) {
      return res.status(400).json({ message: "Source is required" });
    }

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    if (checkedAt.value === "invalid") {
      return res.status(400).json({ message: "checkedAt must be a valid date" });
    }

    if (responseMs.value === "invalid") {
      return res.status(400).json({ message: "responseMs must be a non-negative integer" });
    }

    const input: {
      source: string;
      status: string;
      description?: string | null;
      checkedAt?: Date;
      responseMs?: number | null;
    } = {
      source,
      status,
      description: description || null,
    };

    if (checkedAt.provided && checkedAt.value instanceof Date) {
      input.checkedAt = checkedAt.value;
    }

    if (responseMs.provided) {
      input.responseMs = responseMs.value ?? null;
    }

    const connectionStatus =
      await connectionStatusService.createConnectionStatus(input);
    res.status(201).json(connectionStatus);
  } catch (error: unknown) {
    return handleConnectionStatusWriteError(error, res);
  }
};

export const getAllConnectionStatuses = async (_req: Request, res: Response) => {
  try {
    const connectionStatuses =
      await connectionStatusService.getAllConnectionStatuses();
    res.json(connectionStatuses);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};

export const getConnectionStatusById = async (req: Request, res: Response) => {
  try {
    const id = parsePositiveInt(req.params.id);

    if (id === null) {
      return res.status(400).json({ message: "Invalid connection status id" });
    }

    const connectionStatus =
      await connectionStatusService.getConnectionStatusById(id);

    if (!connectionStatus) {
      return res.status(404).json({ message: "Connection status not found" });
    }

    res.json(connectionStatus);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};

export const updateConnectionStatus = async (req: Request, res: Response) => {
  try {
    const id = parsePositiveInt(req.params.id);

    if (id === null) {
      return res.status(400).json({ message: "Invalid connection status id" });
    }

    const updates: {
      source?: string;
      status?: string;
      description?: string | null;
      checkedAt?: Date;
      responseMs?: number | null;
    } = {};

    if (req.body?.source !== undefined) {
      const source = normalizeString(req.body.source);

      if (!source) {
        return res.status(400).json({ message: "Source cannot be empty" });
      }

      updates.source = source;
    }

    if (req.body?.status !== undefined) {
      const status = normalizeString(req.body.status);

      if (!status) {
        return res.status(400).json({ message: "Status cannot be empty" });
      }

      updates.status = status;
    }

    if (req.body?.description !== undefined) {
      updates.description = normalizeString(req.body.description) || null;
    }

    if (req.body?.checkedAt !== undefined) {
      const checkedAt = parseOptionalDate(req.body.checkedAt);

      if (checkedAt.value === "invalid" || checkedAt.value === null) {
        return res.status(400).json({ message: "checkedAt must be a valid date" });
      }

      if (checkedAt.value instanceof Date) {
        updates.checkedAt = checkedAt.value;
      }
    }

    if (req.body?.responseMs !== undefined) {
      const responseMs = parseOptionalResponseMs(req.body.responseMs);

      if (responseMs.value === "invalid") {
        return res.status(400).json({
          message: "responseMs must be a non-negative integer",
        });
      }

      updates.responseMs = responseMs.value ?? null;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const connectionStatus =
      await connectionStatusService.updateConnectionStatus(id, updates);
    res.json(connectionStatus);
  } catch (error: unknown) {
    return handleConnectionStatusWriteError(error, res);
  }
};

export const deleteConnectionStatus = async (req: Request, res: Response) => {
  try {
    const id = parsePositiveInt(req.params.id);

    if (id === null) {
      return res.status(400).json({ message: "Invalid connection status id" });
    }

    await connectionStatusService.deleteConnectionStatus(id);
    res.json({ message: "Connection status deleted successfully" });
  } catch (error: unknown) {
    return handleConnectionStatusWriteError(error, res);
  }
};
