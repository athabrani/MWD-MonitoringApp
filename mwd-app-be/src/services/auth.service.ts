import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { createAuditLog } from "./audit-log.service.js";
import { normalizeRoleName } from "../utils/roles.js";

type JwtPayload = {
  userId: number;
  roleId: number;
  username: string;
  email: string;
  roleName: string;
};

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return secret;
};

export const login = async (identifier: string, password: string) => {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier.toLowerCase() }, { username: identifier }],
    },
    include: {
      role: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!user || !user.isActive) {
    return null;
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    return null;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await createAuditLog({
    userId: user.id,
    action: "login",
    details: `User ${user.username} logged in`,
    metadata: {
      username: user.username,
      email: user.email,
      role: user.role.name,
    },
  });

  const payload: JwtPayload = {
    userId: user.id,
    roleId: user.roleId,
    username: user.username,
    email: user.email,
    roleName: normalizeRoleName(user.role.name),
  };

  const token = jwt.sign(payload, getJwtSecret(), { expiresIn: "1d" });

  return {
    token,
    user: {
      id: user.id,
      roleId: user.roleId,
      username: user.username,
      email: user.email,
      isActive: user.isActive,
      lastLoginAt: new Date(),
      role: user.role,
    },
  };
};

export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, getJwtSecret()) as JwtPayload;
};

export const getCurrentUser = async (userId: number) => {
  return await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      roleId: true,
      username: true,
      email: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      role: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
};
