import { db } from "@/lib/db";
import { rateLimit, route } from "@/lib/api";
import { requirePublisher } from "@/lib/auth";
import { applyBook, bookInclude, parseBookForm, serializeBook } from "@/lib/books";

export const maxDuration = 60;

export const GET = route(async (req) => {
  const u = await requirePublisher();
  const status = req.nextUrl.searchParams.get("status");
  const where = { publisherId: u.id, ...(status ? { status: { in: status.split(",") } } : {}) };
  const books = await db.book.findMany({ where, include: bookInclude, orderBy: { updatedAt: "desc" } });
  const counts = await db.book.groupBy({ by: ["status"], where: { publisherId: u.id }, _count: true });
  return { currency: u.currency, books: books.map(serializeBook), counts: Object.fromEntries(counts.map((c) => [c.status, c._count])) };
});

/** Creates a Draft. Cover and book file are validated and processed here. */
export const POST = route(async (req) => {
  const u = await requirePublisher();
  rateLimit(`upload:${u.id}`, 40, 3600_000);
  const form = await req.formData().catch(() => null);
  if (!form) throw new (await import("@/lib/api")).ApiError(400, "The upload could not be read. Please try again.");
  const p = await parseBookForm(form, false);
  const book = await db.book.create({ data: { publisherId: u.id, title: p.fields.title!, author: p.fields.author!, category: p.fields.category!, description: p.fields.description ?? "", isFree: p.fields.isFree ?? false } });
  await applyBook(book.id, p);
  return { id: book.id };
});
