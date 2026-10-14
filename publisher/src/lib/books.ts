import sharp from "sharp";
import { z } from "zod";
import { db } from "./db";
import { ApiError } from "./api";
import { getCategories } from "./platform-config";
import { CURRENCIES } from "./countries";
import { ExtractError, MAX_UPLOAD, extractText } from "./extract";
import { sniffImage } from "./images";

const MAX_COVER = 8 * 1024 * 1024;
const PRICE_MAX = 100_000_000;

export const bookInclude = { prices: true, cover: { select: { bookId: true } }, file: { select: { bookId: true } } } as const;
type BookRow = NonNullable<Awaited<ReturnType<typeof db.book.findFirst<{ include: typeof bookInclude }>>>>;

export function serializeBook(b: BookRow) {
  return {
    id: b.id, title: b.title, author: b.author, category: b.category, description: b.description, isFree: b.isFree, status: b.status,
    rejectionReason: b.rejectionReason, fileName: b.fileName, fileKind: b.fileKind, fileSize: b.fileSize, totalChars: b.totalChars,
    hasCover: !!b.cover, coverUrl: b.cover ? `/api/covers/${b.id}?v=${b.coverVersion}` : null, hasFile: !!b.file,
    prices: Object.fromEntries(b.prices.map((p) => [p.currency, p.amountMinor])) as Record<string, number>,
    submittedAt: b.submittedAt, approvedAt: b.approvedAt, publishedAt: b.publishedAt, createdAt: b.createdAt, updatedAt: b.updatedAt, syncError: b.syncError,
  };
}

const fieldsSchema = z.object({
  title: z.string().trim().min(1, "Book title is required.").max(200),
  author: z.string().trim().min(1, "Author name is required.").max(150),
  category: z.string().min(1, "Choose a category."),
  description: z.string().trim().max(5000, "Description is too long (5,000 characters max)."),
  isFree: z.boolean(),
  prices: z.record(z.string(), z.number().int().min(0).max(PRICE_MAX)),
});

export type ParsedForm = {
  fields: Partial<z.infer<typeof fieldsSchema>>;
  cover?: { data: Buffer };
  file?: { name: string; mime: string; data: Buffer; kind: string; text: string };
};

const ALLOWED_MIME: Record<string, string[]> = {
  pdf: ["application/pdf"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip"],
  txt: ["text/plain"],
};

export async function parseBookForm(form: FormData, partial: boolean): Promise<ParsedForm> {
  const raw: Record<string, unknown> = {};
  const errs: Record<string, string> = {};
  const str = (k: string) => (form.has(k) ? String(form.get(k)) : undefined);
  for (const k of ["title", "author", "category", "description"]) if (str(k) !== undefined) raw[k] = str(k);
  if (str("isFree") !== undefined) raw.isFree = str("isFree") === "true";
  if (str("prices") !== undefined) {
    try { raw.prices = JSON.parse(str("prices")!); } catch { errs.prices = "Prices were not valid."; }
  }
  const schema = partial ? fieldsSchema.partial() : fieldsSchema;
  const r = schema.safeParse(raw);
  if (r.success && (r.data as { category?: string }).category !== undefined && !(await getCategories()).includes((r.data as { category: string }).category)) errs.category = "Choose a category.";
  if (!r.success) for (const i of r.error.issues) errs[String(i.path[0])] ??= i.message;
  if (Object.keys(errs).length) throw new ApiError(400, Object.values(errs)[0], errs);
  const out: ParsedForm = { fields: (r as { data: ParsedForm["fields"] }).data };

  const cover = form.get("cover");
  if (cover instanceof File && cover.size > 0) {
    if (cover.size > MAX_COVER) throw new ApiError(413, "The cover image is too large. Please use one under 8 MB.", { cover: "Too large (8 MB max)." });
    const buf = Buffer.from(await cover.arrayBuffer());
    if (!sniffImage(buf)) throw new ApiError(415, "The cover must be a JPG, PNG or WebP image.", { cover: "Use a JPG, PNG or WebP image." });
    try {
      const meta = await sharp(buf).metadata();
      if ((meta.width ?? 0) < 300 || (meta.height ?? 0) < 400) throw new ApiError(422, "The cover is too small. Use an image at least 300 × 400 pixels.", { cover: "Minimum 300 × 400 px." });
      out.cover = { data: await sharp(buf).rotate().resize(900, 1350, { fit: "cover" }).jpeg({ quality: 86 }).toBuffer() };
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(415, "We couldn't read the cover image. It may be corrupted.", { cover: "Unreadable image." });
    }
  }

  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD) throw new ApiError(413, `The book file is too large. The limit is ${MAX_UPLOAD / 1024 / 1024} MB.`, { file: "Too large." });
    const ext = file.name.toLowerCase().split(".").pop() ?? "";
    if (!ALLOWED_MIME[ext]) throw new ApiError(415, "The book file must be a PDF, DOCX or TXT.", { file: "PDF, DOCX or TXT only." });
    // Browsers (esp. iOS/Android) sometimes send an empty or generic type, so only reject types that actively contradict the extension.
    if (file.type && file.type !== "application/octet-stream" && !ALLOWED_MIME[ext].includes(file.type))
      throw new ApiError(415, `The file's type (${file.type}) doesn't match its .${ext} extension.`, { file: "File type mismatch." });
    const data = Buffer.from(await file.arrayBuffer());
    try {
      const { kind, text } = await extractText(file.name, data); // also proves file integrity
      out.file = { name: file.name, mime: file.type || ALLOWED_MIME[ext][0], data, kind, text };
    } catch (e) {
      if (e instanceof ExtractError) throw new ApiError(422, e.message, { file: e.message });
      throw new ApiError(422, "We couldn't process this book file. Please check it opens correctly and try again.", { file: "Unreadable file." });
    }
  }
  return out;
}

