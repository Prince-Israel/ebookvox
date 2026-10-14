import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "./db";

const readerUrl = () => (process.env.READER_URL ?? "http://localhost:3230").replace(/\/$/, "");
const appUrl = () => (process.env.APP_URL ?? "http://localhost:3240").replace(/\/$/, "");

/** Split extracted text into chapters: "# Heading" lines start chapters, otherwise ~12k-character parts. */
export function buildChapters(text: string, fallbackTitle: string) {
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const chapters: Array<{ title: string; blocks: string[] }> = [];
  let cur: { title: string; blocks: string[] } | null = null;
  for (const b of blocks) {
    if (b.startsWith("# ") && !b.includes("\n")) {
      if (cur && cur.blocks.join("").length > 200) chapters.push(cur);
      cur = { title: b.slice(2).trim().slice(0, 190), blocks: [] };
    } else {
      cur ??= { title: fallbackTitle, blocks: [] };
      cur.blocks.push(b);
    }
  }
  if (cur?.blocks.length) chapters.push(cur);
  // No headings found (or one giant chapter): cut into parts.
  const out: Array<{ title: string; content: string }> = [];
  for (const c of chapters) {
    const total = c.blocks.join("\n\n");
    if (total.length <= 30_000) { out.push({ title: c.title, content: total }); continue; }
    let part: string[] = []; let len = 0; let n = 1;
    for (const b of c.blocks) {
      part.push(b); len += b.length;
      if (len > 12_000) { out.push({ title: `${c.title} (part ${n++})`, content: part.join("\n\n") }); part = []; len = 0; }
    }
    if (part.length) out.push({ title: `${c.title} (part ${n})`, content: part.join("\n\n") });
  }
  return out.length ? out : [{ title: fallbackTitle, content: text }];
}

/** Sends an admin-approved book to the Reader catalogue (authenticated server-to-server). */
export async function publishToReader(bookId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const b = await db.book.findUnique({ where: { id: bookId }, include: { publisher: true, prices: true, cover: { select: { bookId: true } } } });
  if (!b) return { ok: false, error: "Book not found." };
  const prices = Object.fromEntries(b.prices.map((p) => [p.currency, p.amountMinor]));
  try {
    const res = await fetch(`${readerUrl()}/api/publisher/books`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-publisher-key": process.env.PUBLISHER_API_KEY ?? "" },
      body: JSON.stringify({
        externalId: b.id, publisherId: b.publisherId, publisherName: b.publisher.publisherName, title: b.title, author: b.author, category: b.category,
        description: b.description, isFree: b.isFree, prices: b.isFree ? undefined : prices,
        coverUrl: b.cover ? `${appUrl()}/api/covers/${b.id}?v=${b.coverVersion}` : null,
        chapters: buildChapters(b.content, b.title), approved: true,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return { ok: false, error: `The Reader catalogue rejected the book (${res.status}): ${(await res.json().catch(() => null))?.error ?? "unknown error"}` };
    return { ok: true };
  } catch {
    return { ok: false, error: "The Reader catalogue could not be reached. It will be retried." };
  }
}

export function validSignature(raw: string, signature: string | null) {
  const secret = process.env.READER_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
