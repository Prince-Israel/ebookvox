import { db } from "@/lib/db";
import { ApiError, route } from "@/lib/api";
import { requirePublisher } from "@/lib/auth";
import { applyBook, bookInclude, parseBookForm, serializeBook } from "@/lib/books";

export const maxDuration = 60;

// Every query is scoped by publisherId, so another publisher's id simply resolves to "not found".
const own = async (id: string, publisherId: string) => {
  const b = await db.book.findFirst({ where: { id, publisherId }, include: bookInclude });
  if (!b) throw new ApiError(404, "We couldn't find that book.");
  return b;
};

export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requirePublisher();
  const b = await own((await params).id, u.id);
  const sales = await db.sale.aggregate({ where: { bookId: b.id, status: "PAID" }, _count: true });
  return { book: serializeBook(b), salesCount: sales._count };
});

export const PATCH = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requirePublisher();
  const b = await own((await params).id, u.id);
  if (!["DRAFT", "REJECTED"].includes(b.status)) throw new ApiError(409, "Only drafts and rejected books can be edited. This book is already in review or live.");
  const form = await req.formData().catch(() => null);
  if (!form) throw new ApiError(400, "The upload could not be read. Please try again.");
  await applyBook(b.id, await parseBookForm(form, true));
  return { id: b.id };
});

export const DELETE = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requirePublisher();
  const b = await own((await params).id, u.id);
  if (!["DRAFT", "REJECTED"].includes(b.status)) throw new ApiError(409, "Only drafts and rejected books can be deleted. Live books have readers and sales history.");
  await db.book.delete({ where: { id: b.id } });
});
