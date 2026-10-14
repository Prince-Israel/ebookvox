import { db } from "./db";
import type { Admin } from "./auth";

export async function logActivity(actor: Pick<Admin, "id" | "name" | "role">, action: string, targetType: string, targetId?: string | null, targetLabel?: string | null, details?: string) {
  await db.activityLog.create({ data: { actorId: actor.id, actorName: actor.name, actorRole: actor.role, action, targetType, targetId: targetId ?? null, targetLabel: targetLabel ?? null, details: details?.slice(0, 500) } });
}
