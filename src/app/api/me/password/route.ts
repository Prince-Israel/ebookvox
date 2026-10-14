import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, rateLimit, readJson, route } from "@/lib/api";
import { hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { passwordSchema } from "@/lib/validation";
import { notify } from "@/lib/notify";

export const POST = route(async (req) => {
  const u = await requireUser();
  rateLimit(`chpw:${u.id}`, 6, 15 * 60_000);
  const d = z.object({ currentPassword: z.string().optional(), newPassword: passwordSchema, confirmPassword: z.string() }).parse(await readJson(req));
  if (d.newPassword !== d.confirmPassword) throw new ApiError(400, "Passwords do not match.", { confirmPassword: "Passwords do not match." });
  if (u.passwordHash) {
    if (!d.currentPassword || !(await verifyPassword(d.currentPassword, u.passwordHash)))
      throw new ApiError(400, "Your current password is incorrect.", { currentPassword: "Incorrect password." });
  }
  await db.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(d.newPassword) } });
  await notify(u.id, "ACCOUNT_UPDATE", "Password changed", "Your password was updated.", "/settings");
});
