import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export const GET = route(async () => {
  await requireAdmin();
  const [users, pending, approved, orders, openTickets, paid] = await Promise.all([
    db.user.count(),
    db.book.count({ where: { status: "PENDING" } }),
    db.book.count({ where: { status: "APPROVED" } }),
    db.order.count(),
    db.ticket.count({ where: { status: { not: "CLOSED" } } }),
    db.order.groupBy({ by: ["currency"], where: { status: "PAID" }, _sum: { amountMinor: true }, _count: true }),
  ]);
  return { users, pendingBooks: pending, approvedBooks: approved, orders, openTickets, revenue: paid.map((p) => ({ currency: p.currency, amountMinor: p._sum.amountMinor ?? 0, count: p._count })) };
});
