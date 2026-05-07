import { prisma } from "../lib/prisma.js";
import {
  ALL_SYSTEM_ROLE_NAMES,
  normalizeRoleName,
  type SystemRoleName,
} from "../utils/roles.js";

const groupRolesByCanonicalName = (roles: { id: number; name: string }[]) => {
  const groupedRoles = new Map<SystemRoleName, { id: number; name: string }[]>();

  for (const role of roles) {
    const canonicalRoleName = normalizeRoleName(role.name) as SystemRoleName;

    if (!ALL_SYSTEM_ROLE_NAMES.includes(canonicalRoleName)) {
      continue;
    }

    const existingGroup = groupedRoles.get(canonicalRoleName) ?? [];
    existingGroup.push(role);
    groupedRoles.set(canonicalRoleName, existingGroup);
  }

  return groupedRoles;
};

export const syncSystemRoles = async () => {
  await prisma.$transaction(async (tx) => {
    const existingRoles = await tx.role.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
      },
    });

    const groupedRoles = groupRolesByCanonicalName(existingRoles);

    for (const roleName of ALL_SYSTEM_ROLE_NAMES) {
      const matchingRoles = groupedRoles.get(roleName) ?? [];

      if (matchingRoles.length === 0) {
        await tx.role.create({
          data: { name: roleName },
        });
        continue;
      }

      const initialCanonicalRole =
        matchingRoles.find((role) => role.name === roleName) ?? matchingRoles[0];

      if (!initialCanonicalRole) {
        continue;
      }

      let canonicalRole = initialCanonicalRole;

      if (canonicalRole.name !== roleName) {
        canonicalRole = await tx.role.update({
          where: { id: canonicalRole.id },
          data: { name: roleName },
          select: {
            id: true,
            name: true,
          },
        });
      }

      for (const duplicateRole of matchingRoles) {
        if (duplicateRole.id === canonicalRole.id) {
          continue;
        }

        await tx.user.updateMany({
          where: { roleId: duplicateRole.id },
          data: { roleId: canonicalRole.id },
        });

        await tx.role.delete({
          where: { id: duplicateRole.id },
        });
      }
    }
  });
};

export const createRole = async (name: string) => {
  return await prisma.role.create({
    data: { name: normalizeRoleName(name) },
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
    data: { name: normalizeRoleName(name) },
  });
};

export const deleteRole = async (id: number) => {
  return await prisma.role.delete({
    where: { id },
  });
};
