import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@publisher.ebookvox.app").toLowerCase();
  await db.user.upsert({
    where: { email },
    create: { email, firstName: "Ebookvox", lastName: "Admin", publisherName: "Ebookvox Admin", phone: "+2340000000000", phoneCountry: "NG", country: "NG", currency: "NGN", role: "ADMIN", emailVerifiedAt: new Date(), passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD ?? "ChangeMe!2026", 12) },
    update: { role: "ADMIN" },
  });
  console.log("Admin account:", email);
}
main().then(() => db.$disconnect());
