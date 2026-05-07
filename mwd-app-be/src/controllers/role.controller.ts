import type { Request, Response } from "express";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import * as roleService from "../services/role.service.js";
import {
  ALL_SYSTEM_ROLE_NAMES,
  isSystemRoleName,
  normalizeRoleName,
} from "../utils/roles.js";

const parseRoleId = (idParam: string) => {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export const createRole = async (req: Request, res: Response) => {
  try {
    const name = req.body?.name;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }

    const normalizedName = normalizeRoleName(name);

    if (!isSystemRoleName(normalizedName)) {
      return res.status(400).json({
        message: `Role must be one of: ${ALL_SYSTEM_ROLE_NAMES.join(", ")}`,
      });
    }

    const role = await roleService.createRole(normalizedName);
    res.status(201).json(role);
  } catch (error: unknown) {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({ message: "Role name already exists" });
    }

    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};

export const getAllRoles = async (_req: Request, res: Response) => {
  try {
    const roles = (await roleService.getAllRoles()).filter((role) =>
      isSystemRoleName(role.name),
    );
    res.json(roles);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getRoleById = async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    const id = typeof idParam === "string" ? parseRoleId(idParam) : null;

    if (id === null) {
      return res.status(400).json({ message: "Invalid role id" });
    }

    const role = await roleService.getRoleById(id);

    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    res.json(role);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};

export const updateRole = async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    const id = typeof idParam === "string" ? parseRoleId(idParam) : null;
    const name = req.body?.name;

    if (id === null) {
      return res.status(400).json({ message: "Invalid role id" });
    }

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }

    const normalizedName = normalizeRoleName(name);

    if (!isSystemRoleName(normalizedName)) {
      return res.status(400).json({
        message: `Role must be one of: ${ALL_SYSTEM_ROLE_NAMES.join(", ")}`,
      });
    }

    const role = await roleService.updateRole(id, normalizedName);
    res.json(role);
  } catch (error: unknown) {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({ message: "Role name already exists" });
    }

    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return res.status(404).json({ message: "Role not found" });
    }

    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};

export const deleteRole = async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    const id = typeof idParam === "string" ? parseRoleId(idParam) : null;

    if (id === null) {
      return res.status(400).json({ message: "Invalid role id" });
    }

    const role = await roleService.getRoleById(id);

    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    if (isSystemRoleName(role.name)) {
      return res.status(400).json({
        message: "System roles cannot be deleted",
      });
    }

    await roleService.deleteRole(id);

    res.json({ message: "Role deleted successfully" });
  } catch (error: unknown) {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return res.status(404).json({ message: "Role not found" });
    }

    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};
