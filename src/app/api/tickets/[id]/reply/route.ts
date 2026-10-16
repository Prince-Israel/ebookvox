import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, rateLimit, route } from "@/lib/api";
import { readTicketBody } from "@/lib/attachments";
import { requireUser } from "@/lib/auth";
import { emitEvent } from "@/lib/events";

export const POST = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requireUser();
  rateLimit(`reply:${u.id}`, 30, 3600_000);
  const { fields, images } = await readTicketBody(req);
  const { message } = z.object({ message: z.string().trim().max(5000).default("") }).parse(fields);
  if (!message && images.length === 0) throw new ApiError(400, "Write a message or attach a photo first.");
  const t = await db.ticket.findFirst({ where: { id: (await params).id, userId: u.id } });
  if (!t) throw new ApiError(404, "We couldn't find that ticket.");
  if (t.status === "CLOSED") throw new ApiError(409, "This ticket is closed, so you can't reply. Please open a new ticket if you still need help.");
  await db.$transaction([
    db.ticketMessage.create({ data: { ticketId: t.id, authorId: u.id, authorRole: "USER", body: message, attachments: { create: images.map((i) => ({ name: i.name, mime: i.mime, size: i.size, data: new Uint8Array(i.data) })) } } }),
    db.ticket.update({ where: { id: t.id }, data: { status: "OPEN" } }),
  ]);
  await emitEvent("ticket.message", { ticketId: t.id, subject: t.subject, from: "USER", name: `${u.firstName} ${u.lastName}`, email: u.email, created: false });
});
