import { db } from "./db";

/** The public address of the Reader (APP_URL), without a trailing slash. */
export const siteUrl = () => (process.env.APP_URL ?? "http://localhost:3230").replace(/\/$/, "");
export const abs = (path: string) => `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
export const SITE_NAME = "Ebookvox";
export const DEFAULT_OG = "/og-default.png";

import { clip, displayAuthor, slugify } from "./slug";
export { clip, displayAuthor, slugify };

export function bookTitleTag(b: { title: string; author: string; isFree: boolean }) {
  const t = b.title.replace(/\s*[;:].*$/, "").trim() || b.title; // "Moby Dick; Or, The Whale" → "Moby Dick"
  return b.isFree ? `${t} by ${displayAuthor(b.author)}: free ebook and audiobook` : `${t} by ${displayAuthor(b.author)}: read and listen online`;
}
export function bookDescriptionTag(b: { title: string; author: string; description: string; isFree: boolean }) {
  const lead = `${b.isFree ? "Read or listen to" : "Read and listen to"} ${b.title} by ${displayAuthor(b.author)} on Ebookvox. `;
  return clip(`${lead}${b.description}`, 158);
}

// ---- the lists behind the category and author pages (cached for a few minutes: they come from thousands of rows) ----
type Cache<T> = { at: number; v: T };
let catCache: Cache<Array<{ name: string; slug: string; count: number }>> | null = null;
let authorCache: Cache<Array<{ name: string; slug: string; count: number }>> | null = null;
const TTL = 10 * 60_000;

export async function categories() {
  if (catCache && Date.now() - catCache.at < TTL) return catCache.v;
  const rows = await db.book.groupBy({ by: ["category"], where: { status: "APPROVED" }, _count: { _all: true } });
  const v = rows.map((r) => ({ name: r.category, slug: slugify(r.category), count: r._count._all })).filter((c) => c.slug).sort((a, b) => b.count - a.count);
  catCache = { at: Date.now(), v };
  return v;
}

export async function authors() {
  if (authorCache && Date.now() - authorCache.at < TTL) return authorCache.v;
  const rows = await db.book.groupBy({ by: ["author"], where: { status: "APPROVED" }, _count: { _all: true } });
  const seen = new Map<string, { name: string; slug: string; count: number }>();
  for (const r of rows) {
    const slug = slugify(displayAuthor(r.author));
    if (!slug) continue;
    const cur = seen.get(slug);
    if (cur) cur.count += r._count._all; else seen.set(slug, { name: r.author, slug, count: r._count._all });
  }
  const v = [...seen.values()];
  authorCache = { at: Date.now(), v };
  return v;
}

/** Drops the cached lists (used by tests and after bulk imports). */
export function resetSeoCache() { catCache = null; authorCache = null; }
