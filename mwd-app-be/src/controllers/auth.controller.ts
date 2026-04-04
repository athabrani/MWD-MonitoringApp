import type { Request, Response } from "express";
import * as authService from "../services/auth.service.js";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";

const normalizeString = (value: unknown) => {
  return typeof value === "string" ? value.trim() : "";
};

export const login = async (req: Request, res: Response) => {
  try {
    const identifier = normalizeString(req.body?.identifier);
    const password = normalizeString(req.body?.password);

    if (!identifier) {
      return res.status(400).json({ message: "Identifier is required" });
    }

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    const result = await authService.login(identifier, password);

    if (!result) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};

export const me = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const currentUser = await authService.getCurrentUser(user.userId);

    if (!currentUser || !currentUser.isActive) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(currentUser);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};
