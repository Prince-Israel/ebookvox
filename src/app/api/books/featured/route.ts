import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { viewer } from "@/lib/viewer";
import { serializeBook } from "@/lib/books";

/** Public carousel data: what readers are choosing right now, and what just arrived. */
export const GET = route(async (req) => {
  const v = await viewer(req);
  const since = new Date(Date.now() - 90 * 86400_000);
  const books = await db.book.findMany({
    where: { status: "APPROVED" }, include: { publisher: true, prices: true, _count: { select: { userBooks: true } } }, orderBy: [{ approvedAt: "desc" }], take: 100,
  });
  const paid = await db.order.groupBy({ by: ["bookId"], where: { status: "PAID", paidAt: { gte: since } }, _count: true });
  const score = (b: (typeof books)[number]) => b._count.userBooks + (paid.find((p) => p.bookId === b.id)?._count ?? 0) * 3;
  const owned = v.user ? new Set((await db.userBook.findMany({ where: { userId: v.user.id }, select: { bookId: true } })).map((o) => o.bookId)) : new Set<string>();
  const out = async (b: (typeof books)[number]) => ({ ...(await serializeBook(b, v.currency)), owned: owned.has(b.id) });
  const trending = [...books].filter((b) => score(b) > 0).sort((a, b) => score(b) - score(a)).slice(0, 10);
  return { currency: v.currency, trending: await Promise.all(trending.map(out)), newest: await Promise.all(books.slice(0, 10).map(out)) };
});
