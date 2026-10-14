import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const GET = route(async () => {
  const u = await requireUser();
  const [items, unread] = await Promise.all([
    db.notification.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.notification.count({ where: { userId: u.id, readAt: null } }),
  ]);
  return { notifications: items, unread };
});
