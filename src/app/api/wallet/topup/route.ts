import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, rateLimit, readJson, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { viewer } from "@/lib/viewer";
import { initializeTransaction, paystackConfigured } from "@/lib/paystack";
import { formatMoney } from "@/lib/money";

const LIMITS: Record<string, [min: number, max: number]> = { NGN: [50_000, 200_000_000], USD: [100, 50_000], GBP: [100, 40_000], EUR: [100, 45_000] };

/** Add funds to the wallet by card, in the currency of where the reader is now. The wallet is credited only after Paystack confirms the payment. */
export const POST = route(async (req) => {
  const u = await requireUser();
  rateLimit(`topup:${u.id}`, 20, 3600_000);
  const { amountMinor } = z.object({ amountMinor: z.number().int() }).parse(await readJson(req));
  const v = await viewer(req);
  const [min, max] = LIMITS[v.currency] ?? LIMITS.USD;
  if (amountMinor < min || amountMinor > max) throw new ApiError(400, `Top up between ${formatMoney(min, v.currency)} and ${formatMoney(max, v.currency)}.`, { amount: `Between ${formatMoney(min, v.currency)} and ${formatMoney(max, v.currency)}.` });
  if (!u.emailVerifiedAt) throw new ApiError(403, "Please verify your email address before adding funds. Check your inbox, or resend the link from your profile.");
  if (!paystackConfigured()) throw new ApiError(503, "Card payments are temporarily unavailable. Please try again later.");
  const reference = `EVT-${Date.now().toString(36)}-${randomBytes(6).toString("hex")}`.toUpperCase();
  await db.charge.create({ data: { reference, userId: u.id, kind: "TOPUP", amountMinor, currency: v.currency } });
  const base = process.env.APP_URL ?? req.nextUrl.origin;
  const init = await initializeTransaction({ email: u.email, amountMinor, currency: v.currency, reference, callbackUrl: `${base}/payment/callback`, metadata: { kind: "TOPUP", userId: u.id } });
  if (!init.status || !init.data?.authorization_url) {
    await db.charge.update({ where: { reference }, data: { status: "FAILED", failureReason: init.message?.slice(0, 200) } });
    throw new ApiError(502, `We couldn't start the payment${init.message ? ` (${init.message})` : ""}. You haven't been charged.`);
  }
  return { authorizationUrl: init.data.authorization_url, reference, currency: v.currency, amountMinor };
});
