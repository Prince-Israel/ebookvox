import { db } from "@/lib/db";
import { ApiError, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";

/** Free books are added to the library on "Read Now". Paid books can only be added via a verified payment. */
export const POST = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requireUser();
  const { id } = await params;
  const b = await db.book.findUnique({ where: { id } });
  if (!b || b.status !== "APPROVED") throw new ApiError(404, "We couldn't find that book.");
  if (!b.isFree) throw new ApiError(402, "This is a paid book. Purchase it to start reading.");
  const exists = await db.userBook.findUnique({ where: { userId_bookId: { userId: u.id, bookId: id } } });
  if (!exists) {
    await db.userBook.create({ data: { userId: u.id, bookId: id, source: "FREE" } });
    await notify(u.id, "BOOK_ADDED", "Book added to your library", `“${b.title}” is ready to read and listen to.`, `/read/${id}`);
  }
  return { ok: true };
});
