import { prisma } from "../lib/prisma.js";

export const createRole = async (name: string) => {
  return await prisma.role.create({
    data: { name },
  });
};

export const getAllRoles = async () => {
  return await prisma.role.findMany({
    orderBy: { id: "asc" },
  });
};

export const getRoleById = async (id: number) => {
  return await prisma.role.findUnique({
    where: { id },
  });
};

export const updateRole = async (id: number, name: string) => {
  return await prisma.role.update({
    where: { id },
    data: { name },
  });
};

export const deleteRole = async (id: number) => {
  return await prisma.role.delete({
    where: { id },
  });
};
