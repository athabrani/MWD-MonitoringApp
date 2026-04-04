import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const defaultRoles = ["Admin", "User"];

  for (const name of defaultRoles) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const adminRole = await prisma.role.findUnique({
    where: { name: "Admin" },
  });

  if (!adminRole) {
    throw new Error("Admin role not found after seeding roles");
  }

  const adminUsername = process.env.ADMIN_USERNAME ?? "admin";
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin12345";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

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
