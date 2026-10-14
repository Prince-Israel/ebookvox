/**
 * Fills the Reader catalogue with free, English, public-domain books from Project Gutenberg — including a large
 * share of spiritual titles (sermons, devotionals, theology) — each with its cover image.
 *
 *   npx tsx prisma/seed-catalog.ts --target 1500
 *
 * Only works Gutenberg lists as public domain in the US are used, so they are free to read with no royalty owed to anyone.
 * Safe to re-run: books already in the catalogue are skipped, and it stops at --target new books.
 */
import "dotenv/config";
import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { upsertBook } from "../src/lib/books";
import { toChapters } from "../src/lib/gutenberg";

const db = new PrismaClient();
const arg = (n: string, d: number) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? Number(process.argv[i + 1]) || d : d; };
const TARGET = arg("target", 1500);
const CONCURRENCY = arg("concurrency", 5);
const SPIRITUAL_SHARE = 0.22;
const CACHE = path.join(process.cwd(), "data", "seed-cache");
const PUBLISHER = { id: "ebookvox-classics", name: "Ebookvox Classics" };

type Row = { id: number; title: string; subtitle: string; author: string; years: string; subjects: string[]; shelves: string; spiritual: boolean; category: string };

// ---- tiny CSV reader (the catalogue has quoted fields with embedded newlines) ----
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c !== "\r") cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

const SPIRITUAL = /sermon|christian|theolog|bible|devotion|prayer|church|gospel|spiritual|religio|jesus|hymn|methodis|baptist|catholic|puritan|missionar|psalm|holiness|faith|salvation|revival|preach|pastor|evangel|saint|monastic|mysticism/i;
const SKIP = /periodical|dictionar|cookbook|cooking|catalog|encyclop|almanac|gazetteer|directory|manual|textbook|grammar|phrase ?book|index to|bibliograph|timetable|price list|reports? of|statutes|legal cases/i;

function categoryOf(subjects: string, shelves: string, spiritual: boolean): string {
  const t = `${subjects} ${shelves}`.toLowerCase();
  if (spiritual) return "Religion & Spirituality";
  if (/poetry|poems|poet\b/.test(t)) return "Poetry";
  if (/plays\/films\/dramas|drama/.test(t)) return "Drama";
  if (/travel writing|voyages and travels|description and travel/.test(t)) return "Travel";
  if (/science fiction/.test(t)) return "Science Fiction";
  if (/fantasy|fairy tales|myths|legends/.test(t)) return "Fantasy";
  if (/detective|mystery|crime/.test(t)) return "Mystery";
  if (/horror|gothic|ghost|supernatural/.test(t)) return "Horror";
  if (/romance|love stories|courtship/.test(t)) return "Romance";
  if (/biograph|autobiograph|memoir|diaries|letters/.test(t)) return "Biography";
  if (/philosoph|ethics|logic/.test(t)) return "Philosophy";
  if (/children|juvenile|young adult/.test(t)) return "Children's";
  if (/adventure|sea stories|western/.test(t)) return "Adventure";
  if (/humor|humour|satire|comedy/.test(t)) return "Humor";
  if (/histor|war\b|civilization/.test(t)) return "Historical";
  if (/educat|school|teaching/.test(t)) return "Education";
  if (/economic|business|trade|finance/.test(t)) return "Business";
  if (/psycholog|self-help|conduct of life|success/.test(t)) return "Self-Development";
  if (/science|nature|natural history|medicine|health/.test(t)) return "Non-fiction";
  if (/fiction|novel|stories|short stories/.test(t)) return "Classic Fiction";
  return "Non-fiction";
}

/** "Austen, Jane, 1775-1817" → { name: "Jane Austen", years: "1775–1817" } (first listed author only). */
function person(raw: string) {
  const first = raw.split(";")[0].replace(/\[[^\]]*\]/g, "").replace(/\([^)]*\)/g, "").trim();
  const Y = "\\d{1,4}\\??(?:\\s*BCE)?";
  const years = first.match(new RegExp(`(${Y})\\s*-\\s*(${Y})?\\s*$`));
  const base = first.replace(new RegExp(`,?\\s*(${Y})?\\s*-\\s*(${Y})?\\s*$`), "").replace(/,\s*$/, "").trim();
  const parts = base.split(",").map((s) => s.trim()).filter(Boolean);
  const name = parts.length >= 2 ? `${parts.slice(1).join(" ")} ${parts[0]}` : parts[0] ?? "";
  return { name: name.replace(/\s+/g, " ").trim(), years: years ? `${years[1]}–${years[2] ?? ""}`.replace(/–$/, "") : "" };
}

