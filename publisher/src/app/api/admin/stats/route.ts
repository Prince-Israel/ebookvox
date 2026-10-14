import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export const GET = route(async () => {
  await requireAdmin();
  const [publishers, reviewing, live, openTickets, pendingWd, sales] = await Promise.all([
    db.user.count({ where: { role: "PUBLISHER" } }),
    db.book.count({ where: { status: "REVIEWING" } }),
    db.book.count({ where: { status: { in: ["APPROVED", "PUBLISHED"] } } }),
    db.ticket.count({ where: { status: { not: "CLOSED" } } }),
    db.withdrawal.count({ where: { status: "PROCESSING" } }),
    db.sale.groupBy({ by: ["currency"], where: { status: "PAID" }, _sum: { grossMinor: true, platformMinor: true, publisherMinor: true }, _count: true }),
  ]);
  return { publishers, reviewing, live, openTickets, pendingWithdrawals: pendingWd, sales: sales.map((s) => ({ currency: s.currency, count: s._count, grossMinor: s._sum.grossMinor ?? 0, platformMinor: s._sum.platformMinor ?? 0, publisherMinor: s._sum.publisherMinor ?? 0 })) };
});
