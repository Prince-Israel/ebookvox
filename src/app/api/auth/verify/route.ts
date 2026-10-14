import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, readJson, route } from "@/lib/api";
import { sha256 } from "@/lib/auth";
import { notify } from "@/lib/notify";

export const POST = route(async (req) => {
  const { token } = z.object({ token: z.string().min(10) }).parse(await readJson(req));
  const t = await db.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!t || t.type !== "VERIFY_EMAIL" || t.usedAt || t.expiresAt < new Date())
    throw new ApiError(400, "This verification link is invalid or has expired. Request a new one from your profile.");
  await db.$transaction([
    db.user.update({ where: { id: t.userId }, data: { emailVerifiedAt: new Date() } }),
    db.authToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
  ]);
  await notify(t.userId, "ACCOUNT_UPDATE", "Email verified", "Thanks — your email address is confirmed.", "/profile");
});
