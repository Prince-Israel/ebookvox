import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { notify } from "@/lib/notify";

export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const t = await db.ticket.findUnique({ where: { id: (await params).id }, include: { user: { select: { publisherName: true, email: true } }, messages: { orderBy: { createdAt: "asc" } } } });
  if (!t) throw new ApiError(404, "Ticket not found.");
  return { ticket: { id: t.id, subject: t.subject, status: t.status, publisher: t.user.publisherName, email: t.user.email, messages: t.messages.map((m) => ({ id: m.id, from: m.authorRole, body: m.body, createdAt: m.createdAt })) } };
});

export const POST = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const d = z.object({ message: z.string().trim().max(5000).optional(), status: z.enum(["OPEN", "WAITING_PUBLISHER", "WAITING_ADMIN", "CLOSED"]).optional() }).parse(await readJson(req));
  const t = await db.ticket.findUnique({ where: { id: (await params).id } });
  if (!t) throw new ApiError(404, "Ticket not found.");
  if (d.message) {
    if (t.status === "CLOSED") throw new ApiError(409, "This ticket is closed. Reopen it before replying.");
    await db.ticketMessage.create({ data: { ticketId: t.id, authorId: admin.id, authorRole: "ADMIN", body: d.message } });
    await db.ticket.update({ where: { id: t.id }, data: { status: d.status ?? "WAITING_PUBLISHER" } });
    await notify(t.userId, "SUPPORT_REPLY", "Admin replied to your ticket", `Re: ${t.subject}`, `/support/${t.id}`);
  } else if (d.status) {
    await db.ticket.update({ where: { id: t.id }, data: { status: d.status } });
    if (d.status === "CLOSED") await notify(t.userId, "SUPPORT_REPLY", "Your ticket was closed", `Re: ${t.subject}`, `/support/${t.id}`);
  }
});
