import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export const GET = route(async () => {
  await requireAdmin();
  const tickets = await db.ticket.findMany({ include: { user: { select: { email: true, firstName: true, lastName: true } }, messages: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { updatedAt: "desc" }, take: 200 });
  return { tickets: tickets.map((t) => ({ id: t.id, subject: t.subject, status: t.status, updatedAt: t.updatedAt, user: `${t.user.firstName} ${t.user.lastName}`.trim(), email: t.user.email, lastFrom: t.messages[0]?.authorRole })) };
});
