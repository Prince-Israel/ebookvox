import { z } from "zod";
import { db } from "@/lib/db";
import { readJson, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const POST = route(async (req) => {
  const u = await requireUser();
  const d = z.object({ ids: z.array(z.string()).max(200).optional(), all: z.boolean().optional() }).parse(await readJson(req));
  await db.notification.updateMany({
    where: { userId: u.id, readAt: null, ...(d.all ? {} : { id: { in: d.ids ?? [] } }) },
    data: { readAt: new Date() },
  });
  return { unread: await db.notification.count({ where: { userId: u.id, readAt: null } }) };
});
