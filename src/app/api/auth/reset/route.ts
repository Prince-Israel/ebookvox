import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, readJson, route } from "@/lib/api";
import { hashPassword, sha256 } from "@/lib/auth";
import { passwordSchema } from "@/lib/validation";
import { notify } from "@/lib/notify";

export const POST = route(async (req) => {
  const { token, password, confirmPassword } = z
    .object({ token: z.string().min(10, "This reset link is invalid."), password: passwordSchema, confirmPassword: z.string() })
    .parse(await readJson(req));
  if (password !== confirmPassword) throw new ApiError(400, "Passwords do not match.", { confirmPassword: "Passwords do not match." });
  const t = await db.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!t || t.type !== "RESET_PASSWORD" || t.usedAt || t.expiresAt < new Date())
    throw new ApiError(400, "This reset link is invalid or has expired. Request a new one.");
  await db.$transaction([
    db.user.update({ where: { id: t.userId }, data: { passwordHash: await hashPassword(password), emailVerifiedAt: new Date() } }),
    db.authToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
    db.session.deleteMany({ where: { userId: t.userId } }), // sign out everywhere
  ]);
  await notify(t.userId, "ACCOUNT_UPDATE", "Password changed", "Your password was reset. If this wasn't you, contact support immediately.", "/support");
});
