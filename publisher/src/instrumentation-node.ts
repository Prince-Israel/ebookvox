import { db } from "./lib/db";
import { publishToReader } from "./lib/reader";

// Retries publishing for books that were approved but couldn't reach the Reader yet.
export function start() {
  setInterval(async () => {
    try {
      const pending = await db.book.findMany({ where: { status: "APPROVED" }, take: 5 });
      for (const b of pending) {
        const r = await publishToReader(b.id);
        if (r.ok) await db.book.update({ where: { id: b.id }, data: { status: "PUBLISHED", publishedAt: new Date(), syncError: null } });
        else await db.book.update({ where: { id: b.id }, data: { syncError: r.error } });
      }
    } catch (e) { console.error("[publish-retry]", e); }
  }, 60_000);
}
