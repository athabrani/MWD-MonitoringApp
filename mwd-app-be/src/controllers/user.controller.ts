import type { Request, Response } from "express";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { createAuditLog } from "../services/audit-log.service.js";
import * as userService from "../services/user.service.js";

const parseUserId = (idParam: string) => {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const parseRoleId = (value: unknown) => {
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

const validatePassword = (password: string) => {
  if (password.length < 8) {
    return "Password must be at least 8 characters";
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Password must contain letters and numbers";
  }

  return null;
};

const handleUserWriteError = (error: unknown, res: Response) => {
  if (
    error instanceof PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return res
      .status(409)
      .json({ message: "Username or email already exists" });
  }

  if (
    error instanceof PrismaClientKnownRequestError &&
    error.code === "P2003"
  ) {
    return res.status(400).json({ message: "Role not found" });
  }

  if (
    error instanceof PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    return res.status(404).json({ message: "User not found" });
  }

  const message =
    error instanceof Error ? error.message : "Internal server error";
  return res.status(500).json({ message });
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const roleId = parseRoleId(req.body?.roleId);
    const username = normalizeString(req.body?.username);
    const email = normalizeString(req.body?.email).toLowerCase();
    const password = normalizeString(req.body?.password);
    const isActive =
      typeof req.body?.isActive === "boolean" ? req.body.isActive : true;

    if (roleId === null) {
      return res.status(400).json({ message: "Valid roleId is required" });
    }

    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    const passwordError = validatePassword(password);

    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const user = await userService.createUser({
      roleId,
      username,
      email,
      password,
      isActive,
    });

    const authUser = (req as AuthenticatedRequest).user;
    await createAuditLog({
      userId: authUser?.userId ?? null,
      action: "user.create",
      details: `Created user ${user.username}`,
      metadata: {
        targetUserId: user.id,
        roleId: user.roleId,
        isActive: user.isActive,
      },
    });

    res.status(201).json(user);
  } catch (error: unknown) {
    return handleUserWriteError(error, res);
  }
};

export const getAllUsers = async (_req: Request, res: Response) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    const id = typeof idParam === "string" ? parseUserId(idParam) : null;

    if (id === null) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const user = await userService.getUserById(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    const id = typeof idParam === "string" ? parseUserId(idParam) : null;

    if (id === null) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const updates: {
      roleId?: number;
      username?: string;
      email?: string;
      password?: string;
      isActive?: boolean;
    } = {};

    if (req.body?.roleId !== undefined) {
      const roleId = parseRoleId(req.body.roleId);

      if (roleId === null) {
        return res.status(400).json({ message: "Valid roleId is required" });
      }

      updates.roleId = roleId;
    }

    if (req.body?.username !== undefined) {
      const username = normalizeString(req.body.username);

      if (!username) {
        return res.status(400).json({ message: "Username cannot be empty" });
      }

      updates.username = username;
    }

    if (req.body?.email !== undefined) {
      const email = normalizeString(req.body.email).toLowerCase();

      if (!email) {
        return res.status(400).json({ message: "Email cannot be empty" });
      }

      updates.email = email;
    }

    if (req.body?.password !== undefined) {
      const password = normalizeString(req.body.password);

      if (!password) {
        return res.status(400).json({ message: "Password cannot be empty" });
      }

      const passwordError = validatePassword(password);

      if (passwordError) {
        return res.status(400).json({ message: passwordError });
      }

      updates.password = password;
    }

    if (req.body?.isActive !== undefined) {
      if (typeof req.body.isActive !== "boolean") {
        return res.status(400).json({ message: "isActive must be a boolean" });
      }

      updates.isActive = req.body.isActive;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const user = await userService.updateUser(id, updates);
    const authUser = (req as AuthenticatedRequest).user;

    await createAuditLog({
      userId: authUser?.userId ?? null,
      action: "user.update",
      details: `Updated user ${user.username}`,
      metadata: {
        targetUserId: user.id,
        updatedFields: Object.keys(updates).filter((fieldName) => fieldName !== "password"),
        passwordUpdated: updates.password !== undefined,
      },
    });

    res.json(user);
  } catch (error: unknown) {
    return handleUserWriteError(error, res);
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    const id = typeof idParam === "string" ? parseUserId(idParam) : null;

    if (id === null) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const deletedUser = await userService.deleteUser(id);
    const authUser = (req as AuthenticatedRequest).user;

    await createAuditLog({
      userId: authUser?.userId ?? null,
      action: "user.delete",
      details: `Deleted user ${deletedUser.username}`,
      metadata: {
        targetUserId: deletedUser.id,
        roleId: deletedUser.roleId,
      },
    });

    res.json({ message: "User deleted successfully" });
  } catch (error: unknown) {
    return handleUserWriteError(error, res);
  }
};
