import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";

const userSelect = {
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
} as const;

type CreateUserInput = {
  roleId: number;
  username: string;
  email: string;
  password: string;
  isActive?: boolean;
};

type UpdateUserInput = {
  roleId?: number;
  username?: string;
  email?: string;
  password?: string;
  isActive?: boolean;
};

const SALT_ROUNDS = 10;

export const createUser = async (input: CreateUserInput) => {
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  return await prisma.user.create({
    data: {
      roleId: input.roleId,
      username: input.username,
      email: input.email,
      passwordHash,
      isActive: input.isActive ?? true,
    },
    select: userSelect,
  });
};

export const getAllUsers = async () => {
  return await prisma.user.findMany({
    orderBy: { id: "asc" },
    select: userSelect,
  });
};

export const getUserById = async (id: number) => {
  return await prisma.user.findUnique({
    where: { id },
    select: userSelect,
  });
};

export const updateUser = async (id: number, input: UpdateUserInput) => {
  const data: {
    roleId?: number;
    username?: string;
    email?: string;
    passwordHash?: string;
    isActive?: boolean;
  } = {};

  if (input.roleId !== undefined) {
    data.roleId = input.roleId;
  }

  if (input.username !== undefined) {
    data.username = input.username;
  }

  if (input.email !== undefined) {
    data.email = input.email;
  }

  if (input.isActive !== undefined) {
    data.isActive = input.isActive;
  }

  if (input.password !== undefined) {
    data.passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  }

  return await prisma.user.update({
    where: { id },
    data,
    select: userSelect,
  });
};

export const deleteUser = async (id: number) => {
  return await prisma.user.delete({
    where: { id },
    select: userSelect,
  });
};
