import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export const GET = route(async (req) => {
  await requireAdmin();
  const status = req.nextUrl.searchParams.get("status") ?? "REVIEWING";
  const books = await db.book.findMany({
    where: { status: { in: status.split(",") } }, include: { publisher: { select: { publisherName: true, email: true, country: true } }, prices: true, cover: { select: { bookId: true } } },
    orderBy: { submittedAt: "asc" }, take: 200,
  });
  return {
    books: books.map((b) => ({
      id: b.id, title: b.title, author: b.author, category: b.category, description: b.description, isFree: b.isFree, status: b.status, rejectionReason: b.rejectionReason, syncError: b.syncError,
      fileName: b.fileName, totalChars: b.totalChars, submittedAt: b.submittedAt, coverUrl: b.cover ? `/api/covers/${b.id}?v=${b.coverVersion}` : null,
      publisher: b.publisher, prices: Object.fromEntries(b.prices.map((p) => [p.currency, p.amountMinor])),
      preview: b.content.slice(0, 1500),
    })),
  };
});
