import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { requirePublisher } from "@/lib/auth";
import { RANGES, rangeStart, type RangeKey } from "@/lib/range";
import { walletSummary } from "@/lib/wallet";

export const GET = route(async (req) => {
  const u = await requirePublisher();
  const rk = (req.nextUrl.searchParams.get("range") as RangeKey) in RANGES ? (req.nextUrl.searchParams.get("range") as RangeKey) : "30d";
  const since = rangeStart(rk)!;
  const currency = req.nextUrl.searchParams.get("currency") ?? u.currency;

  const [counts, wallets, inRange, topRaw] = await Promise.all([
    db.book.groupBy({ by: ["status"], where: { publisherId: u.id }, _count: true }),
    walletSummary(u.id),
    db.sale.findMany({ where: { publisherId: u.id, status: "PAID", currency, paidAt: { gte: since } }, select: { paidAt: true, publisherMinor: true, bookId: true } }),
    db.sale.groupBy({ by: ["bookId"], where: { publisherId: u.id, status: "PAID", currency, paidAt: { gte: since } }, _count: true, _sum: { publisherMinor: true }, orderBy: { _sum: { publisherMinor: "desc" } }, take: 5 }),
  ]);
  const n = (s: string[]) => counts.filter((c) => s.includes(c.status)).reduce((a, c) => a + c._count, 0);
  const lifetime = await db.sale.groupBy({ by: ["currency"], where: { publisherId: u.id, status: "PAID" }, _count: true, _sum: { publisherMinor: true, grossMinor: true } });

  // Bucket by day (≤ 90 days) or by week (longer) so the series stays readable.
  const days = RANGES[rk];
  const bucketDays = days > 90 ? 7 : 1;
  const buckets = new Map<string, { date: string; sales: number; earnings: number }>();
  const startMs = since.getTime();
  for (let t = startMs; t <= Date.now() + 86400_000; t += bucketDays * 86400_000) {
    const k = new Date(t).toISOString().slice(0, 10);
    buckets.set(k, { date: k, sales: 0, earnings: 0 });
  }
  for (const s of inRange) {
    const idx = Math.floor((new Date(new Date(s.paidAt).toDateString()).getTime() - startMs) / (bucketDays * 86400_000));
    const key = new Date(startMs + Math.max(0, idx) * bucketDays * 86400_000).toISOString().slice(0, 10);
    const b = buckets.get(key);
    if (b) { b.sales += 1; b.earnings += s.publisherMinor; }
  }
  const titles = await db.book.findMany({ where: { id: { in: topRaw.map((t) => t.bookId) } }, select: { id: true, title: true } });
  const soldByBook = new Map<string, number>();
  for (const s of inRange) soldByBook.set(s.bookId, (soldByBook.get(s.bookId) ?? 0) + 1);

  return {
    range: rk, currency, primaryCurrency: u.currency,
    books: { total: counts.reduce((a, c) => a + c._count, 0), approved: n(["APPROVED", "PUBLISHED"]), reviewing: n(["REVIEWING"]), rejected: n(["REJECTED"]), drafts: n(["DRAFT"]) },
    lifetime: lifetime.map((l) => ({ currency: l.currency, sales: l._count, grossMinor: l._sum.grossMinor ?? 0, earningsMinor: l._sum.publisherMinor ?? 0 })),
    wallets,
    series: [...buckets.values()],
    top: topRaw.map((t) => ({ bookId: t.bookId, title: titles.find((x) => x.id === t.bookId)?.title ?? "Deleted book", sales: t._count, earningsMinor: t._sum.publisherMinor ?? 0 })),
    booksSold: [...soldByBook.entries()].length,
    periodSales: inRange.length,
    periodEarningsMinor: inRange.reduce((a, s) => a + s.publisherMinor, 0),
  };
});
