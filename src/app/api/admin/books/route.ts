import { z } from "zod";
import { db } from "@/lib/db";
import { readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { approveBook, bookInput, upsertBook } from "@/lib/books";

export const GET = route(async (req) => {
  await requireAdmin();
  const status = req.nextUrl.searchParams.get("status");
  const books = await db.book.findMany({
    where: status ? { status } : {},
    include: { publisher: true, prices: true, _count: { select: { userBooks: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return {
    books: books.map((b) => ({
      id: b.id, title: b.title, author: b.author, category: b.category, status: b.status, isFree: b.isFree, publisher: b.publisher.name,
      chapterCount: b.chapterCount, totalChars: b.totalChars, createdAt: b.createdAt, rejectionReason: b.rejectionReason, readers: b._count.userBooks,
      prices: Object.fromEntries(b.prices.map((p) => [p.currency, p.amountMinor])),
    })),
  };
});

// Admins can add a book directly (it is approved immediately).
export const POST = route(async (req) => {
  await requireAdmin();
  const body = z.object({ publisherId: z.string().default("ebookvox-admin"), publisherName: z.string().default("Ebookvox") }).passthrough().parse(await readJson(req));
  const input = bookInput.parse(body);
  const { book } = await upsertBook(input);
  await approveBook(book.id);
  return { id: book.id };
});
