import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, rateLimit, readJson, route } from "@/lib/api";
import { requirePublisher } from "@/lib/auth";
import { notifyAdmins } from "@/lib/notify";
import { emitEvent } from "@/lib/events";

export const POST = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requirePublisher();
  rateLimit(`reply:${u.id}`, 30, 3600_000);
  const { message } = z.object({ message: z.string().trim().min(1, "Write a message first.").max(5000) }).parse(await readJson(req));
  const t = await db.ticket.findFirst({ where: { id: (await params).id, userId: u.id } });
  if (!t) throw new ApiError(404, "We couldn't find that ticket.");
  if (t.status === "CLOSED") throw new ApiError(409, "This ticket is closed, so you can't add messages. Please open a new ticket if you still need help.");
  await db.$transaction([
    db.ticketMessage.create({ data: { ticketId: t.id, authorId: u.id, authorRole: "PUBLISHER", body: message } }),
    db.ticket.update({ where: { id: t.id }, data: { status: "WAITING_ADMIN" } }),
  ]);
  await emitEvent("ticket.message", { ticketId: t.id, subject: t.subject, from: "PUBLISHER", name: u.publisherName, email: u.email, created: false });
  await notifyAdmins("SUPPORT", "Publisher replied", `${u.publisherName}: ${t.subject}`, "/admin/support");
});