export async function applyBook(bookId: string, p: ParsedForm) {
  const f = p.fields;
  await db.$transaction(async (t) => {
    await t.book.update({
      where: { id: bookId },
      data: {
        ...(f.title !== undefined && { title: f.title }), ...(f.author !== undefined && { author: f.author }), ...(f.category !== undefined && { category: f.category }),
        ...(f.description !== undefined && { description: f.description }), ...(f.isFree !== undefined && { isFree: f.isFree }),
        ...(p.file && { fileName: p.file.name, fileKind: p.file.kind, fileSize: p.file.data.length, content: p.file.text, totalChars: p.file.text.length }),
        ...(p.cover && { coverVersion: { increment: 1 } }),
      },
    });
    if (f.prices) {
      await t.bookPrice.deleteMany({ where: { bookId } });
      const rows = Object.entries(f.prices).filter(([c, v]) => (CURRENCIES as string[]).includes(c) && v > 0).map(([currency, amountMinor]) => ({ bookId, currency, amountMinor }));
      if (rows.length) await t.bookPrice.createMany({ data: rows });
    }
    if (p.cover) await t.cover.upsert({ where: { bookId }, create: { bookId, mime: "image/jpeg", data: new Uint8Array(p.cover.data) }, update: { data: new Uint8Array(p.cover.data) } });
    if (p.file) await t.bookFile.upsert({ where: { bookId }, create: { bookId, mime: p.file.mime, data: new Uint8Array(p.file.data) }, update: { mime: p.file.mime, data: new Uint8Array(p.file.data) } });
  });
}

/** Everything a book needs before an admin can review it. Returns field → message. */
export function submissionProblems(b: ReturnType<typeof serializeBook>) {
  const p: Record<string, string> = {};
  if (!b.title.trim()) p.title = "Add a book title.";
  if (!b.author.trim()) p.author = "Add the author's name.";
  if (!b.category) p.category = "Choose a category.";
  if (b.description.trim().length < 30) p.description = "Write a description of at least 30 characters.";
  if (!b.hasCover) p.cover = "Upload a book cover.";
  if (!b.hasFile) p.file = "Upload the book file (PDF, DOCX or TXT).";
  else if (b.totalChars < 500) p.file = "The book file contains very little text (under 500 characters).";
  if (!b.isFree) for (const c of CURRENCIES) if (!(b.prices[c] > 0)) p[`price_${c}`] = `Set a ${c} price.`;
  return p;
}
