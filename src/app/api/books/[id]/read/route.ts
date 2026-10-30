import { coverSrc } from "@/lib/books";
import { db } from "@/lib/db";
import { ApiError, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";

/** Opens a book for reading: returns the table of contents and saved position, and stamps lastOpenedAt. */
export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requireUser();
  const { id } = await params;
  const ub = await db.userBook.findUnique({ where: { userId_bookId: { userId: u.id, bookId: id } }, include: { book: { include: { publisher: true } } } });
  if (!ub) throw new ApiError(403, "Add this book to your library to read it.");
  const chapters = await db.chapter.findMany({ where: { bookId: id }, orderBy: { index: "asc" }, select: { index: true, title: true, startChar: true, charCount: true } });
  const started = !!ub.lastOpenedAt;
  await db.userBook.update({ where: { id: ub.id }, data: { lastOpenedAt: new Date() } });
  return {
    book: { id, title: ub.book.title, author: ub.book.author, category: ub.book.category, totalChars: ub.book.totalChars, isFree: ub.book.isFree, coverHue: ub.book.coverHue, coverUrl: coverSrc(id, ub.book.coverUrl) },
    chapters,
    progress: { chapterIndex: ub.chapterIndex, paragraphIndex: ub.paragraphIndex, audioTime: ub.audioTime, percent: ub.percent, completed: !!ub.completedAt, started },
  };
});
