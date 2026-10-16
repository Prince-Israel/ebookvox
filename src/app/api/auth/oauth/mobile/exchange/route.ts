import { z } from "zod";
import { ApiError, clientIp, rateLimit, readJson, route } from "@/lib/api";
import { redeemMobileCode } from "@/lib/oauth";

// The app calls this from inside its own web view with the one-time code it received on the deep link.
export const POST = route(async (req) => {
  rateLimit(`oauth-exchange:${clientIp(req)}`, 30, 600_000);
  const { code } = z.object({ code: z.string().min(20).max(200) }).parse(await readJson(req));
  if (!(await redeemMobileCode(code, req.headers.get("user-agent")))) throw new ApiError(400, "That sign-in link has expired. Please try again.");
  return { ok: true };
});
