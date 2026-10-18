import { route } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { viewer } from "@/lib/viewer";
import { PLANS, entitlementOf, planPrice, walletBalance, type Plan } from "@/lib/subscription";
import { db } from "@/lib/db";

/** Public (guests can see the prices); the reader's own subscription and wallet are included when signed in. */
export const GET = route(async (req) => {
  const v = await viewer(req);
  const plans = await Promise.all((Object.keys(PLANS) as Plan[]).map(async (p) => ({ ...(await planPrice(p, v.currency)), label: PLANS[p].label, blurb: PLANS[p].blurb })));
  const u = await getUser();
  if (!u) return { currency: v.currency, country: v.country, plans, signedIn: false, adFree: false, subscription: null, walletMinor: 0, payments: [] };
  const [ent, walletMinor, payments] = await Promise.all([
    entitlementOf(u.id),
    walletBalance(u.id, v.currency),
    db.subscriptionPayment.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return {
    currency: v.currency, country: v.country, plans, signedIn: true, ...ent, walletMinor,
    payments: payments.map((p) => ({ id: p.id, plan: p.plan, amountMinor: p.amountMinor, currency: p.currency, method: p.method, periodEnd: p.periodEnd, createdAt: p.createdAt })),
  };
});
