/**
 * Loads the library files made by scripts/export-catalogue.py into this database.
 *   npx tsx prisma/import-catalogue.ts                 # reads ./catalogue
 *   npx tsx prisma/import-catalogue.ts /path/to/folder
 * Safe to run again and again (and to resume after an interruption): books are matched by their Gutenberg id, so nothing is duplicated, and
 * books the site already has (for example the starter books) are left as they are.
 */
import "dotenv/config";
import { createReadStream, readdirSync, existsSync } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const dir = path.resolve(process.argv[2] ?? "catalogue");
const cuid = () => "c" + randomBytes(12).toString("hex");

async function* lines(file: string) {
  for await (const l of createInterface({ input: createReadStream(file).pipe(createGunzip()), crlfDelay: Infinity })) if (l) yield JSON.parse(l);
}

async function main() {
  if (!existsSync(path.join(dir, "books.ndjson.gz"))) throw new Error(`books.ndjson.gz not found in ${dir}`);
  const t0 = Date.now();
  const have = new Map((await db.book.findMany({ where: { externalId: { not: null } }, select: { id: true, externalId: true, coverUrl: true, chapterCount: true } })).map((b) => [b.externalId!, b]));
  const pubId = new Map<string, string>();
  const created = new Set<string>(); // books added by this run (their chapters are loaded; existing books are left alone)
  let added = 0, kept = 0, covered = 0, prices = 0;

  for await (const r of lines(path.join(dir, "books.ndjson.gz"))) {
    if (r.t === "publisher") {
      pubId.set(r.externalId, (await db.publisher.upsert({ where: { externalId: r.externalId }, update: {}, create: { externalId: r.externalId, name: r.name } })).id);
    } else if (r.t === "book") {
      const cur = have.get(r.externalId);
      if (cur) {
        kept++;
        if (!cur.coverUrl && r.coverUrl) { await db.book.update({ where: { id: cur.id }, data: { coverUrl: r.coverUrl } }); covered++; }
        continue;
      }
      const b = await db.book.create({ data: { externalId: r.externalId, publisherId: pubId.get(r.publisherExternalId)!, title: r.title, author: r.author, category: r.category, description: r.description, language: r.language, coverUrl: r.coverUrl, coverHue: r.coverHue, status: r.status, isFree: r.isFree, baseCurrency: r.baseCurrency, totalChars: r.totalChars, chapterCount: r.chapterCount, createdAt: new Date(r.createdAt), approvedAt: r.approvedAt ? new Date(r.approvedAt) : null } });
      have.set(r.externalId, { id: b.id, externalId: r.externalId, coverUrl: r.coverUrl, chapterCount: r.chapterCount });
      created.add(r.externalId);
      added++;
      if (added % 500 === 0) console.log(`  ${added} books added…`);
    } else if (r.t === "price" && created.has(r.bookExternalId)) {
      await db.bookPrice.create({ data: { bookId: have.get(r.bookExternalId)!.id, currency: r.currency, amountMinor: r.amountMinor } });
      prices++;
    }
  }
  console.log(`Books: ${added} added, ${kept} already on the site${covered ? `, ${covered} given a cover` : ""}.`);

  // chapters: for every book that does not have all its chapters yet (INSERT OR IGNORE, so an interrupted run can simply be started again).
  // A book that is already complete, such as the starter books, is never touched.
  const counts = new Map((await db.chapter.groupBy({ by: ["bookId"], _count: { _all: true } })).map((d) => [d.bookId, d._count._all]));
  const complete = new Set([...have.values()].filter((b) => b.chapterCount > 0 && (counts.get(b.id) ?? 0) >= b.chapterCount).map((b) => b.id));
  let ch = 0, skipped = 0, batch: Array<[string, string, number, string, string, number, number]> = [];
  const flush = async () => {
    if (!batch.length) return;
    const ph = batch.map(() => "(?,?,?,?,?,?,?)").join(",");
    await db.$executeRawUnsafe(`INSERT OR IGNORE INTO "Chapter" ("id","bookId","index","title","content","startChar","charCount") VALUES ${ph}`, ...batch.flat());
    ch += batch.length; batch = [];
  };
  const files = readdirSync(dir).filter((f) => /^chapters-\d+\.ndjson\.gz$/.test(f)).sort();
  for (const f of files) {
    for await (const r of lines(path.join(dir, f))) {
      const book = have.get(r.b);
      if (!book || complete.has(book.id)) { skipped++; continue; }
      batch.push([cuid(), book.id, r.i, r.t, r.c, r.s, r.n]);
      if (batch.length >= 60) await flush();
    }
    await flush();
    console.log(`  ${f} done (${ch} chapters so far)`);
  }
  console.log(`Chapters: ${ch} added, ${skipped} skipped. Prices: ${prices}. Took ${Math.round((Date.now() - t0) / 1000)}s.`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => db.$disconnect());
