import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const GET = route(async () => {
  const u = await requireUser();
  const orders = await db.order.findMany({ where: { userId: u.id }, include: { book: { select: { id: true, title: true, author: true, coverHue: true, coverUrl: true } } }, orderBy: { createdAt: "desc" } });
  return {
    orders: orders.map((o) => ({
      id: o.id, number: o.number, reference: o.reference, status: o.status, amountMinor: o.amountMinor, currency: o.currency,
      createdAt: o.createdAt, paidAt: o.paidAt, failureReason: o.failureReason, channel: o.channel, book: o.book,
    })),
  };
});
