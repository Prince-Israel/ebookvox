import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { viewer } from "@/lib/viewer";
import { serializeBook } from "@/lib/books";

export const GET = route(async (req) => {
  const v = await viewer(req); // public: guests can browse the catalogue
  const sp = req.nextUrl.searchParams;
  const type = sp.get("type");
  const q = sp.get("q")?.trim();
  const category = sp.get("category");
  const where = {
    status: "APPROVED",
    ...(type === "free" ? { isFree: true } : type === "paid" ? { isFree: false } : {}),
    ...(category ? { category } : {}),
    ...(q ? { OR: [{ title: { contains: q } }, { author: { contains: q } }, { category: { contains: q } }] } : {}),
  };
  // The catalogue holds thousands of titles, so it is served a page at a time.
  const size = Math.min(100, Math.max(1, Number(sp.get("pageSize")) || 48));
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const [books, total, cats, owned] = await Promise.all([
    db.book.findMany({ where, include: { publisher: true, prices: true }, orderBy: [{ approvedAt: "desc" }, { title: "asc" }], skip: (page - 1) * size, take: size }),
    db.book.count({ where }),
    db.book.findMany({ where: { status: "APPROVED" }, select: { category: true }, distinct: ["category"], orderBy: { category: "asc" } }),
    v.user ? db.userBook.findMany({ where: { userId: v.user.id }, select: { bookId: true } }) : Promise.resolve([]),
  ]);
  const ownedSet = new Set(owned.map((o) => o.bookId));
  return {
    currency: v.currency,
    total,
    page,
    categories: cats.map((c) => c.category),
    books: await Promise.all(books.map(async (b) => ({ ...(await serializeBook(b, v.currency)), owned: ownedSet.has(b.id) }))),
  };
});
