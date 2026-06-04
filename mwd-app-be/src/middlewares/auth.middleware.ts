import type { NextFunction, Request, Response } from "express";
import * as authService from "../services/auth.service.js";
import { hasRole, normalizeRoleName } from "../utils/roles.js";
import { getAccessTokenFromCookie } from "../utils/cookies.js";

export type AuthenticatedUser = {
  userId: number;
  roleId: number;
  username: string;
  email: string;
  roleName: string;
  authSource?: "bearer" | "cookie";
};

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  const bearerToken =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";
  const cookieToken = bearerToken ? "" : getAccessTokenFromCookie(req);
  const token = bearerToken || cookieToken;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const payload = authService.verifyAccessToken(token);
    const currentUser = await authService.getCurrentUser(payload.userId);

    if (!currentUser || !currentUser.isActive) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    (req as AuthenticatedRequest).user = {
      userId: currentUser.id,
      roleId: currentUser.roleId,
      username: currentUser.username,
      email: currentUser.email,
      roleName: normalizeRoleName(currentUser.role.name),
      authSource: bearerToken ? "bearer" : "cookie",
    };
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!hasRole(user.roleName, allowedRoles)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
};
