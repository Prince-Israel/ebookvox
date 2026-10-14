import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, clientIp, rateLimit, readJson, route } from "@/lib/api";
import { createSession, publicUser, verifyPassword } from "@/lib/auth";
import { emailSchema } from "@/lib/validation";

const DUMMY = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO5zsGZ1ZrVWuRz6C5rYQ8JpV5B4h4j8y";

export const POST = route(async (req) => {
  const { email, password } = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password.") }).parse(await readJson(req));
  rateLimit(`signin:${clientIp(req)}:${email}`, 8, 15 * 60_000);
  const user = await db.user.findUnique({ where: { email } });
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY);
  if (!user || !ok) throw new ApiError(401, "Incorrect email or password.");
  if (user.status !== "ACTIVE") throw new ApiError(403, "This account has been suspended. Please contact Ebookvox support.");
  await createSession(user.id);
  return { user: publicUser(user) };
});
