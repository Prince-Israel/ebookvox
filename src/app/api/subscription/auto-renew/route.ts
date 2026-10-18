import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, readJson, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";

/** Turn "renew from my wallet when this period ends" on or off. (Card payments are never repeated without the reader.) */
export const POST = route(async (req) => {
  const u = await requireUser();
  const { enabled } = z.object({ enabled: z.boolean() }).parse(await readJson(req));
  const sub = await db.subscription.findFirst({ where: { userId: u.id, status: "ACTIVE" }, orderBy: { currentPeriodEnd: "desc" } });
  if (!sub) throw new ApiError(404, "You don't have an active subscription.");
  await db.subscription.update({ where: { id: sub.id }, data: { autoRenew: enabled } });
  return { autoRenew: enabled };
});
