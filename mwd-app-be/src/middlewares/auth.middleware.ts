import type { NextFunction, Request, Response } from "express";
import * as authService from "../services/auth.service.js";

export type AuthenticatedUser = {
  userId: number;
  roleId: number;
  username: string;
  email: string;
  roleName: string;
};

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.slice(7).trim();

  try {
    const payload = authService.verifyAccessToken(token);
    (req as AuthenticatedRequest).user = payload;
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

    if (!allowedRoles.includes(user.roleName)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
};
