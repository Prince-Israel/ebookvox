import { z } from "zod";
import { db } from "@/lib/db";
import { clientIp, rateLimit, readJson, route } from "@/lib/api";
import { emailSchema } from "@/lib/validation";
import { sendReset } from "@/lib/account";

export const POST = route(async (req) => {
  const { email } = z.object({ email: emailSchema }).parse(await readJson(req));
  rateLimit(`forgot:${clientIp(req)}`, 5, 3600_000);
  const user = await db.user.findUnique({ where: { email } });
  if (user) await sendReset(user);
  // Same response either way so emails can't be enumerated.
  return { ok: true, message: "If an account exists for that email, a reset link is on its way." };
});
