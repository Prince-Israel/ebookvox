import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { abs, authors, categories } from "@/lib/seo";

export const dynamic = "force-dynamic";

let cache: { at: number; v: MetadataRoute.Sitemap } | null = null;

/** Every public page: the main pages, every category, every author with 2+ books, and every approved book. Cached for an hour. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (cache && Date.now() - cache.at < 3600_000) return cache.v;
  const now = new Date();
  const top = ["/home", "/books", "/category", "/text-to-speech", "/pdf-to-audio", "/subscribe", "/privacy", "/terms", "/delete-account"];
  const v: MetadataRoute.Sitemap = top.map((p, i) => ({ url: abs(p), lastModified: now, changeFrequency: i < 3 ? "daily" : "monthly", priority: i === 0 ? 1 : i < 5 ? 0.8 : 0.3 }));
  for (const c of await categories()) v.push({ url: abs(`/category/${c.slug}`), lastModified: now, changeFrequency: "weekly", priority: 0.7 });
  for (const a of (await authors()).filter((x) => x.count >= 2)) v.push({ url: abs(`/authors/${a.slug}`), lastModified: now, changeFrequency: "monthly", priority: 0.5 });
  const books = await db.book.findMany({ where: { status: "APPROVED" }, select: { id: true, approvedAt: true, createdAt: true }, orderBy: { createdAt: "desc" } });
  for (const b of books) v.push({ url: abs(`/books/${b.id}`), lastModified: b.approvedAt ?? b.createdAt, changeFrequency: "monthly", priority: 0.6 });
  cache = { at: Date.now(), v };
  return v;
}
