import { db } from "@/lib/db";
import { ApiError, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const GET = route(async (_req, { params }: { params: Promise<{ id: string; index: string }> }) => {
  const u = await requireUser();
  const { id, index } = await params;
  const own = await db.userBook.findUnique({ where: { userId_bookId: { userId: u.id, bookId: id } } });
  if (!own) throw new ApiError(403, "Add this book to your library to read it.");
  const ch = await db.chapter.findUnique({ where: { bookId_index: { bookId: id, index: Number(index) } } });
  if (!ch) throw new ApiError(404, "That chapter doesn't exist.");
  return { chapter: { index: ch.index, title: ch.title, content: ch.content, startChar: ch.startChar, charCount: ch.charCount } };
});
