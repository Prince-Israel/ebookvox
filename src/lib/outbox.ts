import { createHmac } from "node:crypto";
import { db } from "./db";

type Tx = Pick<typeof db, "outboxEvent">;

export const outboxEnabled = () => !!(process.env.PUBLISHER_WEBHOOK_URL && process.env.PUBLISHER_WEBHOOK_SECRET);

export async function enqueue(type: string, data: object, tx: Tx = db) {
  if (!outboxEnabled()) return;
  await tx.outboxEvent.create({ data: { type, payload: JSON.stringify({ type, data, sentAt: new Date().toISOString() }) } });
}

let flushing = false;
/** Delivers due events to the Publisher platform, signed with HMAC-SHA256. Failed deliveries back off and retry. */
export async function flushOutbox() {
  if (flushing || !outboxEnabled()) return;
  flushing = true;
  try {
    const due = await db.outboxEvent.findMany({ where: { deliveredAt: null, attempts: { lt: 12 }, nextAttemptAt: { lte: new Date() } }, orderBy: { createdAt: "asc" }, take: 25 });
    for (const e of due) {
      try {
        const res = await fetch(process.env.PUBLISHER_WEBHOOK_URL!, {
          method: "POST",
          headers: { "content-type": "application/json", "x-ebookvox-signature": createHmac("sha256", process.env.PUBLISHER_WEBHOOK_SECRET!).update(e.payload).digest("hex") },
          body: e.payload,
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await db.outboxEvent.update({ where: { id: e.id }, data: { deliveredAt: new Date(), attempts: { increment: 1 }, lastError: null } });
      } catch (err) {
        const attempts = e.attempts + 1;
        await db.outboxEvent.update({ where: { id: e.id }, data: { attempts, lastError: String((err as Error).message).slice(0, 200), nextAttemptAt: new Date(Date.now() + Math.min(3600_000, 2 ** attempts * 5_000)) } });
      }
    }
  } finally {
    flushing = false;
  }
}
