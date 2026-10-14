import { ApiError, rateLimit, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { sendVerification } from "@/lib/account";

export const POST = route(async () => {
  const u = await requireUser();
  if (u.emailVerifiedAt) throw new ApiError(400, "Your email is already verified.");
  rateLimit(`resend:${u.id}`, 3, 3600_000);
  await sendVerification(u);
  return { ok: true };
});
