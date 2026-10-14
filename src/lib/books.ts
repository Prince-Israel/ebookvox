import { z } from "zod";
import { db } from "./db";
import { CURRENCIES } from "./countries";
import { ApiError } from "./api";
import { notifyAll } from "./notify";
import { enqueue, flushOutbox } from "./outbox";

export type BookWithRels = Awaited<ReturnType<typeof loadBook>>;

export const bookInclude = { publisher: true, prices: true } as const;
export const loadBook = (id: string) => db.book.findUnique({ where: { id }, include: bookInclude });

export function serializeBook(b: NonNullable<BookWithRels>, currency: string) {
  const price = b.isFree ? null : b.prices.find((p) => p.currency === currency);
  return {
    id: b.id,
    title: b.title,
    author: b.author,
    category: b.category,
    description: b.description,
    language: b.language,
    publisher: b.publisher.name,
    coverUrl: b.coverUrl,
    coverHue: b.coverHue,
    isFree: b.isFree,
    chapterCount: b.chapterCount,
    totalChars: b.totalChars,
    price: price ? { amountMinor: price.amountMinor, currency: price.currency } : null,
  };
}

const priceMap = z
  .object(Object.fromEntries(CURRENCIES.map((c) => [c, z.number().int().positive().max(100_000_000)])) as Record<string, z.ZodNumber>)
  .partial();

export const bookInput = z
  .object({
    externalId: z.string().trim().min(1).max(100).optional(),
    publisherId: z.string().trim().min(1).max(100),
    publisherName: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(200),
    author: z.string().trim().min(1).max(150),
    category: z.string().trim().min(1).max(60),
    description: z.string().trim().min(10).max(5000),
    language: z.string().trim().max(10).default("en"),
    coverUrl: z.string().url().max(500).optional().nullable(),
    isFree: z.boolean(),
    prices: priceMap.optional(),
    chapters: z.array(z.object({ title: z.string().trim().min(1).max(200), content: z.string().trim().min(1).max(2_000_000) })).min(1).max(500),
  })
  .superRefine((v, ctx) => {
    if (!v.isFree) {
      for (const c of CURRENCIES) if (!v.prices?.[c]) ctx.addIssue({ code: "custom", path: ["prices", c], message: `Paid books need a ${c} price (minor units).` });
    }
  });
export type BookInput = z.infer<typeof bookInput>;

const hueOf = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);

/** Creates or updates a book (matched on externalId). Updates re-enter review as PENDING unless `autoApprove`. */
export async function upsertBook(input: BookInput, opts: { autoApprove?: boolean } = {}) {
  const publisher = await db.publisher.upsert({
    where: { externalId: input.publisherId },
    create: { externalId: input.publisherId, name: input.publisherName },
    update: { name: input.publisherName },
  });
  let start = 0;
  const chapters = input.chapters.map((c, index) => {
    const row = { index, title: c.title, content: c.content, startChar: start, charCount: c.content.length };
    start += c.content.length;
    return row;
  });
  const data = {
    title: input.title,
    author: input.author,
    category: input.category,
    description: input.description,
    language: input.language,
    coverUrl: input.coverUrl ?? null,
    coverHue: hueOf(input.title + input.author),
    isFree: input.isFree,
    totalChars: start,
    chapterCount: chapters.length,
    publisherId: publisher.id,
  };
  const existing = input.externalId ? await db.book.findUnique({ where: { externalId: input.externalId } }) : null;
  const status = opts.autoApprove ? "APPROVED" : "PENDING";
  const book = await db.$transaction(async (t) => {
    let b;
    if (existing) {
      await t.chapter.deleteMany({ where: { bookId: existing.id } });
      await t.bookPrice.deleteMany({ where: { bookId: existing.id } });
      b = await t.book.update({ where: { id: existing.id }, data: { ...data, status, rejectionReason: null, approvedAt: opts.autoApprove ? existing.approvedAt ?? new Date() : null } });
    } else {
      b = await t.book.create({ data: { ...data, externalId: input.externalId, status, approvedAt: opts.autoApprove ? new Date() : null } });
    }
    await t.chapter.createMany({ data: chapters.map((c) => ({ ...c, bookId: b.id })) });
    if (!input.isFree) await t.bookPrice.createMany({ data: CURRENCIES.map((c) => ({ bookId: b.id, currency: c, amountMinor: input.prices![c]! })) });
    return b;
  });
  return { book, created: !existing };
}

export async function approveBook(id: string) {
  const b = await db.book.findUnique({ where: { id } });
  if (!b) throw new ApiError(404, "Book not found.");
  const first = !b.approvedAt;
  await db.book.update({ where: { id }, data: { status: "APPROVED", approvedAt: b.approvedAt ?? new Date(), rejectionReason: null } });
  if (b.externalId) { await enqueue("book.status", { externalId: b.externalId, status: "APPROVED" }); void flushOutbox().catch(() => {}); }
  if (first) await notifyAll("NEW_BOOK", "New book on Ebookvox", `“${b.title}” by ${b.author} just arrived.`, `/books/${id}`);
}
