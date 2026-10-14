import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { requirePublisher } from "@/lib/auth";
import { rangeStart } from "@/lib/range";

export const GET = route(async (req) => {
  const u = await requirePublisher();
  const sp = req.nextUrl.searchParams;
  const since = rangeStart(sp.get("range"));
  const where = { publisherId: u.id, ...(since ? { paidAt: { gte: since } } : {}), ...(sp.get("bookId") ? { bookId: sp.get("bookId")! } : {}), ...(sp.get("currency") ? { currency: sp.get("currency")! } : {}) };
  const [sales, totals] = await Promise.all([
    db.sale.findMany({ where, include: { book: { select: { id: true, title: true } } }, orderBy: { paidAt: "desc" }, take: 500 }),
    db.sale.groupBy({ by: ["currency"], where: { ...where, status: "PAID" }, _sum: { grossMinor: true, publisherMinor: true, platformMinor: true }, _count: true }),
  ]);
  return {
    sales: sales.map((s) => ({ id: s.id, number: s.number, book: s.book, buyer: s.buyerLabel, currency: s.currency, grossMinor: s.grossMinor, publisherMinor: s.publisherMinor, platformMinor: s.platformMinor, status: s.status, paidAt: s.paidAt })),
    totals: totals.map((t) => ({ currency: t.currency, count: t._count, grossMinor: t._sum.grossMinor ?? 0, publisherMinor: t._sum.publisherMinor ?? 0, platformMinor: t._sum.platformMinor ?? 0 })),
  };
});