async function loadCatalog(): Promise<Row[]> {
  await mkdir(CACHE, { recursive: true });
  const file = path.join(CACHE, "pg_catalog.csv");
  if (!existsSync(file) || statSync(file).size < 1_000_000) {
    const res = await fetch("https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv", { signal: AbortSignal.timeout(180_000) });
    if (!res.ok) throw new Error(`catalogue download failed (${res.status})`);
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
  }
  const rows = parseCsv(await readFile(file, "utf8"));
  const out: Row[] = [];
  for (const r of rows.slice(1)) {
    const [id, type, , title, lang, authors, subjects, , shelves] = r;
    if (type !== "Text" || lang !== "en" || !title || !authors || /various|unknown/i.test(authors)) continue;
    const blob = `${subjects} ${shelves}`;
    if (SKIP.test(blob) || SKIP.test(title) || /^(anonymous)$/i.test(authors.trim())) continue;
    const [t0, ...rest] = title.split("\n");
    const { name, years } = person(authors);
    if (!name || t0.trim().length < 2) continue;
    // Spiritual = Gutenberg files it under Religion/Spirituality or Christianity, or its subjects name sermons, theology or devotion.
    const spiritual = (/Religion\/Spirituality|Christianity|Bibles|Sermon/i.test(shelves) || /sermon|theolog|devotion|\bprayers?\b|\bhymns?\b|psalm|\bbible\b|gospel/i.test(subjects)) && !/freethought|atheis|agnostic|infidel|rationalis|spiritualism/i.test(blob);
    out.push({ id: Number(id), title: t0.trim().replace(/\s+/g, " ").slice(0, 190), subtitle: rest.join(" ").trim(), author: name.slice(0, 140), years, subjects: subjects.split(";").map((s) => s.trim().split(" -- ")[0]).filter(Boolean), shelves, spiritual, category: categoryOf(subjects, shelves, spiritual) });
  }
  return out;
}

/** Gutenberg's own popularity lists, so the best-loved titles come first. */
async function popularIds(): Promise<number[]> {
  try {
    const html = await (await fetch("https://www.gutenberg.org/browse/scores/top", { signal: AbortSignal.timeout(60_000) })).text();
    return [...new Set([...html.matchAll(/\/ebooks\/(\d+)/g)].map((m) => Number(m[1])))];
  } catch { return []; }
}

// deterministic shuffle so a re-run picks the same sample
function shuffle<T>(a: T[], seed = 42) {
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function select(all: Row[], have: Set<number>, popular: number[]): Row[] {
  const byId = new Map(all.map((r) => [r.id, r]));
  const perAuthor = new Map<string, number>();
  const picked: Row[] = [];
  const take = (r: Row | undefined, cap: number) => {
    if (!r || have.has(r.id) || picked.some((p) => p.id === r.id)) return false;
    const n = perAuthor.get(r.author) ?? 0;
    if (n >= cap) return false;
    perAuthor.set(r.author, n + 1);
    picked.push(r);
    return true;
  };
  const wantSpiritual = Math.round(TARGET * SPIRITUAL_SHARE);
  let sp = 0, general = 0;
  for (const id of popular) { const r = byId.get(id); if (r && take(r, 6)) { if (r.spiritual) sp++; else general++; } if (picked.length >= TARGET * 0.25) break; }
  for (const r of shuffle(all.filter((x) => x.spiritual))) { if (sp >= wantSpiritual) break; if (take(r, 14)) sp++; }
  for (const r of shuffle(all.filter((x) => !x.spiritual))) { if (picked.length >= TARGET * 1.12) break; if (take(r, 3)) general++; }
  return picked;
}

async function download(id: number): Promise<string | null> {
  const s = String(id);
  const dir = s.length === 1 ? "0" : s.slice(0, -1).split("").join("/");
  const urls = [`https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`, `https://gutenberg.pglaf.org/${dir}/${id}/${id}-0.txt`, `https://gutenberg.pglaf.org/${dir}/${id}/${id}.txt`];
  for (const url of urls) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(90_000) });
        if (res.status === 429) { await new Promise((r) => setTimeout(r, 4000 * (attempt + 1))); continue; }
        if (!res.ok) break;
        return await res.text();
      } catch { await new Promise((r) => setTimeout(r, 1500)); }
    }
  }
  return null;
}

