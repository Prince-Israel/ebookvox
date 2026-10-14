import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ALL_PERMISSIONS } from "../src/lib/rbac";

const db = new PrismaClient();
async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "superadmin@ebookvox.app").toLowerCase();
  const exists = await db.adminUser.findUnique({ where: { email } });
  if (!exists) {
    await db.adminUser.create({ data: { email, name: "Super Admin", role: "SUPER_ADMIN", jobTitle: "Platform Owner", permissions: JSON.stringify(ALL_PERMISSIONS), passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD ?? "ChangeMe!2026", 12) } });
    console.log("Super Admin created:", email);
  } else console.log("Super Admin already exists:", email);
}
main().then(() => db.$disconnect());
