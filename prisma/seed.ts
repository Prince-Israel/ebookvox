/**
 * Seeds the catalogue with public-domain titles from Project Gutenberg (downloaded once and
 * cached in data/seed-cache) published by "Ebookvox Classics", plus the admin account.
 * Real books from the Publisher platform arrive through POST /api/publisher/books.
 */
import "dotenv/config";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { upsertBook } from "../src/lib/books";
import { toChapters } from "../src/lib/gutenberg";

const db = new PrismaClient();
const CACHE = path.join(process.cwd(), "data", "seed-cache");

type Seed = { gid: number; title: string; author: string; category: string; description: string; free: boolean; prices?: [number, number, number, number] };

const BOOKS: Seed[] = [
  { gid: 1342, title: "Pride and Prejudice", author: "Jane Austen", category: "Classic Fiction", free: true, description: "Elizabeth Bennet and the proud Mr. Darcy navigate manners, money and misjudgement in Austen's sparkling comedy of love and class." },
  { gid: 11, title: "Alice's Adventures in Wonderland", author: "Lewis Carroll", category: "Fantasy", free: true, description: "Follow a curious girl down a rabbit hole into a world of riddles, tea parties and a very unreasonable Queen." },
  { gid: 1661, title: "The Adventures of Sherlock Holmes", author: "Arthur Conan Doyle", category: "Mystery", free: true, description: "Twelve classic cases of the world's greatest detective, narrated by his loyal friend Dr. Watson." },
  { gid: 84, title: "Frankenstein", author: "Mary Shelley", category: "Gothic Fiction", free: true, description: "A young scientist's obsession creates life — and a creature who demands to know why he was made." },
  { gid: 35, title: "The Time Machine", author: "H. G. Wells", category: "Science Fiction", free: true, description: "A Victorian inventor travels to the year 802,701 and discovers what humanity has become." },
  { gid: 132, title: "The Art of War", author: "Sun Tzu", category: "Philosophy", free: true, description: "The ancient Chinese treatise on strategy, leadership and winning without fighting (Lionel Giles translation)." },
  { gid: 345, title: "Dracula", author: "Bram Stoker", category: "Horror", free: false, prices: [320000, 549, 599, 699], description: "Told through letters and diaries, Stoker's masterpiece follows the hunt for a centuries-old count who has come to England." },
  { gid: 174, title: "The Picture of Dorian Gray", author: "Oscar Wilde", category: "Classic Fiction", free: false, prices: [250000, 449, 499, 549], description: "A beautiful young man stays unchanged while his portrait absorbs every sin. Wilde's only novel, wickedly witty and darkly moral." },
  { gid: 120, title: "Treasure Island", author: "Robert Louis Stevenson", category: "Adventure", free: false, prices: [250000, 449, 499, 549], description: "Pirates, a treasure map and Long John Silver: the adventure that defined the genre." },
  { gid: 43, title: "Strange Case of Dr Jekyll and Mr Hyde", author: "Robert Louis Stevenson", category: "Gothic Fiction", free: false, prices: [200000, 349, 399, 449], description: "A respectable doctor and a violent stranger share a terrible secret in foggy London." },
  { gid: 1400, title: "Great Expectations", author: "Charles Dickens", category: "Classic Fiction", free: false, prices: [380000, 599, 649, 749], description: "Orphan Pip is lifted into a world of expectations he never imagined — and learns what they cost." },
];

async function fetchBook(gid: number): Promise<string> {
  const file = path.join(CACHE, `${gid}.txt`);
  if (existsSync(file)) return readFile(file, "utf8");
  await mkdir(CACHE, { recursive: true });
  const s = String(gid);
  const dir = s.length === 1 ? "0" : s.slice(0, -1).split("").join("/");
  const urls = [
    `https://gutenberg.pglaf.org/${dir}/${gid}/${gid}-0.txt`,
    `https://gutenberg.pglaf.org/${dir}/${gid}/${gid}.txt`,
    `https://www.gutenberg.org/cache/epub/${gid}/pg${gid}.txt`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      if (!res.ok) throw new Error(String(res.status));
      const t = await res.text();
      if (t.length < 20000) throw new Error("too short");
      await writeFile(file, t);
      return t;
    } catch (e) {
      console.log(`  ${url}: ${(e as Error).message}`);
    }
  }
  throw new Error(`Could not download Gutenberg #${gid}`);
}


async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@ebookvox.app").toLowerCase();
  const pw = process.env.ADMIN_PASSWORD ?? "ChangeMe!2026";
  await db.user.upsert({
    where: { email },
    create: { email, firstName: "Ebookvox", lastName: "Admin", role: "ADMIN", country: "NG", currency: "NGN", passwordHash: await bcrypt.hash(pw, 12), emailVerifiedAt: new Date() },
    update: { role: "ADMIN" },
  });
  console.log(`Admin account: ${email}`);

  for (const b of BOOKS) {
    const externalId = `gutenberg-${b.gid}`;
    if (await db.book.findUnique({ where: { externalId } })) { console.log("  exists:", b.title); continue; }
    process.stdout.write(`  ${b.title} … `);
    const chapters = toChapters(await fetchBook(b.gid), b.title);
    const [ngn, gbp, eur, usd] = b.prices ?? [0, 0, 0, 0];
    await upsertBook(
      {
        externalId, publisherId: "ebookvox-classics", publisherName: "Ebookvox Classics", title: b.title, author: b.author, category: b.category,
        description: b.description, language: "en", coverUrl: `https://www.gutenberg.org/cache/epub/${b.gid}/pg${b.gid}.cover.medium.jpg`, isFree: b.free,
        prices: b.free ? undefined : { NGN: ngn, GBP: gbp, EUR: eur, USD: usd }, chapters,
      },
      { autoApprove: true },
    );
    console.log(`${chapters.length} chapters`);
  }
}

main().then(() => db.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
