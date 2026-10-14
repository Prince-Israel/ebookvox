import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { requirePublisher } from "@/lib/auth";

/** Number of support conversations where the team has replied since you last opened them. */
export const GET = route(async () => {
  const u = await requirePublisher();
  const tickets = await db.ticket.findMany({ where: { userId: u.id }, select: { userSeenAt: true, messages: { where: { authorRole: "ADMIN" }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } } });
  return { unread: tickets.filter((t) => t.messages[0] && (!t.userSeenAt || t.messages[0].createdAt > t.userSeenAt)).length };
});
