import { db } from "./db";
import { convertMinor } from "./fx";
import { emitEvent } from "./events";
import { notify } from "./notify";
import { formatMoney } from "./money";

export type Plan = "MONTHLY" | "YEARLY";
export const PLANS: Record<Plan, { label: string; months: number; usdMinor: number; usdPerMonthMinor: number; blurb: string }> = {
  // $2.00 a month; the yearly plan costs the equivalent of $1.80 a month, billed once: 12 × $1.80 = $21.60
  MONTHLY: { label: "Monthly", months: 1, usdMinor: 200, usdPerMonthMinor: 200, blurb: "Billed every month" },
  YEARLY: { label: "Yearly", months: 12, usdMinor: 2160, usdPerMonthMinor: 180, blurb: "Billed once a year — save 10%" },
};
export const isPlan = (p: unknown): p is Plan => p === "MONTHLY" || p === "YEARLY";

/** The plan's price in the reader's currency, converted from dollars at the live international rate (fixed when they pay). */
export async function planPrice(plan: Plan, currency: string) {
  const total = await convertMinor(PLANS[plan].usdMinor, "USD", currency);
  const perMonth = await convertMinor(PLANS[plan].usdPerMonthMinor, "USD", currency);
  return { plan, currency, amountMinor: total.amountMinor, perMonthMinor: perMonth.amountMinor, rate: total.rate, usdMinor: PLANS[plan].usdMinor };
}

const addMonths = (d: Date, m: number) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };

export async function walletBalance(userId: string, currency: string) {
  const r = await db.walletTx.aggregate({ where: { userId, currency }, _sum: { amountMinor: true } });
  return r._sum.amountMinor ?? 0;
}
export async function walletBalances(userId: string) {
  const rows = await db.walletTx.groupBy({ by: ["currency"], where: { userId }, _sum: { amountMinor: true } });
  return rows.map((r) => ({ currency: r.currency, amountMinor: r._sum.amountMinor ?? 0 })).filter((r) => r.amountMinor !== 0);
}

type Paid = { method: "CARD" | "WALLET"; currency: string; amountMinor: number; usdMinor: number; reference: string };

/** Starts (or extends) a subscription after a payment has been confirmed. Time is added to whatever is left, so paying early never wastes days. */
export async function activateSubscription(userId: string, plan: Plan, paid: Paid, tx = db) {
  const now = new Date();
  const current = await tx.subscription.findFirst({ where: { userId, status: "ACTIVE", currentPeriodEnd: { gt: now } }, orderBy: { currentPeriodEnd: "desc" } });
  const start = current ? current.currentPeriodEnd : now;
  const end = addMonths(start, PLANS[plan].months);
  const sub = current
    ? await tx.subscription.update({ where: { id: current.id }, data: { plan, currentPeriodEnd: end } })
    : await tx.subscription.create({ data: { userId, plan, currentPeriodEnd: end, startedAt: now } });
  await tx.subscriptionPayment.create({ data: { subscriptionId: sub.id, userId, plan, amountMinor: paid.amountMinor, currency: paid.currency, usdMinor: paid.usdMinor, method: paid.method, reference: paid.reference, periodStart: start, periodEnd: end } });
  return { sub, renewed: !!current, end };
}

/** Tells the user and the Admin platform (after the database transaction has committed). */
export async function announceSubscription(userId: string, plan: Plan, paid: Paid, end: Date, renewed: boolean) {
  const u = await db.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true, country: true } });
  await emitEvent(renewed ? "subscription.renewed" : "subscription.created", {
    userId, name: `${u?.firstName ?? ""} ${u?.lastName ?? ""}`.trim(), email: u?.email, country: u?.country, plan, amountMinor: paid.amountMinor, currency: paid.currency, usdMinor: paid.usdMinor, method: paid.method, periodEnd: end.toISOString(),
  });
  await notify(userId, "ACCOUNT_UPDATE", "Ads are off — thank you!", `Your ${PLANS[plan].label.toLowerCase()} Ebookvox subscription (${formatMoney(paid.amountMinor, paid.currency)}) is active until ${end.toDateString()}.`, "/subscribe");
}

/**
 * The reader's current entitlement. Also does the housekeeping: a lapsed subscription is marked EXPIRED, and one with auto-renew on is renewed
 * from the wallet when the funds are there (card payments can't be repeated without the reader, so they simply lapse).
 */
export async function entitlementOf(userId: string) {
  const now = new Date();
  let sub = await db.subscription.findFirst({ where: { userId, status: "ACTIVE" }, orderBy: { currentPeriodEnd: "desc" } });
  if (sub && sub.currentPeriodEnd <= now) {
    let renewed = false;
    if (sub.autoRenew) {
      const last = await db.subscriptionPayment.findFirst({ where: { subscriptionId: sub.id }, orderBy: { createdAt: "desc" } });
      if (last) {
        const price = await planPrice(sub.plan as Plan, last.currency);
        const reference = `SUBW-${Date.now().toString(36)}-${sub.id.slice(-6)}`.toUpperCase();
        const done = await db.$transaction(async (t) => {
          const bal = (await t.walletTx.aggregate({ where: { userId, currency: last.currency }, _sum: { amountMinor: true } }))._sum.amountMinor ?? 0;
          if (bal < price.amountMinor) return null;
          await t.walletTx.create({ data: { userId, currency: last.currency, type: "SUBSCRIPTION", amountMinor: -price.amountMinor, description: `Ebookvox ${PLANS[sub!.plan as Plan].label.toLowerCase()} subscription (auto-renewed)` } });
          return activateSubscription(userId, sub!.plan as Plan, { method: "WALLET", currency: last.currency, amountMinor: price.amountMinor, usdMinor: price.usdMinor, reference }, t as typeof db);
        });
        if (done) { renewed = true; await announceSubscription(userId, sub.plan as Plan, { method: "WALLET", currency: last.currency, amountMinor: price.amountMinor, usdMinor: price.usdMinor, reference }, done.end, true); }
      }
    }
    if (!renewed) await db.subscription.update({ where: { id: sub.id }, data: { status: "EXPIRED" } });
    sub = renewed ? await db.subscription.findFirst({ where: { userId, status: "ACTIVE" }, orderBy: { currentPeriodEnd: "desc" } }) : null;
  }
  return { adFree: !!sub, subscription: sub ? { plan: sub.plan as Plan, currentPeriodEnd: sub.currentPeriodEnd.toISOString(), autoRenew: sub.autoRenew } : null };
}
