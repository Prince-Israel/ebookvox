import { db } from "@/lib/db";
import { ApiError, route } from "@/lib/api";
import { viewer } from "@/lib/viewer";
import { loadBook, serializeBook } from "@/lib/books";

// Public: visitors can open any approved book's page; owning / purchase state needs an account.
export const GET = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const v = await viewer(req);
  const u = v.user;
  const { id } = await params;
  const b = await loadBook(id);
  if (!b || (b.status !== "APPROVED" && u?.role !== "ADMIN")) throw new ApiError(404, "We couldn't find that book.");
  const ub = u ? await db.userBook.findUnique({ where: { userId_bookId: { userId: u.id, bookId: id } } }) : null;
  const pending = u ? await db.order.findFirst({ where: { userId: u.id, bookId: id, status: "PENDING" }, select: { reference: true } }) : null;
  return {
    book: serializeBook(b, v.currency),
    owned: !!ub,
    progress: ub ? { percent: ub.percent, lastOpenedAt: ub.lastOpenedAt } : null,
    pendingReference: pending?.reference ?? null,
    canBuy: b.isFree || !!b.prices.find((p) => p.currency === v.currency),
  };
});
