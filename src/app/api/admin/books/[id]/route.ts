import { z } from "zod";
import { db } from "@/lib/db";
import { readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { approveBook } from "@/lib/books";
import { enqueue, flushOutbox } from "@/lib/outbox";

export const POST = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await params;
  const d = z.object({ action: z.enum(["approve", "reject", "unpublish"]), reason: z.string().trim().max(500).optional() }).parse(await readJson(req));
  if (d.action === "approve") await approveBook(id);
  else if (d.action === "reject") {
    const b = await db.book.update({ where: { id }, data: { status: "REJECTED", rejectionReason: d.reason || "Did not meet our content guidelines." } });
    if (b.externalId) { await enqueue("book.status", { externalId: b.externalId, status: "REJECTED", reason: b.rejectionReason }); void flushOutbox().catch(() => {}); }
  }
  else await db.book.update({ where: { id }, data: { status: "PENDING" } });
});
