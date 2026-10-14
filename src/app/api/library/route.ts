import { coverSrc } from "@/lib/books";
import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const GET = route(async () => {
  const u = await requireUser();
  const rows = await db.userBook.findMany({ where: { userId: u.id }, include: { book: { include: { publisher: true } } }, orderBy: { addedAt: "desc" } });
  const items = rows.map((r) => ({
    id: r.bookId,
    title: r.book.title,
    author: r.book.author,
    category: r.book.category,
    coverUrl: coverSrc(r.book.id, r.book.coverUrl),
    coverHue: r.book.coverHue,
    source: r.source,
    percent: r.percent,
    completed: !!r.completedAt,
    started: !!r.lastOpenedAt,
    addedAt: r.addedAt,
    lastOpenedAt: r.lastOpenedAt,
  }));
  return {
    items,
    purchased: items.filter((i) => i.source === "PURCHASE"),
    reading: items.filter((i) => i.started && !i.completed && i.percent < 99).sort((a, b) => +new Date(b.lastOpenedAt!) - +new Date(a.lastOpenedAt!)),
    recent: items.filter((i) => i.lastOpenedAt).sort((a, b) => +new Date(b.lastOpenedAt!) - +new Date(a.lastOpenedAt!)).slice(0, 10),
  };
});
