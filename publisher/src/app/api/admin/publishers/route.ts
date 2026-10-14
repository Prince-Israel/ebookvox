import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export const GET = route(async () => {
  await requireAdmin();
  const users = await db.user.findMany({ where: { role: "PUBLISHER" }, include: { _count: { select: { books: true, sales: true } } }, orderBy: { createdAt: "desc" }, take: 300 });
  return { publishers: users.map((u) => ({ id: u.id, name: u.publisherName, email: u.email, country: u.country, currency: u.currency, verified: !!u.emailVerifiedAt, status: u.status, books: u._count.books, sales: u._count.sales, createdAt: u.createdAt })) };
});
