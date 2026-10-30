/**
 * Downloads every book's cover into the Reader's cover cache now, so the Books pages show covers instantly instead of fetching them one by one
 * the first time someone browses. Safe to stop and run again (covers already saved are skipped).
 *   nohup npx tsx prisma/warm-covers.ts > warm.log 2>&1 &
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { mkdir, access, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const DIR = path.join(process.cwd(), "data", "cover-cache"); // the same cache the cover route reads (src/app/api/books/[id]/cover)
const exists = (f: string) => access(f).then(() => true, () => false);

async function main() {
  await mkdir(DIR, { recursive: true });
  const books = await db.book.findMany({ where: { status: "APPROVED", coverUrl: { not: null } }, select: { coverUrl: true } });
  let todo = books.map((b) => b.coverUrl!).filter((u, i, a) => a.indexOf(u) === i);
  console.log(`${todo.length} covers to check.`);
  let saved = 0, had = 0, failed = 0, n = 0;
  const worker = async () => {
    for (let u = todo.pop(); u; u = todo.pop()) {
      const file = path.join(DIR, createHash("sha1").update(u).digest("hex"));
      if (await exists(file)) { had++; continue; }
      try {
        const res = await fetch(u, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
        const type = res.headers.get("content-type") ?? "";
        if (!res.ok || !type.startsWith("image/")) throw new Error(String(res.status));
        await writeFile(file, Buffer.concat([Buffer.from([type.includes("png") ? 1 : 0]), Buffer.from(await res.arrayBuffer())]));
        saved++;
      } catch { failed++; }
      if (++n % 250 === 0) console.log(`  ${n} done: ${saved} saved, ${had} already there, ${failed} failed`);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker)); // four at a time: gentle on the server and on Gutenberg
  console.log(`Finished: ${saved} saved, ${had} already there, ${failed} failed (run again to retry those).`);
}
main().finally(() => db.$disconnect());
