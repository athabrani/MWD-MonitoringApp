import type { Request, Response } from "express";
import { randomBytes } from "node:crypto";
import * as authService from "../services/auth.service.js";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { clearAuthCookies, setAuthCookies } from "../utils/cookies.js";

const shouldExposeAccessToken = () => {
  const configured = process.env.AUTH_EXPOSE_TOKEN?.trim().toLowerCase();

  if (configured !== undefined && configured !== "") {
    return ["1", "true", "yes", "on"].includes(configured);
  }

  return process.env.NODE_ENV !== "production";
};

const normalizeString = (value: unknown) => {
  return typeof value === "string" ? value.trim() : "";
};

const getClientIp = (req: Request) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  const forwardedIp =
    typeof forwardedFor === "string" ? forwardedFor.split(",")[0]?.trim() : "";

  return forwardedIp || req.ip || req.socket.remoteAddress || null;
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

    const result = await authService.login(identifier, password, {
      ip: getClientIp(req),
      userAgent:
        typeof req.headers["user-agent"] === "string"
          ? req.headers["user-agent"]
          : null,
    });

    if (!result) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const csrfToken = randomBytes(32).toString("hex");

    setAuthCookies(res, {
      accessToken: result.token,
      csrfToken,
      maxAgeSeconds: 24 * 60 * 60,
    });

    const responseBody: Record<string, unknown> = {
      user: result.user,
      csrfToken,
      authMode: "cookie",
    };

    if (shouldExposeAccessToken()) {
      responseBody.token = result.token;
    }

    res.json(responseBody);
  } catch (error: unknown) {
    if (error instanceof authService.LoginLockedError) {
      res.setHeader("Retry-After", String(error.retryAfterSeconds));
      return res.status(423).json({
        message: error.message,
        retryAfterSeconds: error.retryAfterSeconds,
      });
    }

    const message =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message });
  }
};

export const logout = async (_req: Request, res: Response) => {
  clearAuthCookies(res);
  res.json({ message: "Logged out" });
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