async function coverOk(url: string) {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(20_000) });
    return res.ok && (res.headers.get("content-type") ?? "").startsWith("image/");
  } catch { return false; }
}

function regroup(ch: Array<{ title: string; content: string }>) {
  // The book schema allows 500 chapters of up to 2M characters; merge neighbours if a text splits finer than that.
  if (ch.length <= 480) return ch;
  const size = Math.ceil(ch.length / 400);
  const out: typeof ch = [];
  for (let i = 0; i < ch.length; i += size) { const g = ch.slice(i, i + size); out.push({ title: g.length > 1 ? `${g[0].title} – ${g[g.length - 1].title}`.slice(0, 190) : g[0].title, content: g.map((c) => c.content).join("\n\n") }); }
  return out;
}

/** Re-applies the category rules to books already in the catalogue (after tuning them). */
async function recategorize() {
  const all = await loadCatalog();
  let n = 0;
  for (const r of all) {
    const res = await db.book.updateMany({ where: { externalId: `gutenberg-${r.id}`, NOT: { category: r.category } }, data: { category: r.category } });
    n += res.count;
  }
  console.log(`Recategorized ${n} books.`);
}

async function main() {
  if (process.argv.includes("--recategorize")) return recategorize();
  const have = new Set((await db.book.findMany({ where: { externalId: { startsWith: "gutenberg-" } }, select: { externalId: true } })).map((b) => Number(b.externalId!.slice(10))));
  console.log(`Already in catalogue: ${have.size}. Target: ${TARGET} new books.`);
  const [all, popular] = await Promise.all([loadCatalog(), popularIds()]);
  console.log(`Catalogue rows usable: ${all.length}; popular ids: ${popular.length}`);
  const queue = select(all, have, popular);
  console.log(`Selected ${queue.length} candidates (${queue.filter((r) => r.spiritual).length} spiritual).`);

  let added = 0, skipped = 0, i = 0;
  const started = Date.now();
  async function worker() {
    while (added < TARGET) {
      const r = queue[i++];
      if (!r) return;
      try {
        const coverUrl = `https://www.gutenberg.org/cache/epub/${r.id}/pg${r.id}.cover.medium.jpg`;
        if (!(await coverOk(coverUrl))) { skipped++; continue; }
        const raw = await download(r.id);
        if (!raw || raw.length < 20_000 || raw.length > 4_000_000) { skipped++; continue; }
        const chapters = regroup(toChapters(raw, r.title)).filter((c) => c.content.trim().length > 0).map((c) => ({ title: c.title.slice(0, 190), content: c.content.slice(0, 1_900_000) }));
        if (!chapters.length) { skipped++; continue; }
        const subj = r.subjects.slice(0, 4).join("; ");
        const description = [
          `${r.title}${r.subtitle ? ` — ${r.subtitle}` : ""} by ${r.author}${r.years ? ` (${r.years})` : ""}.`,
          subj ? `Subjects: ${subj}.` : "",
          "A public-domain work, free to read and listen to on Ebookvox.",
        ].filter(Boolean).join(" ").slice(0, 4900);
        await upsertBook(
          { externalId: `gutenberg-${r.id}`, publisherId: PUBLISHER.id, publisherName: PUBLISHER.name, title: r.title, author: r.author, category: r.category, description, language: "en", coverUrl, isFree: true, chapters },
          { autoApprove: true },
        );
        added++;
        if (added % 25 === 0) console.log(`  ${added} added, ${skipped} skipped — ${Math.round((Date.now() - started) / 1000)}s`);
      } catch (e) {
        skipped++;
        console.log(`  #${r.id} failed: ${(e as Error).message.slice(0, 120)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const total = await db.book.count({ where: { status: "APPROVED" } });
  console.log(`Done. Added ${added}, skipped ${skipped}. Approved books in the catalogue: ${total}.`);
}

main().then(() => db.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
