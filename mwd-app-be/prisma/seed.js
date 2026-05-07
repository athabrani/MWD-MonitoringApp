import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const systemRoles = ["admin", "engineer", "operator"];

const normalizeRoleName = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "user") {
    return "operator";
  }

  return normalized;
};

const syncSystemRoles = async () => {
  const existingRoles = await prisma.role.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
    },
  });

  const groupedRoles = new Map();

  for (const role of existingRoles) {
    const canonicalRoleName = normalizeRoleName(role.name);

    if (!systemRoles.includes(canonicalRoleName)) {
      continue;
    }

    const existingGroup = groupedRoles.get(canonicalRoleName) ?? [];
    existingGroup.push(role);
    groupedRoles.set(canonicalRoleName, existingGroup);
  }

  for (const roleName of systemRoles) {
    const matchingRoles = groupedRoles.get(roleName) ?? [];

    if (matchingRoles.length === 0) {
      await prisma.role.create({
        data: { name: roleName },
      });
      continue;
    }

    let canonicalRole =
      matchingRoles.find((role) => role.name === roleName) ?? matchingRoles[0];

    if (canonicalRole.name !== roleName) {
      canonicalRole = await prisma.role.update({
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

      await prisma.user.updateMany({
        where: { roleId: duplicateRole.id },
        data: { roleId: canonicalRole.id },
      });

      await prisma.role.delete({
        where: { id: duplicateRole.id },
      });
    }
  }
};

async function main() {
  await syncSystemRoles();

  const adminRole = await prisma.role.findUnique({
    where: { name: "admin" },
  });
  const engineerRole = await prisma.role.findUnique({
    where: { name: "engineer" },
  });

  if (!adminRole || !engineerRole) {
    throw new Error("System roles were not created successfully");
  }

  const adminUsername = process.env.ADMIN_USERNAME ?? "admin";
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin12345";
  const engineerUsername = process.env.ENGINEER_USERNAME ?? "engineer";
  const engineerEmail = process.env.ENGINEER_EMAIL ?? "engineer@example.com";
  const engineerPassword = process.env.ENGINEER_PASSWORD ?? "engineer12345";
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
  const engineerPasswordHash = await bcrypt.hash(engineerPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      username: adminUsername,
      roleId: adminRole.id,
      isActive: true,
    },
    create: {
      roleId: adminRole.id,
      username: adminUsername,
      email: adminEmail,
      passwordHash: adminPasswordHash,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: engineerEmail },
    update: {
      username: engineerUsername,
      roleId: engineerRole.id,
      isActive: true,
    },
    create: {
      roleId: engineerRole.id,
      username: engineerUsername,
      email: engineerEmail,
      passwordHash: engineerPasswordHash,
      isActive: true,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
