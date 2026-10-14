import { db } from "@/lib/db";
import { ApiError, route } from "@/lib/api";
import { requirePublisher } from "@/lib/auth";

export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requirePublisher();
  const t = await db.ticket.findFirst({ where: { id: (await params).id, userId: u.id }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  if (!t) throw new ApiError(404, "We couldn't find that ticket.");
  await db.ticket.updateMany({ where: { id: t.id }, data: { userSeenAt: new Date() } });
  return { ticket: { id: t.id, subject: t.subject, status: t.status, messages: t.messages.map((m) => ({ id: m.id, from: m.authorRole, body: m.body, createdAt: m.createdAt })) } };
});
