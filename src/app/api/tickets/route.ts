import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit, route } from "@/lib/api";
import { readTicketBody } from "@/lib/attachments";
import { requireUser } from "@/lib/auth";
import { emitEvent } from "@/lib/events";

export const GET = route(async () => {
  const u = await requireUser();
  const tickets = await db.ticket.findMany({
    where: { userId: u.id },
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1, include: { _count: { select: { attachments: true } } } } },
  });
  return { tickets: tickets.map((t) => ({ id: t.id, subject: t.subject, status: t.status, updatedAt: t.updatedAt, createdAt: t.createdAt, lastMessage: t.messages[0]?.body || (t.messages[0]?._count.attachments ? "📷 Photo" : ""), lastFrom: t.messages[0]?.authorRole ?? "USER" })) };
});

export const POST = route(async (req) => {
  const u = await requireUser();
  rateLimit(`ticket:${u.id}`, 10, 3600_000);
  const { fields, images } = await readTicketBody(req);
  const d = z
    .object({ subject: z.string().trim().min(3, "Add a subject (at least 3 characters).").max(120), message: z.string().trim().min(5, "Please describe your issue (at least 5 characters).").max(5000) })
    .parse(fields);
  const t = await db.ticket.create({
    data: { userId: u.id, subject: d.subject, messages: { create: { authorId: u.id, authorRole: "USER", body: d.message, attachments: { create: images.map((i) => ({ name: i.name, mime: i.mime, size: i.size, data: new Uint8Array(i.data) })) } } } },
  });
  await emitEvent("ticket.message", { ticketId: t.id, subject: d.subject, from: "USER", name: `${u.firstName} ${u.lastName}`, email: u.email, created: true });
  return { ticket: { id: t.id } };
});
