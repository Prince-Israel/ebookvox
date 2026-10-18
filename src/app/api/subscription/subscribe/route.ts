import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, rateLimit, readJson, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { viewer } from "@/lib/viewer";
import { initializeTransaction, paystackConfigured } from "@/lib/paystack";
import { PLANS, activateSubscription, announceSubscription, planPrice, walletBalance, isPlan } from "@/lib/subscription";
import { formatMoney } from "@/lib/money";

/** Subscribe (or add time) with the wallet — instant — or by card, which returns a Paystack checkout address. */
export const POST = route(async (req) => {
  const u = await requireUser();
  rateLimit(`subscribe:${u.id}`, 20, 3600_000);
  const d = z.object({ plan: z.string(), method: z.enum(["wallet", "card"]) }).parse(await readJson(req));
  if (!isPlan(d.plan)) throw new ApiError(400, "Choose the monthly or the yearly plan.");
  const plan = d.plan;
  const v = await viewer(req);
  const price = await planPrice(plan, v.currency);

  if (d.method === "wallet") {
    const reference = `SUBW-${Date.now().toString(36)}-${randomBytes(5).toString("hex")}`.toUpperCase();
    const paid = { method: "WALLET" as const, currency: price.currency, amountMinor: price.amountMinor, usdMinor: price.usdMinor, reference };
    const res = await db.$transaction(async (t) => {
      // checked inside the transaction so two quick taps can't spend the same money twice
      const bal = (await t.walletTx.aggregate({ where: { userId: u.id, currency: price.currency }, _sum: { amountMinor: true } }))._sum.amountMinor ?? 0;
      if (bal < price.amountMinor) throw new ApiError(402, `Your wallet has ${formatMoney(bal, price.currency)} but the ${PLANS[plan].label.toLowerCase()} plan costs ${formatMoney(price.amountMinor, price.currency)}. Top up your wallet or pay by card.`, { balanceMinor: String(bal) });
      await t.walletTx.create({ data: { userId: u.id, currency: price.currency, type: "SUBSCRIPTION", amountMinor: -price.amountMinor, description: `Ebookvox ${PLANS[plan].label.toLowerCase()} subscription` } });
      return activateSubscription(u.id, plan, paid, t as typeof db);
    });
    await announceSubscription(u.id, plan, paid, res.end, res.renewed);
    return { status: "PAID", periodEnd: res.end.toISOString(), walletMinor: await walletBalance(u.id, price.currency) };
  }

  if (!u.emailVerifiedAt) throw new ApiError(403, "Please verify your email address before paying by card. Check your inbox, or resend the link from your profile.");
  if (!paystackConfigured()) throw new ApiError(503, "Card payments are temporarily unavailable. Please try again later.");
  const reference = `EVS-${Date.now().toString(36)}-${randomBytes(6).toString("hex")}`.toUpperCase();
  await db.charge.create({ data: { reference, userId: u.id, kind: "SUBSCRIPTION", plan, amountMinor: price.amountMinor, currency: price.currency, fxRate: price.rate } });
  const base = process.env.APP_URL ?? req.nextUrl.origin;
  const init = await initializeTransaction({ email: u.email, amountMinor: price.amountMinor, currency: price.currency, reference, callbackUrl: `${base}/payment/callback`, metadata: { kind: "SUBSCRIPTION", plan, userId: u.id } });
  if (!init.status || !init.data?.authorization_url) {
    await db.charge.update({ where: { reference }, data: { status: "FAILED", failureReason: init.message?.slice(0, 200) } });
    throw new ApiError(502, `We couldn't start the payment${init.message ? ` (${init.message})` : ""}. You haven't been charged.`);
  }
  return { status: "REDIRECT", authorizationUrl: init.data.authorization_url, reference };
});
