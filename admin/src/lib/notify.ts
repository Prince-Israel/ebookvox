import { db } from "./db";
import { permsOf, type Permission } from "./rbac";

/** One notification per active admin who is allowed to act on it. */
export async function notifyAdmins(perm: Permission, type: string, title: string, body: string, link?: string) {
  const admins = await db.adminUser.findMany({ where: { status: "ACTIVE" } });
  const rows = admins.filter((a) => a.role === "SUPER_ADMIN" || permsOf(a).includes(perm)).map((a) => ({ adminId: a.id, type, title, body, link }));
  if (rows.length) await db.adminNotification.createMany({ data: rows });
}
