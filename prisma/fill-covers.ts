/**
 * Adds cover art to books that have none, using the Project Gutenberg cover for each `gutenberg-<id>` book.
 * Safe to run any time and as often as you like; only books without a cover are touched.
 *   npx tsx prisma/fill-covers.ts            # free and paid books
 *   npx tsx prisma/fill-covers.ts --free     # only the free books
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const onlyFree = process.argv.includes("--free");

async function coverOk(url: string) {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(20_000) });
    return res.ok && (res.headers.get("content-type") ?? "").startsWith("image/");
  } catch { return false; }
}

async function main() {
  const books = await db.book.findMany({
    where: { OR: [{ coverUrl: null }, { coverUrl: "" }], externalId: { startsWith: "gutenberg-" }, ...(onlyFree ? { isFree: true } : {}) },
    select: { id: true, title: true, externalId: true },
  });
  console.log(`${books.length} book(s) without a cover.`);
  let added = 0, missing = 0;
  for (const b of books) {
    const gid = b.externalId!.replace("gutenberg-", "");
    const url = `https://www.gutenberg.org/cache/epub/${gid}/pg${gid}.cover.medium.jpg`;
    if (await coverOk(url)) { await db.book.update({ where: { id: b.id }, data: { coverUrl: url } }); added++; console.log("  cover added:", b.title); }
    else { missing++; console.log("  no cover found:", b.title); }
  }
  console.log(`Done: ${added} added, ${missing} without a cover available.`);
}

main().finally(() => db.$disconnect());
