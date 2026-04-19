import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const defaultRoles = ["Engineer", "Operator"];

  for (const name of defaultRoles) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const engineerRole = await prisma.role.findUnique({
    where: { name: "Engineer" },
  });

  if (!engineerRole) {
    throw new Error("Engineer role not found after seeding roles");
  }

  const operatorRole = await prisma.role.findUnique({
    where: { name: "Operator" },
  });

  if (!operatorRole) {
    throw new Error("Operator role not found after seeding roles");
  }

  const legacyAdminRole = await prisma.role.findUnique({
    where: { name: "Admin" },
  });

  if (legacyAdminRole) {
    await prisma.user.updateMany({
      where: { roleId: legacyAdminRole.id },
      data: { roleId: engineerRole.id },
    });

    const remainingAdminUsers = await prisma.user.count({
      where: { roleId: legacyAdminRole.id },
    });

    if (remainingAdminUsers === 0) {
      await prisma.role.delete({
        where: { id: legacyAdminRole.id },
      });
    }
  }

  const legacyUserRole = await prisma.role.findUnique({
    where: { name: "User" },
  });

  if (legacyUserRole) {
    await prisma.user.updateMany({
      where: { roleId: legacyUserRole.id },
      data: { roleId: operatorRole.id },
    });

    const remainingStandardUsers = await prisma.user.count({
      where: { roleId: legacyUserRole.id },
    });

    if (remainingStandardUsers === 0) {
      await prisma.role.delete({
        where: { id: legacyUserRole.id },
      });
    }
  }

  const engineerUsername =
    process.env.ENGINEER_USERNAME ?? process.env.ADMIN_USERNAME ?? "engineer";
  const engineerEmail =
    process.env.ENGINEER_EMAIL ?? process.env.ADMIN_EMAIL ?? "engineer@example.com";
  const engineerPassword =
    process.env.ENGINEER_PASSWORD ?? process.env.ADMIN_PASSWORD ?? "engineer12345";
  const passwordHash = await bcrypt.hash(engineerPassword, 10);

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
      passwordHash,
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
