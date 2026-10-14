import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export const GET = route(async () => {
  await requireAdmin();
  const orders = await db.order.findMany({ include: { user: { select: { email: true } }, book: { select: { title: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  return { orders: orders.map((o) => ({ id: o.id, number: o.number, reference: o.reference, status: o.status, amountMinor: o.amountMinor, currency: o.currency, createdAt: o.createdAt, email: o.user.email, book: o.book.title })) };
});
